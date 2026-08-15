import { createDocument, updateDocument } from '@/firebase/firestore'
import { stageIsClosed, stageIsWon } from '@/constants/clientStages'
import type { Client } from '@/types/client.types'
import { activityPatch } from '@/utils/leadActivity'
import { todayISO } from '@/utils/dates'

export type ClearStaleOverduesResult = {
  clearedContacts: number
  clearedSteps: number
  errors: number
}

/**
 * Clears overdue nextContactDate and unfinished overdue next steps on open leads.
 * Needed once after "Шаг выполнен" was added — old deadlines hung forever.
 */
export async function clearStaleOverdueDeadlines(
  clients: Client[],
  author: { id: string; name: string },
): Promise<ClearStaleOverduesResult> {
  const today = todayISO()
  let clearedContacts = 0
  let clearedSteps = 0
  let errors = 0

  for (const client of clients) {
    if (stageIsWon(client.stage) || stageIsClosed(client.stage)) continue

    const hasStep = Boolean(client.nextStep?.trim())
    const stepOverdue = hasStep && !!client.nextStepDeadline && client.nextStepDeadline < today
    const contactOverdue =
      !!client.nextContactDate && client.nextContactDate < today

    if (!stepOverdue && !contactOverdue) continue

    const patch: Record<string, unknown> = {}
    const historyParts: string[] = []

    if (stepOverdue) {
      patch.nextStep = null
      patch.nextStepDeadline = null
      historyParts.push(
        `Снят просроченный шаг (до кнопки «Шаг выполнен»): ${client.nextStep}` +
          (client.nextStepDeadline ? ` · срок ${client.nextStepDeadline}` : ''),
      )
    }

    if (contactOverdue) {
      patch.nextContactDate = null
      historyParts.push(`Снята просроченная дата контакта: ${client.nextContactDate}`)
    }

    try {
      await updateDocument('clients', client.id, activityPatch(client, patch, {}))
      if (stepOverdue) clearedSteps += 1
      if (contactOverdue) clearedContacts += 1
      await createDocument('client_history', {
        clientId: client.id,
        type: 'next_step',
        text: historyParts.join('. '),
        fromStage: null,
        toStage: null,
        authorId: author.id,
        authorName: author.name,
      })
    } catch (err) {
      console.error('clearStaleOverdue failed', client.id, err)
      errors += 1
    }
  }

  return { clearedContacts, clearedSteps, errors }
}
