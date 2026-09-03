const SKIP_TYPES = new Set(['created', 'system', 'auto'])
const STRONG_TYPES = new Set(['call', 'visit', 'samples_sent', 'stage_change', 'next_step'])
const SUBSTANCE_RE =
  /кп|коммерческ|прайс|каталог|образц|тз|техническ|спецификац|договор|сч[её]т|инвойс|артикул|созвон|звонок|визит|выкрас|плотн|ширин|отправ|предложени/i
const STRONG_TEXT_RE = /кп|коммерческ|прайс|образц|тз|договор|созвон|звонок|визит/i

const STEP_TYPE_LABELS = {
  note: 'комментарий по клиенту',
  call: 'итог звонка',
  sales_note: 'комментарий продаж',
  sales_assigned: 'передача в продажи',
  stage_change: 'сдвиг этапа',
  next_step: 'следующий шаг',
  visit: 'визит',
  samples_sent: 'отправка образцов',
}

function isPauseText(value) {
  return String(value || '').toLowerCase().includes('на паузе')
}

function classifyLeadHistoryEntry(entry) {
  const type = String(entry?.type || '')
  const text = String(entry?.text || '').trim()
  const typeLabel = STEP_TYPE_LABELS[type] || type || 'запись'

  if (SKIP_TYPES.has(type)) {
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
      why: 'Только «на паузе».',
      label: 'пауза',
      strong: false,
    }
  }

  if (type === 'wait_status') {
    return {
      kpiCounted: false,
      countsAsWork: true,
      kind: 'wait',
      why: 'Ожидание — не шаг KPI.',
      label: 'ожидание',
      strong: false,
    }
  }

  if (type === 'sales_assigned') {
    return {
      kpiCounted: false,
      countsAsWork: true,
      kind: 'light',
      why: 'Передача в продажи — активность, не шаг KPI.',
      label: typeLabel,
      strong: false,
    }
  }

  if (STRONG_TYPES.has(type) || SUBSTANCE_RE.test(text)) {
    const strong = STRONG_TYPES.has(type) || STRONG_TEXT_RE.test(text)
    return {
      kpiCounted: true,
      countsAsWork: true,
      kind: 'manager',
      why: `Содержательный шаг: ${typeLabel}.`,
      label: typeLabel,
      strong,
    }
  }

  return {
    kpiCounted: false,
    countsAsWork: true,
    kind: 'light',
    why: 'Короткий комментарий без сути. Активный, в KPI не идёт.',
    label: typeLabel,
    strong: false,
  }
}

function countKpiLeadSteps(entries) {
  return (entries || []).filter((e) => classifyLeadHistoryEntry(e).kpiCounted).length
}

function entryDay(entry) {
  if (typeof entry?.date === 'string' && entry.date.length >= 10) return entry.date.slice(0, 10)
  if (typeof entry?.createdAt === 'string' && entry.createdAt.length >= 10) {
    return entry.createdAt.slice(0, 10)
  }
  return ''
}

function evaluateKpiLead(entries, minMoments) {
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

  const parts = []
  if (n < minMoments) parts.push(`содержательных шагов ${n} из ${minMoments}`)
  if (!hasStrong) parts.push('нет сильного шага (КП / звонок / образцы / этап / визит)')
  if (types < 2) parts.push('нужны минимум 2 разных вида работы')
  if (!spreadOk) parts.push('нужно 2 разных дня или 3 разных вида работы')

  const qualifies = n >= minMoments && hasStrong && types >= 2 && spreadOk
  const reason = qualifies
    ? `Засчитан: ${n} содержательных шагов, ${types} вида работы, ${days || 1} дн., есть сильный шаг.`
    : `Не засчитан: ${parts.join('; ')}. «Написала» без сути не считается.`

  return { significantMoments: n, qualifies, reason, days, types, hasStrong }
}

function describeKpiSteps(entries, minMoments) {
  return evaluateKpiLead(entries, minMoments).reason
}

module.exports = {
  classifyLeadHistoryEntry,
  countKpiLeadSteps,
  describeKpiSteps,
  evaluateKpiLead,
  isPauseText,
}
