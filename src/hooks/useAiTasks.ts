import { useCallback, useEffect, useMemo, useState } from 'react'
import { where } from 'firebase/firestore'
import { subscribeToCollection, updateDocument, removeDocument } from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/hooks/useClients'
import { useUsers } from '@/hooks/useUsers'
import { useAiConfig } from '@/hooks/useAiConfig'
import type { AiTask } from '@/types/aiTask.types'
import {
  clientHasPlannedNextStep,
  clientShouldSkipAiWhileWaiting,
} from '@/types/aiTask.types'
import { dismissPendingAiTasksForClient, dismissPendingAiTasksForManager } from '@/utils/aiTasks'
import { addDaysISO, todayISO } from '@/utils/dates'
import { isRecurringTasksPaused } from '@/utils/taskTemplates'

function sortAiTasks(data: AiTask[]) {
  return [...data].sort((a, b) => {
    const at = (a.generatedAt as { seconds?: number } | null)?.seconds ?? 0
    const bt = (b.generatedAt as { seconds?: number } | null)?.seconds ?? 0
    return bt - at
  })
}

export function useAiTasks() {
  const { user, isAdmin } = useAuth()
  const { clients } = useClients()
  const { users } = useUsers(!!user)
  const { config } = useAiConfig()
  const [tasks, setTasks] = useState<AiTask[]>([])
  const [loading, setLoading] = useState(true)
  const today = todayISO()
  const graceDays = config?.waitChaseMinDays ?? 5

  useEffect(() => {
    if (!user) {
      setTasks([])
      setLoading(false)
      return
    }

    setLoading(true)
    const constraints = isAdmin ? [] : [where('assignedTo', '==', user.id)]

    return subscribeToCollection<AiTask>(
      'ai_tasks',
      constraints,
      (data) => {
        setTasks(sortAiTasks(data))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [user, isAdmin])

  const vacationManagerIds = useMemo(() => {
    const set = new Set<string>()
    for (const u of users) {
      if (isRecurringTasksPaused(u, today)) set.add(u.id)
    }
    return set
  }, [users, today])

  const hiddenClientIds = useMemo(() => {
    const set = new Set<string>()
    for (const c of clients) {
      if (clientHasPlannedNextStep(c)) set.add(c.id)
      else if (clientShouldSkipAiWhileWaiting(c, today, graceDays)) set.add(c.id)
    }
    return set
  }, [clients, today, graceDays])

  /** Pending AI tasks, excluding planned next step / waiting grace / manager on vacation. */
  const pending = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status === 'pending' &&
          !hiddenClientIds.has(t.clientId) &&
          !vacationManagerIds.has(t.assignedTo),
      ),
    [tasks, hiddenClientIds, vacationManagerIds],
  )

  const pendingCount = pending.length

  // Auto-close leftover AI tasks when client already has next step / waiting grace
  useEffect(() => {
    if (!user || loading || !clients.length) return
    const leftoverIds = [
      ...new Set(
        tasks
          .filter((t) => t.status === 'pending' && hiddenClientIds.has(t.clientId))
          .map((t) => t.clientId),
      ),
    ]
    if (!leftoverIds.length) return
    void (async () => {
      for (const clientId of leftoverIds) {
        try {
          await dismissPendingAiTasksForClient(clientId)
        } catch (err) {
          console.error('dismiss ai tasks failed', clientId, err)
        }
      }
    })()
  }, [user, loading, clients.length, tasks, hiddenClientIds])

  // Auto-close AI tasks while manager is on vacation (same pause as daily tasks)
  useEffect(() => {
    if (!user || loading || !vacationManagerIds.size) return
    const managerIds = [...vacationManagerIds].filter((id) =>
      tasks.some((t) => t.status === 'pending' && t.assignedTo === id),
    )
    if (!managerIds.length) return
    void (async () => {
      for (const managerId of managerIds) {
        try {
          await dismissPendingAiTasksForManager(managerId)
        } catch (err) {
          console.error('dismiss ai tasks for vacation failed', managerId, err)
        }
      }
    })()
  }, [user, loading, tasks, vacationManagerIds])

  const markDone = useCallback(async (taskId: string) => {
    await updateDocument('ai_tasks', taskId, {
      status: 'done',
      doneAt: new Date().toISOString(),
    })
  }, [])

  const snooze = useCallback(async (taskId: string) => {
    const until = addDaysISO(todayISO(), 1)
    await updateDocument('ai_tasks', taskId, {
      status: 'snoozed',
      snoozedUntil: until,
    })
  }, [])

  const removeTask = useCallback(async (taskId: string) => {
    await removeDocument('ai_tasks', taskId)
  }, [])

  return {
    tasks,
    pending,
    pendingCount,
    loading,
    markDone,
    snooze,
    removeTask,
  }
}
