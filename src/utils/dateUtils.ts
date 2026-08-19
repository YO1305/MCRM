import { daysBetween, getCurrentMonth, parseISODate, todayISO, toISODate } from '@/utils/dates'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const ISO_MONTH = /^\d{4}-\d{2}$/

function isIsoDay(value: string | null | undefined): value is string {
  return Boolean(value && ISO_DAY.test(value))
}

type OpenedDateSource = {
  lastTouchDate?: string | null
  lastStageChangeDate?: string | null
  openedDate?: string | null
  openedMonth?: string | null
  createdAt?: unknown
}

/**
 * Days between YYYY-MM-DD and a Date.
 * Missing/invalid date is treated as today (0), never a fake "999 days".
 */
export function daysDiff(fromDate: string | null | undefined, toDate: Date = new Date()): number {
  const today = toISODate(toDate)
  if (!isIsoDay(fromDate)) return 0
  return Math.max(0, daysBetween(fromDate, today))
}

/** Last real contact: lastTouchDate, else lead open / created date. */
export function resolveTouchDate(
  client: OpenedDateSource,
  extra?: { historyDate?: string | null },
): string {
  if (isIsoDay(client.lastTouchDate)) return client.lastTouchDate
  if (isIsoDay(extra?.historyDate)) return extra.historyDate
  return resolveOpenedDateFromClient(client)
}

/** Last funnel movement: lastStageChangeDate, else lead open / created date. */
export function resolveMovementDate(client: OpenedDateSource): string {
  if (isIsoDay(client.lastStageChangeDate)) return client.lastStageChangeDate
  return resolveOpenedDateFromClient(client)
}

export function daysSinceTouch(
  client: OpenedDateSource,
  toDate: Date = new Date(),
  extra?: { historyDate?: string | null },
): number {
  return daysDiff(resolveTouchDate(client, extra), toDate)
}

export function daysSinceMovement(client: OpenedDateSource, toDate: Date = new Date()): number {
  return daysDiff(resolveMovementDate(client), toDate)
}

/** Whole months between "YYYY-MM" and today (0-based). */
export function monthDiff(openedMonth: string | null | undefined, today: Date = new Date()): number {
  if (!openedMonth) return 0
  const [year, month] = openedMonth.split('-').map(Number)
  const opened = new Date(year, (month || 1) - 1, 1)
  return (today.getFullYear() - opened.getFullYear()) * 12 + (today.getMonth() - opened.getMonth())
}

export function calculateActiveMonths(openedMonthOrDate: string | null | undefined): number {
  if (!openedMonthOrDate) return 1
  const monthKey =
    openedMonthOrDate.length >= 10 ? openedMonthOrDate.slice(0, 7) : openedMonthOrDate
  return Math.min(monthDiff(monthKey, new Date()) + 1, 99)
}

export function formatDate(date: Date = new Date()): string {
  return toISODate(date)
}

export function openedMonthFromCreatedAt(createdAt: unknown): string | null {
  if (!createdAt) return null

  if (typeof createdAt === 'string' && createdAt.length >= 7) {
    return createdAt.slice(0, 7)
  }

  if (typeof createdAt === 'object' && createdAt !== null) {
    const withToDate = createdAt as { toDate?: () => Date }
    if (typeof withToDate.toDate === 'function') {
      try {
        return getCurrentMonth(withToDate.toDate())
      } catch {
        /* fall through */
      }
    }
    const seconds =
      (createdAt as { seconds?: number }).seconds ??
      (createdAt as { _seconds?: number })._seconds
    if (typeof seconds === 'number') {
      return getCurrentMonth(new Date(seconds * 1000))
    }
  }

  return null
}

export function openedDateFromCreatedAt(createdAt: unknown): string | null {
  if (!createdAt) return null
  if (typeof createdAt === 'string' && createdAt.length >= 10) {
    return createdAt.slice(0, 10)
  }
  if (typeof createdAt === 'object' && createdAt !== null) {
    const withToDate = createdAt as { toDate?: () => Date }
    if (typeof withToDate.toDate === 'function') {
      try {
        return toISODate(withToDate.toDate())
      } catch {
        /* fall through */
      }
    }
    const seconds =
      (createdAt as { seconds?: number }).seconds ??
      (createdAt as { _seconds?: number })._seconds
    if (typeof seconds === 'number') {
      return toISODate(new Date(seconds * 1000))
    }
  }
  return null
}

/** Prefer explicit openedDate / openedMonth (real lead start). */
export function resolveOpenedMonthFromClient(client: {
  openedDate?: string | null
  openedMonth?: string | null
  createdAt?: unknown
}): string {
  if (isIsoDay(client.openedDate)) {
    return client.openedDate.slice(0, 7)
  }
  if (client.openedMonth && ISO_MONTH.test(client.openedMonth)) {
    return client.openedMonth
  }
  return openedMonthFromCreatedAt(client.createdAt) || getCurrentMonth()
}

export function resolveOpenedDateFromClient(client: {
  openedDate?: string | null
  openedMonth?: string | null
  createdAt?: unknown
}): string {
  if (isIsoDay(client.openedDate)) {
    return client.openedDate
  }
  if (client.openedMonth && ISO_MONTH.test(client.openedMonth)) {
    return `${client.openedMonth}-01`
  }
  return openedDateFromCreatedAt(client.createdAt) || todayISO()
}

export { todayISO, parseISODate }
