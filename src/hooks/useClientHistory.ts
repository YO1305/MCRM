import { useEffect, useState } from 'react'
import { where } from 'firebase/firestore'
import { subscribeToCollection } from '@/firebase/firestore'
import type { ClientHistoryEntry } from '@/types/client.types'

export function useClientHistory(clientId: string | null) {
  const [entries, setEntries] = useState<ClientHistoryEntry[]>([])
  const [loading, setLoading] = useState(!!clientId)

  useEffect(() => {
    if (!clientId) {
      setEntries([])
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = subscribeToCollection<ClientHistoryEntry>(
      'client_history',
      [where('clientId', '==', clientId)],
      (data) => {
        const sorted = [...data].sort((a, b) => {
          const at = (a.createdAt as { seconds?: number } | null)?.seconds ?? 0
          const bt = (b.createdAt as { seconds?: number } | null)?.seconds ?? 0
          return bt - at
        })
        setEntries(sorted)
        setLoading(false)
      },
      () => setLoading(false),
    )

    return unsubscribe
  }, [clientId])

  return { entries, loading }
}
