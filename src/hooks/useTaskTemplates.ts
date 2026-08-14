import { useCallback, useEffect, useRef, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/firebase/config'
import {
  subscribeToCollection,
  createDocument,
  updateDocument,
  removeDocument,
  setDocumentIfMissing,
} from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import type { TaskTemplate, TaskTemplateInput } from '@/types/taskTemplate.types'
import {
  dueDateForTemplate,
  isRecurringTasksPaused,
  shouldGenerateTemplate,
} from '@/utils/taskTemplates'
import { todayISO } from '@/utils/dates'

function isOpenGeneratedTask(status: string | undefined): boolean {
  return status !== 'done'
}

/** Stable id — one task per template per day (no duplicates). */
export function generatedTaskId(templateId: string, dateISO: string): string {
  return `gen_${templateId}_${dateISO}`
}

async function removeOpenTasksFromTemplate(templateId: string): Promise<number> {
  const snap = await getDocs(
    query(collection(db, 'tasks'), where('sourceTemplateId', '==', templateId)),
  )
  const toDelete = snap.docs.filter((d) => isOpenGeneratedTask(d.data().status))
  await Promise.all(toDelete.map((d) => removeDocument('tasks', d.id)))
  return toDelete.length
}

async function removeOrphanTemplateTasks(
  userId: string,
  keepTemplateIds: Set<string>,
): Promise<number> {
  const snap = await getDocs(
    query(collection(db, 'tasks'), where('assignedTo', '==', userId)),
  )
  const toDelete = snap.docs.filter((d) => {
    const data = d.data()
    const src = data.sourceTemplateId as string | null | undefined
    if (!src) return false
    if (!isOpenGeneratedTask(data.status)) return false
    return !keepTemplateIds.has(src)
  })
  await Promise.all(toDelete.map((d) => removeDocument('tasks', d.id)))
  return toDelete.length
}

/** Drop duplicate generated tasks for a template+day; keep canonical fixed-id doc if present. */
async function dedupeTemplateDay(templateId: string, dateISO: string): Promise<number> {
  const snap = await getDocs(
    query(collection(db, 'tasks'), where('sourceTemplateId', '==', templateId)),
  )
  const sameDay = snap.docs.filter((d) => d.data().generatedForDate === dateISO)
  if (sameDay.length <= 1) return 0

  const canonicalId = generatedTaskId(templateId, dateISO)
  const keep =
    sameDay.find((d) => d.id === canonicalId) ||
    sameDay.find((d) => d.data().status === 'done') ||
    sameDay[0]

  const extras = sameDay.filter((d) => d.id !== keep.id)
  await Promise.all(extras.map((d) => removeDocument('tasks', d.id)))
  return extras.length
}

async function removeGeneratedForDay(templateId: string, dateISO: string): Promise<number> {
  const snap = await getDocs(
    query(collection(db, 'tasks'), where('sourceTemplateId', '==', templateId)),
  )
  const toDelete = snap.docs.filter((d) => d.data().generatedForDate === dateISO)
  await Promise.all(toDelete.map((d) => removeDocument('tasks', d.id)))
  return toDelete.length
}

export function useTaskTemplates(userId?: string | null) {
  const { user, isAdmin } = useAuth()
  const { users, loading: usersLoading } = useUsers()
  const usersRef = useRef(users)
  usersRef.current = users
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [loading, setLoading] = useState(true)

  function isAssigneePaused(assigneeId: string, dateISO: string = todayISO()): boolean {
    const assignee = usersRef.current.find((u) => u.id === assigneeId)
    return isRecurringTasksPaused(assignee, dateISO)
  }

  useEffect(() => {
    if (!user) {
      setTemplates([])
      setLoading(false)
      return
    }

    setLoading(true)
    const constraints =
      userId != null
        ? [where('userId', '==', userId)]
        : isAdmin
          ? []
          : [where('userId', '==', user.id)]

    const unsubscribe = subscribeToCollection<TaskTemplate>(
      'task_templates',
      constraints,
      (data) => {
        setTemplates(data)
        setLoading(false)
      },
      (err) => {
        console.error('task_templates subscribe failed', err)
        setLoading(false)
      },
    )

    return unsubscribe
  }, [user, isAdmin, userId])

  async function createTemplate(input: TaskTemplateInput) {
    if (!user) throw new Error('Not authenticated')
    await createDocument('task_templates', {
      userId: input.userId,
      userName: input.userName,
      title: input.title.trim(),
      description: (input.description || '').trim(),
      priority: input.priority || 'normal',
      recurrence: input.recurrence,
      interval: input.interval ?? 1,
      dueOffsetDays: input.dueOffsetDays ?? 0,
      weekday: input.weekday ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
      active: input.active !== false,
      lastGeneratedDate: null,
      createdBy: user.id,
    })
  }

  async function createTemplatesForUsers(
    base: Omit<TaskTemplateInput, 'userId' | 'userName'>,
    assignees: { id: string; name: string }[],
  ) {
    if (!user) throw new Error('Not authenticated')
    if (!assignees.length) throw new Error('No assignees')
    await Promise.all(
      assignees.map((assignee) =>
        createTemplate({
          ...base,
          userId: assignee.id,
          userName: assignee.name,
        }),
      ),
    )
  }

  async function updateTemplate(id: string, data: Partial<TaskTemplate>) {
    const wasActive = templates.find((t) => t.id === id)?.active !== false
    await updateDocument('task_templates', id, data as Record<string, unknown>)
    if (wasActive && data.active === false) {
      await removeOpenTasksFromTemplate(id)
    }
  }

  async function deleteTemplate(id: string) {
    await removeOpenTasksFromTemplate(id)
    await removeDocument('task_templates', id)
  }

  async function syncEmployeeTasks(employeeId: string) {
    const activeIds = new Set(
      templates.filter((t) => t.active !== false && t.userId === employeeId).map((t) => t.id),
    )
    return removeOrphanTemplateTasks(employeeId, activeIds)
  }

  const materializeDue = useCallback(async () => {
    if (!user) return 0
    if (usersLoading) return 0
    const today = todayISO()
    const due = templates.filter(
      (t) => shouldGenerateTemplate(t, today) && !isAssigneePaused(t.userId, today),
    )
    if (!due.length) return 0

    let created = 0
    for (const template of due) {
      try {
        // Pause may land mid-loop (vacation just saved) — skip instead of creating
        if (isAssigneePaused(template.userId, today)) continue

        // Clean old-style duplicates for this template+day
        await dedupeTemplateDay(template.id, today)

        const taskId = generatedTaskId(template.id, today)
        const wasNew = await setDocumentIfMissing('tasks', taskId, {
          title: template.title,
          description: template.description || '',
          status: 'todo',
          priority: template.priority || 'normal',
          assignedTo: template.userId,
          assignedToName: template.userName,
          createdBy: user.id,
          createdByName: user.name,
          startDate: today,
          dueDate: dueDateForTemplate(template, today),
          attachments: [],
          links: [],
          sourceTemplateId: template.id,
          generatedForDate: today,
          completedAt: null,
        })

        // Always mark generated — even if task already existed (idempotent)
        if (template.lastGeneratedDate !== today) {
          await updateDocument('task_templates', template.id, {
            lastGeneratedDate: today,
          })
        }
        if (wasNew) created += 1
      } catch (err) {
        console.error('Failed to materialize template', template.id, err)
      }
    }
    return created
  }, [templates, user, users, usersLoading])

  /**
   * Full restart of today's generated tasks for one employee (or all if omitted).
   * Removes today's copies (incl. duplicates), resets lastGeneratedDate, creates fresh once.
   */
  async function restartDailyTasks(employeeId?: string): Promise<{
    removed: number
    created: number
  }> {
    if (!user) throw new Error('Not authenticated')
    if (!isAdmin) throw new Error('Только админ')
    if (usersLoading) throw new Error('Список сотрудников ещё загружается')

    const today = todayISO()
    const scope = templates.filter((t) => {
      if (!t.active) return false
      if (employeeId && t.userId !== employeeId) return false
      if (isAssigneePaused(t.userId, today)) return false
      // Restart all active templates that are due today OR daily (force today)
      return t.recurrence === 'daily' || shouldGenerateTemplate({ ...t, lastGeneratedDate: null }, today)
    })

    let removed = 0
    for (const template of scope) {
      removed += await removeGeneratedForDay(template.id, today)
      await updateDocument('task_templates', template.id, { lastGeneratedDate: null })
    }

    let created = 0
    for (const template of scope) {
      try {
        const taskId = generatedTaskId(template.id, today)
        // Force recreate: delete canonical id if somehow left, then create
        try {
          await removeDocument('tasks', taskId)
        } catch {
          /* missing is fine */
        }
        const wasNew = await setDocumentIfMissing('tasks', taskId, {
          title: template.title,
          description: template.description || '',
          status: 'todo',
          priority: template.priority || 'normal',
          assignedTo: template.userId,
          assignedToName: template.userName,
          createdBy: user.id,
          createdByName: user.name,
          startDate: today,
          dueDate: dueDateForTemplate(template, today),
          attachments: [],
          links: [],
          sourceTemplateId: template.id,
          generatedForDate: today,
          completedAt: null,
        })
        await updateDocument('task_templates', template.id, { lastGeneratedDate: today })
        if (wasNew) created += 1
      } catch (err) {
        console.error('restartDailyTasks failed', template.id, err)
      }
    }

    return { removed, created }
  }

  /** Remove duplicate generated tasks for today across scoped templates. */
  async function dedupeTodayTasks(employeeId?: string): Promise<number> {
    const today = todayISO()
    const scope = templates.filter((t) => {
      if (employeeId && t.userId !== employeeId) return false
      return true
    })
    let n = 0
    for (const t of scope) {
      n += await dedupeTemplateDay(t.id, today)
    }
    return n
  }

  /** Drop open template-generated tasks (daily etc.) so they don't sit during vacation. */
  async function clearOpenGeneratedTasks(employeeId: string): Promise<number> {
    return removeOrphanTemplateTasks(employeeId, new Set())
  }

  return {
    templates,
    loading,
    createTemplate,
    createTemplatesForUsers,
    updateTemplate,
    deleteTemplate,
    syncEmployeeTasks,
    materializeDue,
    restartDailyTasks,
    dedupeTodayTasks,
    clearOpenGeneratedTasks,
  }
}
