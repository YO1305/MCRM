import { stageIsClosed, stageIsWon } from '@/constants/clientStages'
import type { ActivityStatus, Client } from '@/types/client.types'
import { calculateActiveMonths, daysDiff, resolveLastTouchDate, resolveOpenedMonthFromClient } from '@/utils/dateUtils'
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

export type ActivityThresholds = {
  touchThresholdDays?: number
  movementThresholdDays?: number
  maxActiveMonths?: number
}

export function calculateActivityStatus(
  client: Client,
  today: Date = new Date(),
  thresholds?: ActivityThresholds,
): ActivityStatus {
  if (isLeadFinal(client.stage)) {
    return client.activityStatus || 'active'
  }

  const touchLimit = thresholds?.touchThresholdDays ?? 14
  const movementLimit = thresholds?.movementThresholdDays ?? 45
  const maxMonths = thresholds?.maxActiveMonths ?? 3

  const openedMonth = resolveOpenedMonth(client)
  const activeMonths = calculateActiveMonths(openedMonth)

  if (activeMonths >= maxMonths + 1) return 'frozen'
  if (activeMonths === 1) return 'new'

  const todayISOStr = todayISO()
  const daysSinceTouch = daysDiff(resolveLastTouchDate(client), today)
  const nextStepOverdue = !client.nextStepDeadline || client.nextStepDeadline < todayISOStr
  const daysSinceMovement = daysDiff(client.lastStageChangeDate, today)

  const failedCount = [
    daysSinceTouch != null && daysSinceTouch > touchLimit,
    nextStepOverdue,
    daysSinceMovement != null && daysSinceMovement > movementLimit,
  ].filter(Boolean).length

  if (failedCount === 0) return 'active'
  if (failedCount === 1) return 'critical'
  return 'frozen'
}

export function resolveActivityStatus(
  client: Client,
  thresholds?: ActivityThresholds,
): ActivityStatus {
  return calculateActivityStatus(client, new Date(), thresholds)
}

export function buildActivityFields(
  client: Client,
  thresholds?: ActivityThresholds,
): {
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
    activityStatus: calculateActivityStatus(merged, new Date(), thresholds),
    activeMonthsCount: calculateActiveMonths(openedMonth),
  }
}

export function activityPatch(
  client: Client | undefined,
  extra: Record<string, unknown>,
  opts?: { movement?: boolean; touch?: boolean; thresholds?: ActivityThresholds },
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
    activityStatus: calculateActivityStatus(merged, new Date(), opts?.thresholds),
    activeMonthsCount: calculateActiveMonths(openedMonth),
  }
}

export function countLeadActivity(clients: Client[], thresholds?: ActivityThresholds) {
  const counts = { new: 0, active: 0, critical: 0, frozen: 0 }
  for (const client of clients) {
    if (isLeadFinal(client.stage)) continue
    counts[resolveActivityStatus(client, thresholds)] += 1
  }
  return counts
}
