const SKIP_TYPES = new Set(['created', 'system', 'auto'])

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
    }
  }

  if (type === 'wait_status' && isPauseText(text)) {
    return {
      kpiCounted: false,
      countsAsWork: false,
      kind: 'noise',
      why: 'Только «на паузе».',
      label: 'пауза',
    }
  }

  if (type === 'wait_status') {
    return {
      kpiCounted: false,
      countsAsWork: true,
      kind: 'wait',
      why: 'Ожидание — не шаг работы с клиентом.',
      label: 'ожидание',
    }
  }

  return {
    kpiCounted: true,
    countsAsWork: true,
    kind: 'manager',
    why: `Шаг менеджера по лиду: ${typeLabel}`,
    label: typeLabel,
  }
}

function countKpiLeadSteps(entries) {
  return (entries || []).filter((e) => classifyLeadHistoryEntry(e).kpiCounted).length
}

function describeKpiSteps(entries, minMoments) {
  const n = countKpiLeadSteps(entries)
  if (n >= minMoments) {
    return `Засчитан: ${n} шагов менеджера по клиенту (нужно ${minMoments}).`
  }
  return `Не засчитан: шагов менеджера по клиенту ${n} из ${minMoments}. Занесите в Историю ещё ${Math.max(0, minMoments - n)} факт(а): КП, звонок, образцы, этап, комментарий по работе.`
}

module.exports = {
  classifyLeadHistoryEntry,
  countKpiLeadSteps,
  describeKpiSteps,
  isPauseText,
}
