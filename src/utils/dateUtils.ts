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

export function openedMonthFromCreatedAt(createdAt: unknown): string {
  const seconds = (createdAt as { seconds?: number } | null)?.seconds
  if (seconds) return getCurrentMonth(new Date(seconds * 1000))
  return getCurrentMonth()
}

export { todayISO, parseISODate }
