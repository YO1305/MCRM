import { updateDocument } from '@/firebase/firestore'
import type { Client } from '@/types/client.types'
import { resolveLastTouchDate } from '@/utils/dateUtils'
import { stageIsClosed, stageIsWon } from '@/constants/clientStages'

export type BackfillLastTouchResult = {
  updated: number
  skipped: number
  errors: number
}

/** Fill missing lastTouchDate from openedDate / stage change / createdAt. */
export async function backfillLastTouchDates(clients: Client[]): Promise<BackfillLastTouchResult> {
  let updated = 0
  let skipped = 0
  let errors = 0

  for (const client of clients) {
    if (stageIsWon(client.stage) || stageIsClosed(client.stage)) {
      skipped += 1
      continue
    }
    if (client.lastTouchDate && /^\d{4}-\d{2}-\d{2}$/.test(client.lastTouchDate)) {
      skipped += 1
      continue
    }
    const resolved = resolveLastTouchDate(client)
    if (!resolved) {
      skipped += 1
      continue
    }
    try {
      await updateDocument('clients', client.id, { lastTouchDate: resolved })
      updated += 1
    } catch (err) {
      console.error('backfill lastTouchDate failed', client.id, err)
      errors += 1
    }
  }

  return { updated, skipped, errors }
}
