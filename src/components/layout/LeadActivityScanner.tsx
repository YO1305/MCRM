import { useEffect, useRef } from 'react'
import { updateDocument } from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/hooks/useClients'
import { useNotifications } from '@/hooks/useNotifications'
import { useUsers } from '@/hooks/useUsers'
import { useAiConfig } from '@/hooks/useAiConfig'
import {
  activityFieldsChanged,
  leadActivityNotices,
} from '@/utils/leadActivityNotify'
import { buildActivityFields, isLeadFinal } from '@/utils/leadActivity'
import { todayISO } from '@/utils/dates'

/**
 * Daily client-side recalculation of lead activity (works without Functions deploy).
 * Writes status when it changed and sends in-app notifications with dedupe keys.
 */
export function LeadActivityScanner() {
  const { user, viewAsUser } = useAuth()
  const { clients, loading } = useClients()
  const { users, loading: usersLoading } = useUsers(!!user)
  const { config } = useAiConfig()
  const { notify } = useNotifications()
  const scanned = useRef('')

  useEffect(() => {
    if (!user || viewAsUser || loading || usersLoading) return
    const today = todayISO()
    const storageKey = `leadActivityScan:v4:${user.id}:${today}`
    const runKey = `${today}:${clients.length}:${config?.touchThresholdDays}:${config?.movementThresholdDays}:${config?.maxActiveMonths}`
    if (scanned.current === runKey) return
    if (typeof localStorage !== 'undefined' && localStorage.getItem(storageKey) === '1') {
      scanned.current = runKey
      return
    }
    scanned.current = runKey

    const adminIds = users
      .filter((u) => u.isActive !== false && (u.role === 'admin' || u.position === 'head'))
      .map((u) => u.id)

    const thresholds = {
      touchThresholdDays: config?.touchThresholdDays,
      movementThresholdDays: config?.movementThresholdDays,
      maxActiveMonths: config?.maxActiveMonths,
    }

    void (async () => {
      let writes = 0
      const maxWrites = 25
      for (const client of clients) {
        if (isLeadFinal(client.stage)) continue
        const fields = buildActivityFields(client, thresholds)
        if (activityFieldsChanged(client, fields) && writes < maxWrites) {
          try {
            await updateDocument('clients', client.id, fields)
            writes += 1
          } catch (err) {
            console.error('lead activity update failed', err)
          }
        }
        const notices = leadActivityNotices(client, fields.activityStatus, adminIds)
        for (const n of notices) {
          try {
            await notify(n)
          } catch (err) {
            console.error('lead activity notify failed', err)
          }
        }
      }
      try {
        localStorage.setItem(storageKey, '1')
      } catch {
        /* ignore quota / private mode */
      }
    })()
  }, [user, viewAsUser, loading, usersLoading, clients, users, notify, config])

  return null
}
