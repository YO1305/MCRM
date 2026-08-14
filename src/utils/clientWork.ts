import type { Client } from '@/types/client.types'
import { addDaysISO, parseISODate, todayISO } from '@/utils/dates'

/** Active next-step deadline, otherwise next contact date. */
export function clientActionDeadline(client: Client): string | null {
  if (client.nextStep?.trim() && client.nextStepDeadline) return client.nextStepDeadline
  return client.nextContactDate || null
}

export function clientHasActiveStep(client: Client): boolean {
  return Boolean(client.nextStep?.trim())
}

export function clientStepOverdue(client: Client, today: string = todayISO()): boolean {
  if (!clientHasActiveStep(client) || !client.nextStepDeadline) return false
  return client.nextStepDeadline < today
}

/**
 * Remind 1 day before the visit. If that day is Sunday, remind on Saturday
 * so the manager still sees it on a working day.
 */
export function visitPrepareDate(visitISO: string): string {
  const oneBefore = addDaysISO(visitISO, -1)
  if (parseISODate(oneBefore).getDay() === 0) {
    return addDaysISO(oneBefore, -1)
  }
  return oneBefore
}

export function shouldRemindVisit(visitISO: string | null | undefined, today: string = todayISO()): boolean {
  if (!visitISO) return false
  if (today > visitISO) return false
  return today >= visitPrepareDate(visitISO)
}
