/** YYYY-MM-DD in local timezone */
export function todayISO(): string {
  return toISODate(new Date())
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Current month as "YYYY-MM", e.g. "2026-07" */
export function getCurrentMonth(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Early in a new month payroll still looks at the previous month. */
export function getPayrollMonth(d: Date = new Date()): string {
  if (d.getDate() <= 12) {
    return getCurrentMonth(new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }
  return getCurrentMonth(d)
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function formatISODateShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = parseISODate(fromISO).getTime()
  const b = parseISODate(toISO).getTime()
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}

export function monthsBetween(fromISO: string, toISO: string): number {
  const a = parseISODate(fromISO)
  const b = parseISODate(toISO)
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}
