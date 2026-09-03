const { FieldValue } = require('firebase-admin/firestore')

const FINAL_STAGES = new Set(['deal', 'rejected', 'failed', 'abandoned'])
const DEFAULT_MIN_MOMENTS = 3

const STAGE_LABELS = {
  contact: 'Контакт',
  negotiation: 'Переговоры',
  proposal: 'КП отправлено',
  brief: 'ТЗ получено',
  contract: 'Договор',
  deal: 'Сделка',
  rejected: 'Отказ',
  failed: 'Провалено',
  abandoned: 'Заброшено',
}

const HISTORY_TYPE_LABELS = {
  note: 'Комментарий',
  call: 'Итог звонка',
  sales_note: 'Комментарий продаж',
  sales_assigned: 'Назначен менеджер продаж',
  stage_change: 'Смена этапа',
  wait_status: 'Статус ожидания',
  next_step: 'Следующий шаг',
  visit: 'Визит',
  samples_sent: 'Отправка образцов',
}

const DEFAULT_KPI_PROMPT = `Ты аналитик CRM текстильной компании BAHMAL HOME (Узбекистан).

По журналу за месяц посчитай, сколько раз КЛИЕНТ сделал конкретный шаг вперёд.
Это журнал менеджера, не чат: если менеджер написал «клиент запросил образцы артикула 40/1» — это действие КЛИЕНТА.

ДАННЫЕ:
- Имя: {clientName}
- Категория: {category}
- Этап: {stage}
- Статус лида: {activityLabel}
- Месяц работы: {activeMonthsCount} из 3

ЖУРНАЛ:
{monthHistory}

ВЕСОМЫЙ МОМЕНТ (клиент):
- запросил КП / коммерческое на конкретный артикул (именно КЛИЕНТ запросил, не менеджер отправила)
- запросил образцы конкретных артикулов
- прислал ТЗ / спецификацию
- запросил параметры (плотность, состав, ширина)
- запросил условия договора или поставки
- запросил счёт или реквизиты
- подтвердил получение образцов
- дал обратную связь по образцам / выкрасу
- согласовал объём или сроки
- подтвердил готовность к следующему шагу
- одобрил цвет, артикул или спецификацию
- запросил договор, согласовал спецификацию заказа
- предоплата, подпись, явно движется вперёд

НЕ СЧИТАТЬ (это работа менеджера: лид АКТИВНЫЙ, но не KPI):
- менеджер отправила КП / коммерческое / прайс / каталог / «написала» / «шаг выполнен»
- этап «КП отправлено» сам по себе
- менеджер подготовила образцы, а клиент получение не подтвердил
- клиент спросил цену в общем или «что есть в ассортименте»
- «подумаем», «позже», «на паузе», «ждём решения» без действия

Считать шаг только если в тексте есть действие КЛИЕНТА: запросила / подтвердила / согласовала / прислала ТЗ. «Я отправила КП Шахнозе» = 0 шагов клиента.

qualifies = true только если significantMoments >= {minKpiMoments}

JSON:
{"significantMoments":0,"qualifies":false,"reason":"1-2 предложения на русском"}`

function resolveActiveMonths(client, month) {
  const raw = client.openedDate || client.openedMonth || ''
  const openedMonth = String(raw).slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(openedMonth) || !/^\d{4}-\d{2}$/.test(month)) return 1
  const [oy, om] = openedMonth.split('-').map(Number)
  const [ty, tm] = month.split('-').map(Number)
  return Math.min(99, Math.max(1, (ty - oy) * 12 + (tm - om) + 1))
}

function leadCategories(client) {
  if (Array.isArray(client.categories) && client.categories.length) {
    return client.categories.filter(Boolean)
  }
  return client.category ? [client.category] : ['fabric']
}

function formatHistory(history) {
  if (!history?.length) return '- История пуста'
  return history
    .map((h) => {
      const type = HISTORY_TYPE_LABELS[h.type] || h.type || 'запись'
      return `- ${h.date} — ${type}: ${h.text}`
    })
    .join('\n')
}

function resolveKpiPrompt(config) {
  const stored = String(config?.kpiPrompt || '')
  const legacy =
    !stored.trim() ||
    !/отправил\w*\s+кп|кп\s*\/\s*коммерческ|этап «кп отправлено»/i.test(stored)
  return legacy ? DEFAULT_KPI_PROMPT : stored
}
  return String(template || DEFAULT_KPI_PROMPT)
    .split('{clientName}')
    .join(input.clientName)
    .split('{category}')
    .join(input.category)
    .split('{stage}')
    .join(input.stage)
    .split('{activityLabel}')
    .join(input.activityLabel)
    .split('{activeMonthsCount}')
    .join(String(input.activeMonthsCount))
    .split('{minKpiMoments}')
    .join(String(input.minKpiMoments))
    .split('{monthHistory}')
    .join(input.monthHistory)
}

function parseKpiResult(raw, minMoments) {
  const fallback = {
    significantMoments: 0,
    qualifies: false,
    reason: 'Не удалось разобрать ответ Groq',
  }
  try {
    const match = String(raw || '').match(/\{[\s\S]*\}/)
    const obj = JSON.parse(match ? match[0] : '{}')
    const moments = Math.max(0, Math.min(10, Number(obj.significantMoments) || 0))
    const qualifies = obj.qualifies === true && moments >= minMoments
    const reason = String(obj.reason || fallback.reason).slice(0, 400)
    return { significantMoments: moments, qualifies, reason }
  } catch {
    return fallback
  }
}

async function findMonthLog(db, clientId, month) {
  const snap = await db
    .collection('kpi_lead_log')
    .where('clientId', '==', clientId)
    .where('month', '==', month)
    .limit(1)
    .get()
  return snap.empty ? null : snap.docs[0]
}

async function updateClientKpi(db, clientId, fields) {
  await db.collection('clients').doc(clientId).update({
    ...fields,
    kpiQualifiedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
}

async function writeKpiLeadLog(db, client, significantMoments, month, activeMonthsCount) {
  const existing = await findMonthLog(db, client.id, month)
  if (existing) return { wrote: false }
  const cats = leadCategories(client)
  await db.collection('kpi_lead_log').add({
    clientId: client.id,
    clientName: client.name || '',
    assignedTo: client.assignedTo || '',
    assignedToName: client.assignedToName || '',
    category: cats[0] || 'fabric',
    categories: cats,
    country: client.country || null,
    month,
    significantMoments,
    qualifiedAt: FieldValue.serverTimestamp(),
    fixedAt: FieldValue.serverTimestamp(),
    stage: client.stage || '',
    activeMonthsCount,
    source: 'groq_kpi',
  })
  return { wrote: true }
}

async function groqQualify(groq, prompt) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 160,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    })
    return completion.choices[0]?.message?.content?.trim() || ''
  } catch (error) {
    console.error('KPI Groq json_object failed, retry', error?.message || error)
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 160,
      temperature: 0.1,
    })
    return completion.choices[0]?.message?.content?.trim() || ''
  }
}

/**
 * Level 2 KPI: only after the lead is active this month (or fast deal in month 1).
 */
async function qualifyLeadForKpi(db, groq, client, history, config, month, options = {}) {
  const minMoments = Math.max(1, Number(config.minKpiMoments) || DEFAULT_MIN_MOMENTS)
  const months = resolveActiveMonths(client, month)
  const promptTemplate = resolveKpiPrompt(config)

  if (months > 3) {
    await updateClientKpi(db, client.id, {
      kpiQualified: false,
      kpiQualifiedMonth: month,
      kpiSignificantMoments: client.kpiSignificantMoments ?? 0,
      kpiQualificationReason: 'Лид на 4-м месяце — максимальный срок истёк',
    })
    return { qualifies: false, reason: 'month4', activeMonthsCount: months }
  }

  const existingLog = await findMonthLog(db, client.id, month)
  if (existingLog && !options.force) {
    await updateClientKpi(db, client.id, {
      kpiQualified: true,
      kpiQualifiedMonth: month,
      kpiSignificantMoments:
        existingLog.data().significantMoments ?? client.kpiSignificantMoments ?? 0,
      kpiQualificationReason: client.kpiQualificationReason || 'Уже в KPI за этот месяц',
    })
    return { qualifies: true, skipped: 'logged', activeMonthsCount: months }
  }

  if (client.stage === 'deal' && months === 1) {
    await updateClientKpi(db, client.id, {
      kpiQualified: true,
      kpiQualifiedMonth: month,
      kpiSignificantMoments: 999,
      kpiQualificationReason: 'Сделка в 1-м месяце — зачёт в KPI автоматически',
    })
    await writeKpiLeadLog(db, client, 999, month, months)
    return { qualifies: true, autoDeal: true, significantMoments: 999, activeMonthsCount: months }
  }

  if (FINAL_STAGES.has(client.stage)) {
    return { skipped: 'final', activeMonthsCount: months }
  }

  if (client.activityLabel !== 'active' || client.activityMonth !== month) {
    await updateClientKpi(db, client.id, {
      kpiQualified: false,
      kpiQualifiedMonth: month,
      kpiSignificantMoments: client.kpiSignificantMoments ?? 0,
      kpiQualificationReason: 'Лид не активный в этом месяце — в KPI не идёт',
    })
    return { qualifies: false, skipped: 'not_active', activeMonthsCount: months }
  }

  const input = {
    clientName: client.name || '',
    category: leadCategories(client)
      .map((c) => ({ fabric: 'ткань', finished: 'ГП', europe: 'Европа' })[c] || c)
      .join(', ') || 'не указана',
    stage: STAGE_LABELS[client.stage] || client.stage || '',
    activityLabel: client.activityLabel || '',
    activeMonthsCount: months,
    minKpiMoments: minMoments,
    monthHistory: formatHistory(history),
  }
  const prompt = buildKpiPrompt(promptTemplate, input)

  try {
    const raw = await groqQualify(groq, prompt)
    const parsed = parseKpiResult(raw, minMoments)
    await updateClientKpi(db, client.id, {
      kpiQualified: parsed.qualifies,
      kpiQualifiedMonth: month,
      kpiSignificantMoments: parsed.significantMoments,
      kpiQualificationReason: parsed.reason,
    })
    if (parsed.qualifies) {
      await writeKpiLeadLog(db, client, parsed.significantMoments, month, months)
    }
    return { ...parsed, activeMonthsCount: months }
  } catch (error) {
    console.error(`KPI qualification error for ${client.id}:`, error)
    return { error: error?.message || String(error), activeMonthsCount: months }
  }
}

async function testKpiQualification(db, groq, client, history, config, month) {
  const minMoments = Math.max(1, Number(config.minKpiMoments) || DEFAULT_MIN_MOMENTS)
  const months = resolveActiveMonths(client, month)
  const input = {
    clientName: client.name || '',
    category: leadCategories(client)
      .map((c) => ({ fabric: 'ткань', finished: 'ГП', europe: 'Европа' })[c] || c)
      .join(', ') || 'не указана',
    stage: STAGE_LABELS[client.stage] || client.stage || '',
    activityLabel: client.activityLabel || 'не указан',
    activeMonthsCount: months,
    minKpiMoments: minMoments,
    monthHistory: formatHistory(history),
  }
  const prompt = buildKpiPrompt(resolveKpiPrompt(config), input)
  const raw = await groqQualify(groq, prompt)
  const parsed = parseKpiResult(raw, minMoments)
  return {
    ...parsed,
    activeMonthsCount: months,
    minKpiMoments: minMoments,
    clientName: client.name,
    prompt,
  }
}

module.exports = {
  DEFAULT_KPI_PROMPT,
  DEFAULT_MIN_MOMENTS,
  qualifyLeadForKpi,
  testKpiQualification,
  resolveActiveMonths,
  parseKpiResult,
  buildKpiPrompt,
}
