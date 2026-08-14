import { useEffect, useState } from 'react'
import {
  createSubdocument,
  subscribeToSubcollection,
} from '@/firebase/firestore'
import { auth } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import type { TaskComment } from '@/types/taskComment.types'

export function useTaskComments(taskId: string | null) {
  const { user } = useAuth()
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading, setLoading] = useState(!!taskId)

  useEffect(() => {
    if (!taskId) {
      setComments([])
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = subscribeToSubcollection<TaskComment>(
      'tasks',
      taskId,
      'comments',
      (data) => {
        const sorted = [...data].sort((a, b) => {
          const at = (a.createdAt as { seconds?: number } | null)?.seconds ?? 0
          const bt = (b.createdAt as { seconds?: number } | null)?.seconds ?? 0
          return at - bt
        })
        setComments(sorted)
        setLoading(false)
      },
      () => setLoading(false),
    )

    return unsubscribe
  }, [taskId])

  async function addComment(text: string) {
    const uid = auth.currentUser?.uid
    if (!uid || !taskId) throw new Error('Not ready')
    const trimmed = text.trim()
    if (!trimmed) return
    await createSubdocument('tasks', taskId, 'comments', {
      text: trimmed,
      // Must match request.auth.uid in Firestore rules
      authorId: uid,
      authorName: user?.name || auth.currentUser?.displayName || 'Сотрудник',
    })
  }

  return { comments, loading, addComment }
}
