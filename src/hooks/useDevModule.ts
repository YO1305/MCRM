import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  subscribeToCollection,
  subscribeToSubcollection,
  createDocument,
  createSubdocument,
  updateDocument,
  removeDocument,
  setDocumentIfMissing,
} from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import type {
  DevProject,
  DevSubtask,
  DevSubtaskComment,
  DevTemplate,
  ProjectStatus,
  SubtaskStatus,
} from '@/types/dev.types'
import {
  carryDueDate,
  dateInMonth,
  getCurrentMonth,
  isSubtaskOverdue,
  prevMonthKey,
  todayISO,
} from '@/utils/devDates'

export function useDevModule() {
  const { user, isAdmin } = useAuth()
  const canManageProjects = isAdmin || user?.position === 'head'
  const isDevManager = user?.position === 'dev_manager'
  const canWork = isAdmin || user?.position === 'head' || isDevManager

  const { users } = useUsers(!!user && canWork)

  const [projects, setProjects] = useState<DevProject[]>([])
  const [subtasks, setSubtasks] = useState<DevSubtask[]>([])
  const [templates, setTemplates] = useState<DevTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const defaultAssignee = useMemo(() => {
    const m = users.find((u) => u.position === 'dev_manager' && u.isActive !== false)
    return m ? { id: m.id, name: m.name } : null
  }, [users])

  useEffect(() => {
    if (!user || !canWork) {
      setProjects([])
      setSubtasks([])
      setTemplates([])
      setLoading(false)
      return
    }
    setLoading(true)
    const u1 = subscribeToCollection<DevProject>('dev_projects', [], (data) => {
      setProjects(
        [...data].sort((a, b) => a.title.localeCompare(b.title, 'ru')),
      )
    })
    const u2 = subscribeToCollection<DevSubtask>('dev_subtasks', [], (data) => {
      setSubtasks(
        [...data].sort((a, b) => {
          const ad = a.dueDate || ''
          const bd = b.dueDate || ''
          return ad.localeCompare(bd) || a.title.localeCompare(b.title, 'ru')
        }),
      )
      setLoading(false)
    }, () => setLoading(false))
    const u3 = subscribeToCollection<DevTemplate>('dev_templates', [], (data) => {
      setTemplates(data)
    })
    return () => {
      u1()
      u2()
      u3()
    }
  }, [user, canWork])

  const confirmers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.isActive !== false && (u.role === 'admin' || u.position === 'head'),
      ),
    [users],
  )

  async function notifyUsers(
    recipients: { id: string }[],
    payload: {
      type: string
      title: string
      body: string
      taskId?: string | null
      dedupeKey?: string | null
    },
  ) {
    await Promise.all(
      recipients.map((r) => {
        const base = {
          userId: r.id,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          taskId: payload.taskId || null,
          dedupeKey: payload.dedupeKey || null,
          read: false,
        }
        if (payload.dedupeKey) {
          return setDocumentIfMissing(
            'notifications',
            `${payload.dedupeKey}_${r.id}`.replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 700),
            base,
          )
        }
        return createDocument('notifications', base)
      }),
    )
  }

  // ——— Projects ———
  async function createProject(input: {
    title: string
    description?: string
    dueDate?: string | null
    startDate?: string | null
    assigneeId?: string | null
    assigneeName?: string | null
  }) {
    if (!user || !canManageProjects) throw new Error('Нет доступа')
    const assignee =
      input.assigneeId && input.assigneeName
        ? { id: input.assigneeId, name: input.assigneeName }
        : defaultAssignee
    await createDocument('dev_projects', {
      title: input.title.trim(),
      description: (input.description || '').trim(),
      status: 'active' satisfies ProjectStatus,
      dueDate: input.dueDate || null,
      startDate: input.startDate || null,
      assigneeId: assignee?.id || null,
      assigneeName: assignee?.name || null,
      createdBy: user.id,
      createdByName: user.name,
    })
  }

  async function updateProject(id: string, patch: Partial<DevProject>) {
    if (!canManageProjects) throw new Error('Нет доступа')
    const { id: _i, ...rest } = patch as DevProject
    void _i
    await updateDocument('dev_projects', id, rest as Record<string, unknown>)
  }

  async function deleteProject(id: string) {
    if (!isAdmin) throw new Error('Только админ')
    const related = subtasks.filter((s) => s.projectId === id)
    await Promise.all(related.map((s) => removeDocument('dev_subtasks', s.id)))
    await removeDocument('dev_projects', id)
  }

  // ——— Subtasks ———
  async function addSubtask(input: {
    projectId: string
    title: string
    description?: string
    dueDate?: string | null
    monthKey?: string
  }) {
    if (!user || !canManageProjects) throw new Error('Нет доступа')
    const project = projects.find((p) => p.id === input.projectId)
    if (!project) throw new Error('Проект не найден')
    const assigneeId = project.assigneeId || defaultAssignee?.id
    const assigneeName = project.assigneeName || defaultAssignee?.name
    if (!assigneeId || !assigneeName) throw new Error('Нет менеджера по развитию')

    const monthKey =
      input.monthKey ||
      (input.dueDate ? input.dueDate.slice(0, 7) : getCurrentMonth())

    await createDocument('dev_subtasks', {
      projectId: project.id,
      projectTitle: project.title,
      title: input.title.trim(),
      description: (input.description || '').trim(),
      status: 'todo' satisfies SubtaskStatus,
      monthKey,
      dueDate: input.dueDate || dateInMonth(monthKey, 28),
      assignedTo: assigneeId,
      assignedToName: assigneeName,
      createdBy: user.id,
      createdByName: user.name,
      sourceTemplateId: null,
      generatedForMonth: null,
      carriedFromMonth: null,
      confirmedBy: null,
      confirmedByName: null,
      confirmNote: null,
      completedAt: null,
    })
  }

  async function updateSubtask(id: string, patch: Partial<DevSubtask>) {
    const { id: _i, ...rest } = patch as DevSubtask
    void _i
    await updateDocument('dev_subtasks', id, rest as Record<string, unknown>)
  }

  async function deleteSubtask(id: string) {
    if (!canManageProjects && !isAdmin) throw new Error('Нет доступа')
    await removeDocument('dev_subtasks', id)
  }

  async function setSubtaskStatus(subtask: DevSubtask, status: SubtaskStatus) {
    if (!user) throw new Error('Not authenticated')

    if (status === 'pending_confirm') {
      await updateDocument('dev_subtasks', subtask.id, {
        status: 'pending_confirm',
        completedAt: null,
      })
      const recipients = confirmers.length
        ? confirmers
        : users.filter((u) => u.role === 'admin')
      await notifyUsers(recipients, {
        type: 'dev_confirm',
        title: 'Подтвердить выполнение подзадачи',
        body: `«${subtask.title}» · ${subtask.projectTitle} · ${user.name}`,
        taskId: subtask.id,
        dedupeKey: `dev_confirm_${subtask.id}`,
      })
      return
    }

    if (status === 'done') {
      if (!canManageProjects && !isAdmin) throw new Error('Нет доступа')
      await updateDocument('dev_subtasks', subtask.id, {
        status: 'done',
        confirmedBy: user.id,
        confirmedByName: user.name,
        completedAt: new Date().toISOString(),
      })
      await notifyUsers([{ id: subtask.assignedTo }], {
        type: 'dev_confirmed',
        title: 'Подзадача подтверждена',
        body: `«${subtask.title}» подтвердил(а) ${user.name}`,
        taskId: subtask.id,
      })
      return
    }

    if (status === 'rejected') {
      if (!canManageProjects && !isAdmin) throw new Error('Нет доступа')
      await updateDocument('dev_subtasks', subtask.id, {
        status: 'in_progress',
        confirmedBy: user.id,
        confirmedByName: user.name,
        confirmNote: 'Отклонено — доработать',
        completedAt: null,
      })
      await notifyUsers([{ id: subtask.assignedTo }], {
        type: 'dev_rejected',
        title: 'Подзадача отклонена',
        body: `«${subtask.title}» — вернули в работу (${user.name})`,
        taskId: subtask.id,
      })
      return
    }

    await updateDocument('dev_subtasks', subtask.id, { status })
  }

  /** Manager marks work finished → confirmation queue. */
  async function submitForConfirm(subtask: DevSubtask) {
    await setSubtaskStatus(subtask, 'pending_confirm')
  }

  async function confirmSubtask(subtask: DevSubtask) {
    await setSubtaskStatus(subtask, 'done')
  }

  async function rejectSubtask(subtask: DevSubtask) {
    await setSubtaskStatus(subtask, 'rejected')
  }

  // ——— Templates ———
  async function createTemplate(input: {
    title: string
    description?: string
    projectId?: string | null
    dayOfMonth?: number
    assignedTo?: string
    assignedToName?: string
  }) {
    if (!user || !canManageProjects) throw new Error('Нет доступа')
    const project = input.projectId
      ? projects.find((p) => p.id === input.projectId)
      : null
    const assigneeId =
      input.assignedTo || project?.assigneeId || defaultAssignee?.id
    const assigneeName =
      input.assignedToName || project?.assigneeName || defaultAssignee?.name
    if (!assigneeId || !assigneeName) throw new Error('Нет исполнителя')

    await createDocument('dev_templates', {
      title: input.title.trim(),
      description: (input.description || '').trim(),
      projectId: project?.id || null,
      projectTitle: project?.title || null,
      assignedTo: assigneeId,
      assignedToName: assigneeName,
      dayOfMonth: input.dayOfMonth ?? 1,
      active: true,
      lastGeneratedMonth: null,
      createdBy: user.id,
    })
  }

  async function updateTemplate(id: string, patch: Partial<DevTemplate>) {
    if (!canManageProjects) throw new Error('Нет доступа')
    const { id: _i, ...rest } = patch as DevTemplate
    void _i
    await updateDocument('dev_templates', id, rest as Record<string, unknown>)
  }

  async function deleteTemplate(id: string) {
    if (!canManageProjects) throw new Error('Нет доступа')
    await removeDocument('dev_templates', id)
  }

  /** Materialize monthly templates + carry overdue into current month. */
  const materializeMonth = useCallback(async () => {
    if (!user) return
    const month = getCurrentMonth()
    const today = todayISO()

    // 1) Templates for this month
    for (const tpl of templates) {
      if (!tpl.active) continue
      if (tpl.lastGeneratedMonth === month) continue
      try {
        await createDocument('dev_subtasks', {
          projectId: tpl.projectId || 'general',
          projectTitle: tpl.projectTitle || 'Ежемесячные',
          title: tpl.title,
          description: tpl.description || '',
          status: 'todo',
          monthKey: month,
          dueDate: dateInMonth(month, tpl.dayOfMonth || 1),
          assignedTo: tpl.assignedTo,
          assignedToName: tpl.assignedToName,
          createdBy: user.id,
          createdByName: user.name,
          sourceTemplateId: tpl.id,
          generatedForMonth: month,
          carriedFromMonth: null,
          confirmedBy: null,
          confirmedByName: null,
          confirmNote: null,
          completedAt: null,
        })
        await updateDocument('dev_templates', tpl.id, {
          lastGeneratedMonth: month,
        })
      } catch (err) {
        console.error('dev template materialize', tpl.id, err)
      }
    }

    // 2) Carry overdue unfinished from previous months into current month
    const open = subtasks.filter(
      (s) =>
        s.status !== 'done' &&
        s.status !== 'pending_confirm' &&
        s.monthKey < month &&
        (isSubtaskOverdue(s.dueDate, s.status, today) || s.monthKey === prevMonthKey(month)),
    )

    for (const s of open) {
      if (s.monthKey === month) continue
      try {
        await updateDocument('dev_subtasks', s.id, {
          monthKey: month,
          dueDate: carryDueDate(s.dueDate, month),
          carriedFromMonth: s.monthKey,
        })
        await setDocumentIfMissing(
          'notifications',
          `dev_overdue_carry_${s.id}_${month}`.replace(/[^a-zA-Z0-9:_-]/g, '_'),
          {
            userId: s.assignedTo,
            type: 'dev_overdue',
            title: 'Просроченная подзадача перенесена',
            body: `«${s.title}» → ${month} (было ${s.monthKey})`,
            taskId: s.id,
            dedupeKey: `dev_overdue_carry_${s.id}_${month}`,
            read: false,
          },
        )
      } catch (err) {
        console.error('carry overdue', s.id, err)
      }
    }
  }, [user, templates, subtasks])

  return {
    projects,
    subtasks,
    templates,
    loading,
    canManageProjects,
    canWork,
    isDevManager,
    defaultAssignee,
    createProject,
    updateProject,
    deleteProject,
    addSubtask,
    updateSubtask,
    deleteSubtask,
    setSubtaskStatus,
    submitForConfirm,
    confirmSubtask,
    rejectSubtask,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    materializeMonth,
  }
}

export function useDevSubtaskComments(subtaskId: string | null) {
  const { user } = useAuth()
  const [comments, setComments] = useState<DevSubtaskComment[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!subtaskId || !user) {
      setComments([])
      return
    }
    setLoading(true)
    return subscribeToSubcollection<DevSubtaskComment>(
      'dev_subtasks',
      subtaskId,
      'comments',
      (data) => {
        setComments(
          [...data].sort((a, b) => {
            const as = (a.createdAt as { seconds?: number } | null)?.seconds || 0
            const bs = (b.createdAt as { seconds?: number } | null)?.seconds || 0
            return as - bs
          }),
        )
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [subtaskId, user])

  async function addComment(text: string) {
    if (!user || !subtaskId) throw new Error('Not authenticated')
    const trimmed = text.trim()
    if (!trimmed) return
    await createSubdocument('dev_subtasks', subtaskId, 'comments', {
      text: trimmed,
      authorId: user.id,
      authorName: user.name,
    })
  }

  return { comments, loading, addComment }
}
