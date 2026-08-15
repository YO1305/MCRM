import { useCallback, useEffect, useMemo, useState } from 'react'
import { where } from 'firebase/firestore'
import { subscribeToCollection, updateDocument } from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import type { AiTask } from '@/types/aiTask.types'
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
  const [tasks, setTasks] = useState<AiTask[]>([])
  const [loading, setLoading] = useState(true)

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

  const pending = useMemo(
    () => tasks.filter((t) => t.status === 'pending'),
    [tasks],
  )

  const pendingCount = pending.length

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

  return {
    tasks,
    pending,
    pendingCount,
    loading,
    markDone,
    snooze,
  }
}
