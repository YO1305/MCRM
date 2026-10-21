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

const ABANDONED_SILENCE_DAYS = 14

function monthCutoffDay(month, today) {
  today = today || new Date()
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) return ''
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0)
  const end = `${y}-${String(m).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (todayStr.startsWith(month) && todayStr < end) return todayStr
  return end
}

function daysBetweenIso(from, to) {
  if (!from || from.length < 10 || !to || to.length < 10) return 0
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00`)
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.round((b - a) / 86400000)
}

function evaluateKpiLead(entries, minMoments, month) {
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

  const lastKpiDay =
    steps
      .map((s) => s.day)
      .filter((d) => d.length >= 10)
      .sort()
      .slice(-1)[0] || ''
  const inferredMonth = month || lastKpiDay.slice(0, 7)
  const cutoff = monthCutoffDay(inferredMonth)
  const silenceDays = lastKpiDay && cutoff ? daysBetweenIso(lastKpiDay, cutoff) : 0
  const abandoned = Boolean(lastKpiDay) && silenceDays >= ABANDONED_SILENCE_DAYS

  const parts = []
  if (n < minMoments) parts.push(`содержательных шагов ${n} из ${minMoments}`)
  if (days < 2) parts.push(`дней с работой ${days} из 2`)
  if (types < 2) parts.push(`видов работы ${types} из 2`)
  if (abandoned) {
    parts.push(
      `после последней работы ${lastKpiDay} тишина ${silenceDays} дн. до ${cutoff} — лид заброшен, в KPI не идёт`,
    )
  }

  const qualifies = n >= minMoments && days >= 2 && types >= 2 && !abandoned
  const reason = qualifies
    ? `Засчитан: ${n} шагов за ${days} дн., ${types} вида работы. Последняя работа ${lastKpiDay}, тишины ${silenceDays} дн. — лид не заброшен.`
    : `Не засчитан: ${parts.join('; ')}. Нужно вести клиента до конца месяца, а не отправить КП и пропасть.`

  return {
    significantMoments: n,
    qualifies,
    reason,
    days,
    types,
    hasStrong: hasCallOrVisit && hasCommercial,
    hasLive: hasCallOrVisit,
    hasOffer: hasCommercial,
    silenceDays,
    abandoned,
  }
}

function describeKpiSteps(entries, minMoments, month) {
  return evaluateKpiLead(entries, minMoments, month).reason
}

function kpiClockStart(client, history) {
  if (isPauseText(client?.waitStatus)) return null
  const saved = String(client?.workResumedDate || '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(saved)) return saved
  const rows = (history || []).map((e) => ({
    type: String(e.type || ''),
    text: String(e.text || ''),
    day: entryDay(e),
  }))
  const pauseDays = rows
    .filter((r) => r.type === 'wait_status' && isPauseText(r.text) && r.day.length >= 10)
    .map((r) => r.day)
    .sort()
  const lastPause = pauseDays[pauseDays.length - 1]
  if (!lastPause) return String(client?.openedDate || '').slice(0, 10) || null
  const after = rows
    .filter((r) => r.day > lastPause && classifyLeadHistoryEntry(r).countsAsWork)
    .map((r) => r.day)
    .sort()
  return after[0] || null
}

function historyForKpiClock(client, history) {
  if (isPauseText(client?.waitStatus)) return []
  const start = kpiClockStart(client, history)
  if (!start) {
    const hadPause = (history || []).some(
      (e) => String(e.type || '') === 'wait_status' && isPauseText(e.text),
    )
    return hadPause ? [] : history || []
  }
  return (history || []).filter((e) => {
    const day = entryDay(e)
    return !day || day >= start
  })
}

module.exports = {
  classifyLeadHistoryEntry,
  countKpiLeadSteps,
  describeKpiSteps,
  evaluateKpiLead,
  historyForKpiClock,
  isPauseText,
  kpiClockStart,
}
