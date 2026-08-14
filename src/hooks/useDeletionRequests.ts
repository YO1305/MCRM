import { useEffect, useMemo, useState } from 'react'
import { where } from 'firebase/firestore'
import {
  subscribeToCollection,
  createDocument,
  updateDocument,
  removeDocument,
} from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import type { Client } from '@/types/client.types'
import type { DeletionRequest } from '@/types/deletionRequest.types'

export function useDeletionRequests() {
  const { user, isAdmin } = useAuth()
  const [requests, setRequests] = useState<DeletionRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setRequests([])
      setLoading(false)
      return
    }

    setLoading(true)
    const constraints = isAdmin ? [] : [where('requestedBy', '==', user.id)]

    const unsubscribe = subscribeToCollection<DeletionRequest>(
      'deletion_requests',
      constraints,
      (data) => {
        const sorted = [...data].sort((a, b) => {
          const as = (a.createdAt as { seconds?: number } | null)?.seconds || 0
          const bs = (b.createdAt as { seconds?: number } | null)?.seconds || 0
          return bs - as
        })
        setRequests(sorted)
        setLoading(false)
      },
      () => setLoading(false),
    )

    return unsubscribe
  }, [user, isAdmin])

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === 'pending').length,
    [requests],
  )

  async function requestDeletion(client: Client, reason: string) {
    if (!user) throw new Error('Not authenticated')
    const trimmed = reason.trim()
    if (!trimmed) throw new Error('Reason required')

    const existing = requests.find(
      (r) => r.clientId === client.id && r.status === 'pending',
    )
    if (existing) throw new Error('Already pending')

    const requestId = await createDocument('deletion_requests', {
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      reason: trimmed,
      requestedBy: user.id,
      requestedByName: user.name,
      status: 'pending',
      reviewedBy: null,
      reviewedByName: null,
      reviewNote: null,
    })

    // Notify all admins (users with role admin) — write generic notification;
    // admins filter by type in Requests page. Also create a notification for requester confirmation.
    await createDocument('notifications', {
      userId: user.id,
      type: 'deletion_request',
      title: 'Заявка на удаление отправлена',
      body: `Клиент «${client.name}» · ожидает решения админа`,
      read: false,
      meta: { requestId, clientId: client.id },
    })

    return requestId
  }

  async function approveAndDelete(request: DeletionRequest, reviewNote?: string) {
    if (!user || !isAdmin) throw new Error('Admin only')

    await removeDocument('clients', request.clientId)
    await updateDocument('deletion_requests', request.id, {
      status: 'approved',
      reviewedBy: user.id,
      reviewedByName: user.name,
      reviewNote: reviewNote?.trim() || null,
    })

    await createDocument('notifications', {
      userId: request.requestedBy,
      type: 'deletion_approved',
      title: 'Удаление одобрено',
      body: `Клиент «${request.clientName}» удалён админом`,
      read: false,
      meta: { requestId: request.id, clientId: request.clientId },
    })
  }

  async function rejectRequest(request: DeletionRequest, reviewNote?: string) {
    if (!user || !isAdmin) throw new Error('Admin only')

    await updateDocument('deletion_requests', request.id, {
      status: 'rejected',
      reviewedBy: user.id,
      reviewedByName: user.name,
      reviewNote: reviewNote?.trim() || null,
    })

    await createDocument('notifications', {
      userId: request.requestedBy,
      type: 'deletion_rejected',
      title: 'Удаление отклонено',
      body: `Заявка по «${request.clientName}» отклонена${
        reviewNote?.trim() ? `: ${reviewNote.trim()}` : ''
      }`,
      read: false,
      meta: { requestId: request.id, clientId: request.clientId },
    })
  }

  return {
    requests,
    loading,
    pendingCount,
    requestDeletion,
    approveAndDelete,
    rejectRequest,
  }
}
