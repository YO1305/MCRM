import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { updateDocument } from '@/firebase/firestore'
import type { Client } from '@/types/client.types'
import { openedDateFromCreatedAt } from '@/utils/dateUtils'
import { buildActivityFields, isLeadFinal } from '@/utils/leadActivity'

async function earliestHistoryDate(clientId: string): Promise<string | null> {
  const q = query(
    collection(db, 'client_history'),
    where('clientId', '==', clientId),
    orderBy('createdAt', 'asc'),
    limit(1),
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  return openedDateFromCreatedAt(snap.docs[0].data().createdAt)
}

/**
 * Sets openedDate/openedMonth from the earliest history entry (or createdAt),
 * then recalculates activityStatus.
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
      const fromHistory = await earliestHistoryDate(client.id)
      const nextDate =
        fromHistory ||
        openedDateFromCreatedAt(client.createdAt) ||
        client.openedDate ||
        (client.openedMonth ? `${client.openedMonth}-01` : null)
      if (!nextDate) {
        skipped += 1
        continue
      }
      const nextMonth = nextDate.slice(0, 7)
      if (
        !overwrite &&
        client.openedDate === nextDate &&
        client.openedMonth === nextMonth
      ) {
        skipped += 1
        continue
      }
      const fields = buildActivityFields({
        ...client,
        openedDate: nextDate,
        openedMonth: nextMonth,
      })
      await updateDocument('clients', client.id, fields)
      updated += 1
    } catch (err) {
      console.error('sync openedDate failed', client.id, err)
      errors += 1
    }
  }

  return { updated, skipped, errors }
}
