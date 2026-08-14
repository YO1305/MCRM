import { useCallback, useEffect, useMemo, useState } from 'react'
import { where } from 'firebase/firestore'
import {
  subscribeToCollection,
  updateDocument,
  setDocumentIfMissing,
  createDocument,
} from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import type { AppNotification, NotificationType } from '@/types/notification.types'
import { todayISO } from '@/utils/dates'
import type { Task } from '@/types/task.types'

function notifId(dedupeKey: string) {
  return dedupeKey.replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 700)
}

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setNotifications([])
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = subscribeToCollection<AppNotification>(
      'notifications',
      [where('userId', '==', user.id)],
      (data) => {
        const sorted = [...data].sort((a, b) => {
          const at = (a.createdAt as { seconds?: number } | null)?.seconds ?? 0
          const bt = (b.createdAt as { seconds?: number } | null)?.seconds ?? 0
          return bt - at
        })
        setNotifications(sorted)
        setLoading(false)
      },
      () => setLoading(false),
    )

    return unsubscribe
  }, [user])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  const notify = useCallback(
    async (params: {
      userId: string
      type: NotificationType
      title: string
      body: string
      taskId?: string | null
      clientId?: string | null
      link?: string | null
      dedupeKey?: string | null
    }) => {
      const payload = {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        taskId: params.taskId || null,
        clientId: params.clientId || null,
        link: params.link || null,
        dedupeKey: params.dedupeKey || null,
        read: false,
      }
      if (params.dedupeKey) {
        await setDocumentIfMissing('notifications', notifId(params.dedupeKey), payload)
      } else {
        await createDocument('notifications', payload)
      }
    },
    [],
  )

  async function markRead(id: string) {
    await updateDocument('notifications', id, { read: true })
  }

  async function markAllRead() {
    await Promise.all(
      notifications
        .filter((n) => !n.read)
        .map((n) => updateDocument('notifications', n.id, { read: true })),
    )
  }

  const scanOverdue = useCallback(
    async (tasks: Task[], adminIds: string[]) => {
      if (!user) return
      const today = todayISO()

      for (const task of tasks) {
        if (task.status === 'done') continue
        if (!task.dueDate || task.dueDate >= today) continue

        const recipientIds = new Set<string>([task.assignedTo, ...adminIds])
        for (const uid of recipientIds) {
          const dedupeKey = `overdue:${task.id}:${uid}:${today}`
          try {
            await notify({
              userId: uid,
              type: 'task_overdue',
              title: 'Просрочена задача',
              body: `«${task.title}» · ${task.assignedToName} · срок ${task.dueDate}`,
              taskId: task.id,
              dedupeKey,
            })
          } catch (err) {
            console.error('overdue notify failed', err)
          }
        }
      }
    },
    [user, notify],
  )

  return {
    notifications,
    loading,
    unreadCount,
    notify,
    markRead,
    markAllRead,
    scanOverdue,
  }
}
