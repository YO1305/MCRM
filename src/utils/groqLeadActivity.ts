import type { GroqActivityLabel } from '@/types/aiActivity.types'
import type { Client, ClientHistoryEntry, ClientHistoryType } from '@/types/client.types'
import { getCurrentMonth } from '@/utils/dates'

const FULL_WEIGHT: ClientHistoryType[] = [
  'note',
  'call',
  'sales_note',
  'stage_change',
  'wait_status',
  'next_step',
  'visit',
]

const SKIP_TYPES: ClientHistoryType[] = ['created']

function historyDay(createdAt: unknown): string | null {
  if (!createdAt) return null
  if (typeof createdAt === 'string' && createdAt.length >= 10) return createdAt.slice(0, 10)
  let d: Date | null = null
  if (typeof createdAt === 'object' && createdAt !== null) {
    const withToDate = createdAt as { toDate?: () => Date }
    if (typeof withToDate.toDate === 'function') {
      try {
        d = withToDate.toDate()
      } catch {
        d = null
      }
    }
    if (!d) {
      const seconds =
        (createdAt as { seconds?: number }).seconds ??
        (createdAt as { _seconds?: number })._seconds
      if (typeof seconds === 'number') d = new Date(seconds * 1000)
    }
  }
  if (!d) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isPauseText(value: string | null | undefined): boolean {
  const text = String(value || '').toLowerCase()
  return text.includes('на паузе')
}

function isPartialWeight(entry: Pick<ClientHistoryEntry, 'type' | 'text'>): boolean {
  if (entry.type === 'samples_sent') return true
  const text = String(entry.text || '').toLowerCase()
  return (
    text.includes('образц') ||
    text.includes('доставк') ||
    text.includes('отправ') ||
    text.includes('почт')
  )
}

/** Distinct calendar days in `month` (YYYY-MM) that count as activity. */
export function calculateActiveDaysFromHistory(
  history: Pick<ClientHistoryEntry, 'type' | 'text' | 'createdAt'>[],
  month: string,
): number {
  const byDay = new Map<string, Pick<ClientHistoryEntry, 'type' | 'text'>[]>()
  for (const entry of history) {
    if (SKIP_TYPES.includes(entry.type) || entry.type === ('system' as ClientHistoryType)) continue
    const day = historyDay(entry.createdAt)
    if (!day || !day.startsWith(month)) continue
    const list = byDay.get(day) || []
    list.push(entry)
    byDay.set(day, list)
  }

  let count = 0
  for (const entries of byDay.values()) {
    const pauseOnly =
      entries.length > 0 &&
      entries.every((e) => e.type === 'wait_status' && isPauseText(e.text))
    if (pauseOnly) continue

    const hasFull = entries.some(
      (e) => FULL_WEIGHT.includes(e.type) && !(e.type === 'wait_status' && isPauseText(e.text)),
    )
    if (hasFull) {
      count += 1
      continue
    }
    const hasPartial = entries.some((e) => isPartialWeight(e))
    const pausedThatDay = entries.some((e) => isPauseText(e.text))
    if (hasPartial && !pausedThatDay) count += 1
  }
  return count
}

export function groqActivityIsCurrent(
  client: Pick<Client, 'activityLabel' | 'activityMonth'>,
  month: string = getCurrentMonth(),
): boolean {
  return Boolean(client.activityLabel && client.activityMonth === month)
}

export function previousYearMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, (m || 1) - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthKeyOf(iso: string | null | undefined): string {
  return String(iso || '').slice(0, 7)
}

function isPauseWait(value: string | null | undefined): boolean {
  return String(value || '').toLowerCase().includes('на паузе')
}

/**
 * CRM filter / badges: do not wipe "active" on the 1st of a new month.
 * KPI still uses the strict current-month journal separately.
 */
export function effectiveGroqActivity(
  client: Partial<
    Pick<
      Client,
      | 'activityLabel'
      | 'activityMonth'
      | 'activeDaysThisMonth'
      | 'waitStatus'
      | 'lastTouchDate'
      | 'lastStageChangeDate'
      | 'activityCarriedFrom'
    >
  >,
  month: string = getCurrentMonth(),
): { label: GroqActivityLabel | null; carried: boolean; sourceMonth: string | null } {
  const prev = previousYearMonth(month)
  const days = Number(client.activeDaysThisMonth) || 0
  const thisLabel =
    client.activityMonth === month ? (client.activityLabel as GroqActivityLabel | null) : null
  const prevLabel =
    client.activityMonth === prev ? (client.activityLabel as GroqActivityLabel | null) : null

  if (isPauseWait(client.waitStatus)) {
    return { label: 'paused', carried: false, sourceMonth: month }
  }

  if (thisLabel === 'active' && (days > 0 || client.activityCarriedFrom)) {
    return {
      label: 'active',
      carried: Boolean(client.activityCarriedFrom) && days === 0,
      sourceMonth: client.activityCarriedFrom || month,
    }
  }

  if (thisLabel === 'active') {
    return { label: 'active', carried: false, sourceMonth: month }
  }

  if (days > 0 && thisLabel) {
    return { label: thisLabel, carried: false, sourceMonth: month }
  }

  const touchM = monthKeyOf(client.lastTouchDate)
  const moveM = monthKeyOf(client.lastStageChangeDate)
  const recent = touchM === month || touchM === prev || moveM === month || moveM === prev

  if (!thisLabel || thisLabel === 'passive') {
    if (prevLabel === 'active' || prevLabel === 'paused') {
      return { label: prevLabel, carried: true, sourceMonth: prev }
    }
    if (recent) {
      return { label: 'active', carried: true, sourceMonth: touchM || moveM || prev }
    }
  }

  if (thisLabel) return { label: thisLabel, carried: false, sourceMonth: month }
  if (prevLabel) return { label: prevLabel, carried: true, sourceMonth: prev }
  return { label: null, carried: false, sourceMonth: null }
}

export function kpiMonthIsCurrent(
  client: Pick<Client, 'kpiQualifiedMonth'>,
  month: string = getCurrentMonth(),
): boolean {
  return client.kpiQualifiedMonth === month
}

export function activeDaysTone(
  days: number,
  minActiveDays: number,
): 'green' | 'amber' | 'red' {
  if (days >= minActiveDays) return 'green'
  if (days >= Math.max(0, minActiveDays - 3)) return 'amber'
  return 'red'
}

export function formatMonthNominative(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('ru-RU', { month: 'long' })
}

export function countGroqActivity(
  clients: Pick<
    Client,
    | 'stage'
    | 'activityLabel'
    | 'activityMonth'
    | 'activeDaysThisMonth'
    | 'waitStatus'
    | 'lastTouchDate'
    | 'lastStageChangeDate'
    | 'activityCarriedFrom'
  >[],
  month: string = getCurrentMonth(),
): { active: number; passive: number; paused: number; unlabeled: number } {
  const counts = { active: 0, passive: 0, paused: 0, unlabeled: 0 }
  const closed = new Set(['deal', 'rejected', 'failed', 'abandoned'])
  for (const client of clients) {
    if (closed.has(String(client.stage))) continue
    const { label } = effectiveGroqActivity(client, month)
    if (label === 'active' || label === 'passive' || label === 'paused') {
      counts[label] += 1
    } else {
      counts.unlabeled += 1
    }
  }
  return counts
}

export function monthBarWidth(count: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((count / total) * 100)}%`
}
