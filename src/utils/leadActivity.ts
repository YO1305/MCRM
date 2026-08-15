import { stageIsClosed, stageIsWon } from '@/constants/clientStages'
import type { ActivityStatus, Client } from '@/types/client.types'
import { calculateActiveMonths, daysDiff, resolveOpenedMonthFromClient } from '@/utils/dateUtils'
import { todayISO } from '@/utils/dates'

export function resolveOpenedMonth(client: Pick<Client, 'openedMonth' | 'createdAt'>): string {
  return resolveOpenedMonthFromClient(client)
}

export function isLeadFinal(stage: string | null | undefined): boolean {
  return stageIsWon(stage) || stageIsClosed(stage)
}

export function canSeeLeadActivity(user?: { role?: string; position?: string } | null): boolean {
  if (!user) return false
  return user.role === 'admin' || user.position === 'head'
}

export function calculateActivityStatus(
  client: Client,
  today: Date = new Date(),
): ActivityStatus {
  if (isLeadFinal(client.stage)) {
    return client.activityStatus || 'active'
  }

  const openedMonth = resolveOpenedMonth(client)
  const activeMonths = calculateActiveMonths(openedMonth)

  if (activeMonths >= 4) return 'frozen'
  if (activeMonths === 1) return 'new'

  const todayISOStr = todayISO()
  const daysSinceTouch = daysDiff(client.lastTouchDate, today)
  const nextStepOverdue = !client.nextStepDeadline || client.nextStepDeadline < todayISOStr
  const daysSinceMovement = daysDiff(client.lastStageChangeDate, today)

  const failedCount = [
    daysSinceTouch > 14,
    nextStepOverdue,
    daysSinceMovement > 45,
  ].filter(Boolean).length

  if (failedCount === 0) return 'active'
  if (failedCount === 1) return 'critical'
  return 'frozen'
}

export function resolveActivityStatus(client: Client): ActivityStatus {
  return calculateActivityStatus(client)
}

export function buildActivityFields(client: Client): {
  openedMonth: string
  activityStatus: ActivityStatus
  activeMonthsCount: number
} {
  // Keep an already saved openedMonth — do not reset it from CRM import date.
  const openedMonth =
    client.openedMonth && /^\d{4}-\d{2}$/.test(client.openedMonth)
      ? client.openedMonth
      : resolveOpenedMonth(client)
  const merged = { ...client, openedMonth }
  return {
    openedMonth,
    activityStatus: calculateActivityStatus(merged),
    activeMonthsCount: calculateActiveMonths(openedMonth),
  }
}

export function activityPatch(
  client: Client | undefined,
  extra: Record<string, unknown>,
  opts?: { movement?: boolean; touch?: boolean },
): Record<string, unknown> {
  const today = todayISO()
  const openedMonth =
    (typeof extra.openedMonth === 'string' && extra.openedMonth) ||
    (client ? resolveOpenedMonth(client) : resolveOpenedMonthFromClient({}))

  const lastTouchDate = opts?.touch || opts?.movement
    ? today
    : ((extra.lastTouchDate as string | null | undefined) ?? client?.lastTouchDate ?? null)
  const lastStageChangeDate = opts?.movement
    ? today
    : ((extra.lastStageChangeDate as string | null | undefined) ??
      client?.lastStageChangeDate ??
      null)

  const merged = {
    ...(client || ({} as Client)),
    ...extra,
    openedMonth,
    lastTouchDate,
    lastStageChangeDate,
  } as Client

  return {
    ...extra,
    openedMonth,
    ...(opts?.touch || opts?.movement ? { lastTouchDate: today } : {}),
    ...(opts?.movement ? { lastStageChangeDate: today } : {}),
    activityStatus: calculateActivityStatus(merged),
    activeMonthsCount: calculateActiveMonths(openedMonth),
  }
}

export function countLeadActivity(clients: Client[]) {
  const counts = { new: 0, active: 0, critical: 0, frozen: 0 }
  for (const client of clients) {
    if (isLeadFinal(client.stage)) continue
    counts[resolveActivityStatus(client)] += 1
  }
  return counts
}
