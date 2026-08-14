import { useEffect, useState } from 'react'
import { collection, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore'
import {
  subscribeToCollection,
  createDocument,
  updateDocument,
  removeDocument,
  setDocumentIfMissing,
} from '@/firebase/firestore'
import { db } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import type { Task, TaskLink } from '@/types/task.types'
import type { TaskStatus } from '@/constants/taskStatuses'

async function taskHasComments(taskId: string): Promise<boolean> {
  const q = query(collection(db, 'tasks', taskId, 'comments'), limit(1))
  const snap = await getDocs(q)
  return !snap.empty
}

export function useTasks(opts?: { forAssigneeId?: string | null }) {
  const { user, isAdmin } = useAuth()
  const canSeeTeam = isAdmin || user?.position === 'head'
  const forAssigneeId = opts?.forAssigneeId
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setTasks([])
      setLoading(false)
      return
    }

    setLoading(true)
    const constraints =
      forAssigneeId && canSeeTeam
        ? [where('assignedTo', '==', forAssigneeId)]
        : canSeeTeam && !forAssigneeId
          ? []
          : [where('assignedTo', '==', user.id)]

    const unsubscribe = subscribeToCollection<Task>(
      'tasks',
      constraints,
      (data) => {
        const sorted = [...data].sort((a, b) => {
          const aDue = a.dueDate || '9999'
          const bDue = b.dueDate || '9999'
          if (aDue !== bDue) return aDue.localeCompare(bDue)
          const pri = { high: 0, normal: 1, low: 2 } as const
          return (pri[a.priority] ?? 1) - (pri[b.priority] ?? 1)
        })
        setTasks(sorted)
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error(err)
        setError('Не удалось загрузить задачи')
        setLoading(false)
      },
    )

    return unsubscribe
  }, [user, canSeeTeam, forAssigneeId])

  async function createTasks(
    input: {
      title: string
      description?: string
      status?: TaskStatus
      priority?: Task['priority']
      startDate?: string | null
      dueDate?: string | null
      links?: TaskLink[]
    },
    assignees: { id: string; name: string }[],
  ) {
    if (!user) throw new Error('Not authenticated')
    if (!assignees.length) throw new Error('No assignees')

    const allowed = canSeeTeam
      ? assignees
      : assignees.filter((a) => a.id === user.id)
    if (!allowed.length) {
      throw new Error('Можно ставить задачу только себе')
    }
    if (!canSeeTeam && allowed.length !== assignees.length) {
      throw new Error('Можно ставить задачу только себе')
    }

    await Promise.all(
      allowed.map(async (assignee) => {
        const taskId = await createDocument('tasks', {
          title: input.title.trim(),
          description: (input.description || '').trim(),
          status: input.status || 'todo',
          priority: input.priority || 'normal',
          assignedTo: assignee.id,
          assignedToName: assignee.name,
          createdBy: user.id,
          createdByName: user.name,
          startDate: input.startDate || null,
          dueDate: input.dueDate || null,
          attachments: [],
          links: input.links || [],
          completedAt: null,
          submittedAt: null,
          confirmedBy: null,
          confirmedAt: null,
        })

        if (assignee.id !== user.id) {
          const dedupeKey = `assigned:${taskId}:${assignee.id}`
          await setDocumentIfMissing(
            'notifications',
            dedupeKey.replace(/[^a-zA-Z0-9:_-]/g, '_'),
            {
              userId: assignee.id,
              type: 'task_assigned',
              title: 'Новая задача',
              body: `«${input.title.trim()}» от ${user.name}`,
              taskId,
              dedupeKey,
              read: false,
            },
          )
        }
      }),
    )
  }

  /**
   * Complete flow:
   * - comment required to finish
   * - if assignee ≠ creator → awaiting_confirm + notify creator
   * - creator/head/admin confirms → done
   * - self-assigned → done immediately (with comment)
   */
  async function buildStatusPatch(
    task: Task,
    requested: TaskStatus,
  ): Promise<Record<string, unknown>> {
    if (!user) throw new Error('Not authenticated')

    if (requested !== 'done') {
      return {
        status: requested,
        completedAt: null,
        ...(requested !== 'awaiting_confirm'
          ? { submittedAt: null, confirmedBy: null, confirmedAt: null }
          : {}),
      }
    }

    const hasComments = await taskHasComments(task.id)
    if (!hasComments) {
      throw new Error(
        'Сначала добавьте комментарий с результатом — без комментария задачу нельзя завершить',
      )
    }

    const isCreator = user.id === task.createdBy
    const isAssignee = user.id === task.assignedTo
    const selfTask = task.createdBy === task.assignedTo
    const canConfirm = isCreator || canSeeTeam

    // Already on review → only creator/head confirms
    if (task.status === 'awaiting_confirm') {
      if (!canConfirm) {
        throw new Error('Ожидайте подтверждения от того, кто поставил задачу')
      }
      return {
        status: 'done',
        completedAt: serverTimestamp(),
        confirmedBy: user.id,
        confirmedAt: serverTimestamp(),
      }
    }

    // Own task or creator finishing their own assignment
    if (selfTask || (isCreator && isAssignee)) {
      return {
        status: 'done',
        completedAt: serverTimestamp(),
        confirmedBy: user.id,
        confirmedAt: serverTimestamp(),
      }
    }

    // Assignee submits for confirmation
    if (isAssignee) {
      return {
        status: 'awaiting_confirm',
        completedAt: null,
        submittedAt: serverTimestamp(),
        confirmedBy: null,
        confirmedAt: null,
      }
    }

    // Head/admin closing for someone
    if (canConfirm) {
      return {
        status: 'done',
        completedAt: serverTimestamp(),
        confirmedBy: user.id,
        confirmedAt: serverTimestamp(),
      }
    }

    throw new Error('Нельзя завершить эту задачу')
  }

  async function notifyStatusSideEffects(task: Task, nextStatus: TaskStatus) {
    if (!user) return

    if (nextStatus === 'awaiting_confirm' && task.createdBy !== user.id) {
      const dedupeKey = `await_confirm:${task.id}:${task.createdBy}`
      await setDocumentIfMissing(
        'notifications',
        dedupeKey.replace(/[^a-zA-Z0-9:_-]/g, '_'),
        {
          userId: task.createdBy,
          type: 'task_awaiting_confirm',
          title: 'Подтвердите задачу',
          body: `«${task.title}» · ${user.name} отметил(а) готово — подтвердите`,
          taskId: task.id,
          dedupeKey,
          read: false,
        },
      )
    }

    if (nextStatus === 'done' && task.assignedTo !== user.id && task.status === 'awaiting_confirm') {
      const dedupeKey = `confirmed:${task.id}:${task.assignedTo}`
      await setDocumentIfMissing(
        'notifications',
        dedupeKey.replace(/[^a-zA-Z0-9:_-]/g, '_'),
        {
          userId: task.assignedTo,
          type: 'task_confirmed',
          title: 'Задача подтверждена',
          body: `«${task.title}» подтвердил(а) ${user.name}`,
          taskId: task.id,
          dedupeKey,
          read: false,
        },
      )
    }
  }

  async function setStatus(taskId: string, status: TaskStatus): Promise<TaskStatus> {
    if (!user) throw new Error('Not authenticated')
    const task = tasks.find((t) => t.id === taskId)
    if (!task) throw new Error('Задача не найдена')

    const patch = await buildStatusPatch(task, status)
    await updateDocument('tasks', taskId, patch)
    const next = patch.status as TaskStatus
    await notifyStatusSideEffects(task, next)
    return next
  }

  async function updateTask(
    taskId: string,
    data: {
      title?: string
      description?: string
      priority?: Task['priority']
      startDate?: string | null
      dueDate?: string | null
      status?: TaskStatus
      assignedTo?: string
      assignedToName?: string
      links?: TaskLink[]
    },
  ) {
    if (!user) throw new Error('Not authenticated')
    const task = tasks.find((t) => t.id === taskId)
    if (!task) throw new Error('Задача не найдена')

    const payload: Record<string, unknown> = { ...data }
    if (data.status !== undefined) {
      const patch = await buildStatusPatch(task, data.status)
      Object.assign(payload, patch)
      await updateDocument('tasks', taskId, payload)
      await notifyStatusSideEffects(task, patch.status as TaskStatus)
      return
    }
    await updateDocument('tasks', taskId, payload)
  }

  async function deleteTask(taskId: string) {
    await removeDocument('tasks', taskId)
  }

  return {
    tasks,
    loading,
    error,
    createTasks,
    setStatus,
    updateTask,
    deleteTask,
  }
}
