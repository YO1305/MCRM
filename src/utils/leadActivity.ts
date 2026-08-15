import { stageIsClosed, stageIsWon } from '@/constants/clientStages'
import type { ActivityStatus, Client } from '@/types/client.types'
import { calculateActiveMonths, daysDiff, resolveOpenedMonthFromClient } from '@/utils/dateUtils'
import { todayISO } from '@/utils/dates'

export function resolveOpenedMonth(
  client: Pick<Client, 'openedDate' | 'openedMonth' | 'createdAt'>,
): string {
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
  openedDate: string
  openedMonth: string
  activityStatus: ActivityStatus
  activeMonthsCount: number
} {
  const openedMonth =
    (client.openedDate && /^\d{4}-\d{2}-\d{2}$/.test(client.openedDate)
      ? client.openedDate.slice(0, 7)
      : null) ||
    (client.openedMonth && /^\d{4}-\d{2}$/.test(client.openedMonth) ? client.openedMonth : null) ||
    resolveOpenedMonth(client)
  const openedDate =
    (client.openedDate && /^\d{4}-\d{2}-\d{2}$/.test(client.openedDate)
      ? client.openedDate
      : null) || `${openedMonth}-01`
  const merged = { ...client, openedDate, openedMonth }
  return {
    openedDate,
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
  let openedDate =
    typeof extra.openedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(extra.openedDate)
      ? extra.openedDate
      : client?.openedDate || null
  let openedMonth =
    (typeof extra.openedMonth === 'string' && extra.openedMonth) ||
    (openedDate ? openedDate.slice(0, 7) : null) ||
    (client ? resolveOpenedMonth(client) : resolveOpenedMonthFromClient({}))

  if (typeof extra.openedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(extra.openedDate)) {
    openedMonth = extra.openedDate.slice(0, 7)
  }

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
    openedDate: openedDate || `${openedMonth}-01`,
    openedMonth,
    lastTouchDate,
    lastStageChangeDate,
  } as Client

  return {
    ...extra,
    openedDate: merged.openedDate,
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
