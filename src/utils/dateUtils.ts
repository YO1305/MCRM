import { daysBetween, getCurrentMonth, parseISODate, todayISO, toISODate } from '@/utils/dates'

/** Days between YYYY-MM-DD and a Date. Null = very old. */
export function daysDiff(fromDate: string | null | undefined, toDate: Date = new Date()): number {
  if (!fromDate) return 999
  return daysBetween(fromDate, toISODate(toDate))
}

/** Whole months between "YYYY-MM" and today (0-based). */
export function monthDiff(openedMonth: string | null | undefined, today: Date = new Date()): number {
  if (!openedMonth) return 0
  const [year, month] = openedMonth.split('-').map(Number)
  const opened = new Date(year, (month || 1) - 1, 1)
  return (today.getFullYear() - opened.getFullYear()) * 12 + (today.getMonth() - opened.getMonth())
}

export function calculateActiveMonths(openedMonth: string | null | undefined): number {
  if (!openedMonth) return 1
  return Math.min(monthDiff(openedMonth, new Date()) + 1, 99)
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

/** Prefer real createdAt so a bad openedMonth stamp cannot lock everyone as "new". */
export function resolveOpenedMonthFromClient(client: {
  openedMonth?: string | null
  createdAt?: unknown
}): string {
  return openedMonthFromCreatedAt(client.createdAt) || client.openedMonth || getCurrentMonth()
}

export { todayISO, parseISODate }
