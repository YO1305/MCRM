/** KPI lead: substantial manager work, not every comment. Plan should land ~80–90%, not 150%. */

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

/** Always a KPI moment if the record exists. */
const STRONG_TYPES = new Set(['call', 'visit', 'samples_sent', 'stage_change', 'next_step'])

/** Comment counts as a KPI moment only with commercial substance. */
const SUBSTANCE_RE =
  /кп|коммерческ|прайс|каталог|образц|тз|техническ|спецификац|договор|сч[её]т|инвойс|артикул|созвон|звонок|визит|выкрас|плотн|ширин|отправ|предложени/i

export type LeadStepKind = 'manager' | 'wait' | 'noise' | 'light'

export interface LeadStepClass {
  kpiCounted: boolean
  countsAsWork: boolean
  kind: LeadStepKind
  why: string
  label: string
  strong: boolean
}

export interface KpiLeadScore {
  significantMoments: number
  qualifies: boolean
  reason: string
  days: number
  types: number
  hasStrong: boolean
}

export function isPauseText(value: string | null | undefined): boolean {
  return String(value || '').toLowerCase().includes('на паузе')
}

function hasSubstance(text: string): boolean {
  return SUBSTANCE_RE.test(text)
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
      strong: false,
    }
  }

  if (type === 'wait_status' && isPauseText(text)) {
    return {
      kpiCounted: false,
      countsAsWork: false,
      kind: 'noise',
      why: 'Только «на паузе». Лид не активный и в KPI не идёт.',
      label: 'пауза',
      strong: false,
    }
  }

  if (type === 'wait_status') {
    return {
      kpiCounted: false,
      countsAsWork: true,
      kind: 'wait',
      why: 'Ожидание. Клиент может быть активным, но это не шаг KPI.',
      label: 'ожидание',
      strong: false,
    }
  }

  if (type === 'sales_assigned') {
    return {
      kpiCounted: false,
      countsAsWork: true,
      kind: 'light',
      why: 'Передача в продажи — активность, не коммерческий шаг по клиенту.',
      label: typeLabel,
      strong: false,
    }
  }

  if (STRONG_TYPES.has(type) || hasSubstance(text)) {
    const strong = STRONG_TYPES.has(type) || /кп|коммерческ|прайс|образц|тз|договор|созвон|звонок|визит/i.test(text)
    return {
      kpiCounted: true,
      countsAsWork: true,
      kind: 'manager',
      why: strong
        ? `Содержательный шаг: ${typeLabel}. Идёт в KPI.`
        : `Шаг по сути работы (${typeLabel}). Идёт в KPI.`,
      label: typeLabel,
      strong,
    }
  }

  return {
    kpiCounted: false,
    countsAsWork: true,
    kind: 'light',
    why: 'Короткий комментарий без сути (типа «написала»). Лид активный, в KPI эта строка не идёт.',
    label: typeLabel,
    strong: false,
  }
}

export function countKpiLeadSteps(
  entries: { type?: string; text?: string | null }[],
): number {
  return entries.filter((e) => classifyLeadHistoryEntry(e).kpiCounted).length
}

function entryDay(entry: { date?: string; createdAt?: unknown }): string {
  if (typeof entry.date === 'string' && entry.date.length >= 10) return entry.date.slice(0, 10)
  const raw = entry.createdAt
  if (typeof raw === 'string' && raw.length >= 10) return raw.slice(0, 10)
  return ''
}

export function evaluateKpiLead(
  entries: { type?: string; text?: string | null; date?: string; createdAt?: unknown }[],
  minMoments: number,
): KpiLeadScore {
  const rows = (entries || []).map((e) => ({
    ...classifyLeadHistoryEntry(e),
    type: String(e.type || ''),
    day: entryDay(e),
  }))
  const steps = rows.filter((r) => r.kpiCounted)
  const n = steps.length
  const days = new Set(steps.map((s) => s.day).filter((d) => d.length >= 10)).size
  const types = new Set(steps.map((s) => s.type).filter(Boolean)).size
  const hasStrong = steps.some((s) => s.strong)
  const spreadOk = days >= 2 || types >= 3

  const parts: string[] = []
  if (n < minMoments) {
    parts.push(`содержательных шагов ${n} из ${minMoments}`)
  }
  if (!hasStrong) {
    parts.push('нет сильного шага (КП / звонок / образцы / этап / визит)')
  }
  if (types < 2) {
    parts.push('нужны минимум 2 разных вида работы, не три одинаковых комментария')
  }
  if (!spreadOk) {
    parts.push('всё в один день одним видом — нужно либо 2 разных дня, либо 3 разных вида работы')
  }

  const qualifies = n >= minMoments && hasStrong && types >= 2 && spreadOk
  const reason = qualifies
    ? `Засчитан: ${n} содержательных шагов, ${types} вида работы, ${days || 1} дн., есть сильный шаг.`
    : `Не засчитан: ${parts.join('; ')}. «Написала» без КП/звонка/образцов не считается. Активным клиент при этом может быть.`

  return { significantMoments: n, qualifies, reason, days, types, hasStrong }
}

export function describeKpiSteps(
  entries: { type?: string; text?: string | null; date?: string; createdAt?: unknown }[],
  minMoments: number,
): string {
  return evaluateKpiLead(entries, minMoments).reason
}
