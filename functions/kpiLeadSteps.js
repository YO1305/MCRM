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
  const raw = entry?.createdAt
  if (typeof raw === 'string' && raw.length >= 10) return raw.slice(0, 10)
  if (raw && typeof raw.toDate === 'function') {
    try {
      const d = raw.toDate()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    } catch {
      /* ignore */
    }
  }
  const seconds = raw?.seconds ?? raw?._seconds
  if (typeof seconds === 'number') {
    const d = new Date(seconds * 1000)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return ''
}

function evaluateKpiLead(entries, minMoments) {
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

  const parts = []
  if (n < minMoments) parts.push(`содержательных шагов ${n} из ${minMoments}`)
  if (days < 3) parts.push(`дней с работой ${days} из 3`)
  if (!hasCallOrVisit) parts.push('нет звонка и нет визита')
  if (!hasCommercial) parts.push('нет КП / образцов / сдвига этапа')

  const qualifies = n >= minMoments && days >= 3 && hasCallOrVisit && hasCommercial
  const reason = qualifies
    ? `Засчитан: ${n} шагов за ${days} дн., есть контакт (звонок/визит) и КП/образцы/этап.`
    : `Не засчитан: ${parts.join('; ')}. Нужно: 4 содержательных шага, 3 разных дня, звонок или визит, и КП либо образцы.`

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
