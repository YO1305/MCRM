/** Simple KPI rule: count manager work steps on the lead, not client speech. */

export const KPI_SKIP_TYPES = new Set<string>(['created', 'system', 'auto'])

export const KPI_STEP_TYPE_LABELS: Record<string, string> = {
  note: 'комментарий по клиенту',
  call: 'итог звонка',
  sales_note: 'комментарий продаж',
  sales_assigned: 'передача в продажи',
  stage_change: 'сдвиг этапа',
  next_step: 'следующий шаг',
  visit: 'визит',
  samples_sent: 'отправка образцов',
}

export type LeadStepKind = 'manager' | 'wait' | 'noise'

export interface LeadStepClass {
  kpiCounted: boolean
  countsAsWork: boolean
  kind: LeadStepKind
  why: string
  label: string
}

export function isPauseText(value: string | null | undefined): boolean {
  return String(value || '').toLowerCase().includes('на паузе')
}

export function classifyLeadHistoryEntry(entry: {
  type?: string
  text?: string | null
}): LeadStepClass {
  const type = String(entry.type || '')
  const text = String(entry.text || '').trim()
  const typeLabel = KPI_STEP_TYPE_LABELS[type] || type || 'запись'

  if (KPI_SKIP_TYPES.has(type)) {
    return {
      kpiCounted: false,
      countsAsWork: false,
      kind: 'noise',
      why: 'Системная запись / «клиент создан» — не шаг по лиду.',
      label: typeLabel,
    }
  }

  if (type === 'wait_status' && isPauseText(text)) {
    return {
      kpiCounted: false,
      countsAsWork: false,
      kind: 'noise',
      why: 'Только «на паузе». Лид не активный и в KPI не идёт.',
      label: 'пауза',
    }
  }

  if (type === 'wait_status') {
    return {
      kpiCounted: false,
      countsAsWork: true,
      kind: 'wait',
      why: 'Ожидание. Клиент из‑за этого может быть активным, но это не шаг работы с клиентом.',
      label: 'ожидание',
    }
  }

  return {
    kpiCounted: true,
    countsAsWork: true,
    kind: 'manager',
    why: `Шаг менеджера по лиду: ${typeLabel}. Идёт в KPI (КП, звонок, образцы, этап, комментарий — всё считается).`,
    label: typeLabel,
  }
}

export function countKpiLeadSteps(
  entries: { type?: string; text?: string | null }[],
): number {
  return entries.filter((e) => classifyLeadHistoryEntry(e).kpiCounted).length
}

export function describeKpiSteps(
  entries: { type?: string; text?: string | null }[],
  minMoments: number,
): string {
  const steps = entries.filter((e) => classifyLeadHistoryEntry(e).kpiCounted)
  const n = steps.length
  if (n >= minMoments) {
    return `Засчитан: ${n} шагов менеджера по клиенту (нужно ${minMoments}).`
  }
  return `Не засчитан: шагов менеджера по клиенту ${n} из ${minMoments}. Занесите в Историю ещё ${Math.max(0, minMoments - n)} факт(а): КП, звонок, образцы, этап, комментарий по работе.`
}
