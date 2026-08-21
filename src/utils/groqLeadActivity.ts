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
  clients: Pick<Client, 'stage' | 'activityLabel' | 'activityMonth'>[],
  month: string = getCurrentMonth(),
): { active: number; passive: number; paused: number; unlabeled: number } {
  const counts = { active: 0, passive: 0, paused: 0, unlabeled: 0 }
  const closed = new Set(['deal', 'rejected', 'failed', 'abandoned'])
  for (const client of clients) {
    if (closed.has(String(client.stage))) continue
    if (client.activityMonth !== month || !client.activityLabel) {
      counts.unlabeled += 1
      continue
    }
    const label = client.activityLabel as GroqActivityLabel
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
