import { addDaysISO, getCurrentMonth, parseISODate, toISODate, todayISO } from '@/utils/dates'

/** Last day of YYYY-MM as ISO date. */
export function lastDayOfMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m, 0) // day 0 of next month = last of this
  return toISODate(d)
}

/** Clamp day-of-month into the given month. */
export function dateInMonth(monthKey: string, dayOfMonth: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  const day = Math.min(Math.max(1, dayOfMonth), last)
  return toISODate(new Date(y, m - 1, day))
}

export function prevMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return getCurrentMonth(d)
}

export function nextMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m, 1)
  return getCurrentMonth(d)
}

export function isSubtaskOverdue(
  dueDate: string | null,
  status: string,
  today = todayISO(),
): boolean {
  if (!dueDate) return false
  if (status === 'done' || status === 'pending_confirm') return false
  return dueDate < today
}

/** Shift due date into target month, keeping day-of-month when possible. */
export function carryDueDate(dueDate: string | null, targetMonth: string): string | null {
  if (!dueDate) return lastDayOfMonth(targetMonth)
  const d = parseISODate(dueDate)
  return dateInMonth(targetMonth, d.getDate())
}

export function monthLabel(monthKey: string): string {
  const d = parseISODate(`${monthKey}-01`)
  return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

export { todayISO, getCurrentMonth, addDaysISO }
