import { daysBetween, getCurrentMonth, parseISODate, todayISO, toISODate } from '@/utils/dates'

/** Days between YYYY-MM-DD and a Date. Null fromDate = unknown (not 999). */
export function daysDiff(fromDate: string | null | undefined, toDate: Date = new Date()): number | null {
  if (!fromDate || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) return null
  return daysBetween(fromDate, toISODate(toDate))
}

/** Best guess for “last contact” when lastTouchDate was never backfilled. */
export function resolveLastTouchDate(
  client: {
    lastTouchDate?: string | null
    lastStageChangeDate?: string | null
    openedDate?: string | null
    openedMonth?: string | null
    createdAt?: unknown
  },
  historyDates?: (string | null | undefined)[],
): string | null {
  if (client.lastTouchDate && /^\d{4}-\d{2}-\d{2}$/.test(client.lastTouchDate)) {
    return client.lastTouchDate
  }
  if (client.lastStageChangeDate && /^\d{4}-\d{2}-\d{2}$/.test(client.lastStageChangeDate)) {
    return client.lastStageChangeDate
  }
  if (client.openedDate && /^\d{4}-\d{2}-\d{2}$/.test(client.openedDate)) {
    return client.openedDate
  }
  if (client.openedMonth && /^\d{4}-\d{2}$/.test(client.openedMonth)) {
    return `${client.openedMonth}-01`
  }
  const fromCreated = openedDateFromCreatedAt(client.createdAt)
  if (fromCreated) return fromCreated
  if (historyDates?.length) {
    const valid = historyDates.filter(
      (d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d),
    )
    if (valid.length) return valid.sort().reverse()[0]
  }
  return null
}

export function daysSinceLastTouch(
  client: Parameters<typeof resolveLastTouchDate>[0],
  toDate: Date = new Date(),
  historyDates?: (string | null | undefined)[],
): number | null {
  const touch = resolveLastTouchDate(client, historyDates)
  if (!touch) return null
  return daysDiff(touch, toDate)
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
  if (client.openedDate && /^\d{4}-\d{2}-\d{2}$/.test(client.openedDate)) {
    return client.openedDate.slice(0, 7)
  }
  if (client.openedMonth && /^\d{4}-\d{2}$/.test(client.openedMonth)) {
    return client.openedMonth
  }
  return openedMonthFromCreatedAt(client.createdAt) || getCurrentMonth()
}

export function resolveOpenedDateFromClient(client: {
  openedDate?: string | null
  openedMonth?: string | null
  createdAt?: unknown
}): string {
  if (client.openedDate && /^\d{4}-\d{2}-\d{2}$/.test(client.openedDate)) {
    return client.openedDate
  }
  if (client.openedMonth && /^\d{4}-\d{2}$/.test(client.openedMonth)) {
    return `${client.openedMonth}-01`
  }
  return openedDateFromCreatedAt(client.createdAt) || todayISO()
}

export { todayISO, parseISODate }
