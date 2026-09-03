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
  hasLive: boolean
  hasOffer: boolean
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
  if (typeof raw === 'object' && raw !== null) {
    const withToDate = raw as { toDate?: () => Date }
    if (typeof withToDate.toDate === 'function') {
      try {
        const d = withToDate.toDate()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      } catch {
        /* ignore */
      }
    }
    const seconds = (raw as { seconds?: number }).seconds ?? (raw as { _seconds?: number })._seconds
    if (typeof seconds === 'number') {
      const d = new Date(seconds * 1000)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
  }
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
    text: String(e.text || ''),
  }))
  const steps = rows.filter((r) => r.kpiCounted)
  const n = steps.length
  const days = new Set(steps.map((s) => s.day).filter((d) => d.length >= 10)).size
  const types = new Set(steps.map((s) => s.type).filter(Boolean)).size
  const hasCallOrVisit = steps.some(
    (s) => s.type === 'call' || s.type === 'visit' || /созвон|позвон|визит/i.test(s.text),
  )
  const hasCommercial = steps.some(
    (s) =>
      s.type === 'samples_sent' ||
      s.type === 'stage_change' ||
      s.type === 'next_step' ||
      /кп|коммерческ|прайс|образц/i.test(s.text),
  )

  const parts: string[] = []
  if (n < minMoments) parts.push(`содержательных шагов ${n} из ${minMoments}`)
  if (days < 2) parts.push(`дней с работой ${days} из 2`)
  if (types < 2) parts.push(`видов работы ${types} из 2`)

  const qualifies = n >= minMoments && days >= 2 && types >= 2
  const reason = qualifies
    ? `Засчитан: ${n} шагов за ${days} дн., ${types} вида работы (как Шахноза: КП + этап + звонок).`
    : `Не засчитан: ${parts.join('; ')}. Нужно: ${minMoments} содержательных шага, 2 разных дня и 2 разных вида работы. Звонок и КП вместе не обязательны.`

  return {
    significantMoments: n,
    qualifies,
    reason,
    days,
    types,
    hasStrong: hasCallOrVisit && hasCommercial,
    hasLive: hasCallOrVisit,
    hasOffer: hasCommercial,
  }
}

export function describeKpiSteps(
  entries: { type?: string; text?: string | null; date?: string; createdAt?: unknown }[],
  minMoments: number,
): string {
  return evaluateKpiLead(entries, minMoments).reason
}
