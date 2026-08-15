import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { updateDocument } from '@/firebase/firestore'
import type { Client } from '@/types/client.types'
import { openedMonthFromCreatedAt } from '@/utils/dateUtils'
import { buildActivityFields, isLeadFinal } from '@/utils/leadActivity'

async function earliestHistoryMonth(clientId: string): Promise<string | null> {
  const q = query(
    collection(db, 'client_history'),
    where('clientId', '==', clientId),
    orderBy('createdAt', 'asc'),
    limit(1),
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  return openedMonthFromCreatedAt(snap.docs[0].data().createdAt)
}

/**
 * Sets openedMonth from the earliest history entry (or createdAt),
 * then recalculates activityStatus. Use when CRM import dates are wrong.
 */
export async function syncOpenedMonthsFromHistory(
  clients: Client[],
  opts?: { overwrite?: boolean },
): Promise<{ updated: number; skipped: number; errors: number }> {
  const overwrite = opts?.overwrite !== false
  let updated = 0
  let skipped = 0
  let errors = 0

  for (const client of clients) {
    if (isLeadFinal(client.stage)) {
      skipped += 1
      continue
    }
    try {
      const fromHistory = await earliestHistoryMonth(client.id)
      const nextMonth =
        fromHistory ||
        openedMonthFromCreatedAt(client.createdAt) ||
        client.openedMonth ||
        null
      if (!nextMonth) {
        skipped += 1
        continue
      }
      if (!overwrite && client.openedMonth === nextMonth) {
        skipped += 1
        continue
      }
      const fields = buildActivityFields({ ...client, openedMonth: nextMonth })
      await updateDocument('clients', client.id, fields)
      updated += 1
    } catch (err) {
      console.error('sync openedMonth failed', client.id, err)
      errors += 1
    }
  }

  return { updated, skipped, errors }
}
