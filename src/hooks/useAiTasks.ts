import { useCallback, useEffect, useMemo, useState } from 'react'
import { where } from 'firebase/firestore'
import { subscribeToCollection, updateDocument, removeDocument } from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/hooks/useClients'
import { useAiConfig } from '@/hooks/useAiConfig'
import type { AiTask } from '@/types/aiTask.types'
import {
  clientHasPlannedNextStep,
  clientShouldSkipAiWhileWaiting,
} from '@/types/aiTask.types'
import { dismissPendingAiTasksForClient } from '@/utils/aiTasks'
import { addDaysISO, todayISO } from '@/utils/dates'

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

  const hiddenClientIds = useMemo(() => {
    const set = new Set<string>()
    for (const c of clients) {
      if (clientHasPlannedNextStep(c)) set.add(c.id)
      else if (clientShouldSkipAiWhileWaiting(c, today, graceDays)) set.add(c.id)
    }
    return set
  }, [clients, today, graceDays])

  /** Pending AI tasks, excluding clients with planned next step / waiting grace. */
  const pending = useMemo(
    () =>
      tasks.filter(
        (t) => t.status === 'pending' && !hiddenClientIds.has(t.clientId),
      ),
    [tasks, hiddenClientIds],
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
