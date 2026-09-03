const { FieldValue } = require('firebase-admin/firestore')
const { evaluateKpiLead, historyForKpiClock, isPauseText, kpiClockStart } = require('./kpiLeadSteps')

const FINAL_STAGES = new Set(['deal', 'rejected', 'failed', 'abandoned'])
const DEFAULT_MIN_MOMENTS = 3

const DEFAULT_KPI_PROMPT = `Отбор KPI считает программа, не ИИ. Смотрит всю Историю за месяц, не один удачный день.

1) Активный = любая работа в Истории за месяц.
2) KPI-лид = активный, 1–3 месяц, и:
   — 3 содержательных шага менеджера;
   — 2 разных дня;
   — 2 разных вида работы;
   — лид не заброшен (нет 10+ дней тишины после последней работы);
   — не на паузе. Сняли паузу — отсчёт с этого дня.
   КП отправили, «ждём ответа», две недели пусто — это не KPI-лид.
3) Сделка в 1-м месяце = сразу.
4) «Написала» без сути не шаг.`

function resolveActiveMonths(client, month, history) {
  const clock = kpiClockStart(client, history || [])
  const raw = clock || client.openedDate || client.openedMonth || ''
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

function scoreFromHistory(client, history, minMoments, month) {
  if (isPauseText(client?.waitStatus)) {
    return evaluateKpiLead([], minMoments, month)
  }
  return evaluateKpiLead(historyForKpiClock(client, history || []), minMoments, month)
}

function kpiLogId(clientId, month) {
  return `kl_${clientId}_${month}`
}

async function findMonthLog(db, clientId, month) {
  const named = await db.collection('kpi_lead_log').doc(kpiLogId(clientId, month)).get()
  if (named.exists) return named
  try {
    const snap = await db
      .collection('kpi_lead_log')
      .where('clientId', '==', clientId)
      .where('month', '==', month)
      .limit(1)
      .get()
    return snap.empty ? null : snap.docs[0]
  } catch {
    return null
  }
}

async function updateClientKpi(db, clientId, fields) {
  await db.collection('clients').doc(clientId).update({
    ...fields,
    kpiQualifiedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
}

async function deleteMonthLog(db, clientId, month, options = {}) {
  const existing = await findMonthLog(db, clientId, month)
  if (!existing) return
  const data = existing.data() || {}
  const moments = Number(data.significantMoments) || 0
  if (!options.force) {
    if (moments >= 900) return
    if (data.source === 'admin') return
  }
  await existing.ref.delete()
}

async function writeKpiLeadLog(db, client, significantMoments, month, activeMonthsCount, source = 'journal_steps') {
  const existing = await findMonthLog(db, client.id, month)
  if (existing) return { wrote: false }
  const cats = leadCategories(client)
  await db.collection('kpi_lead_log').doc(kpiLogId(client.id, month)).set({
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
    source,
  })
  return { wrote: true }
}

/**
 * Level 2 KPI: after the lead is active this month (or fast deal in month 1).
 * Counts manager steps on the lead from CRM history. Groq is not used.
 */
async function qualifyLeadForKpi(db, _groq, client, history, config, month, options = {}) {
  const minMoments = Math.max(3, Number(config.minKpiMoments) || DEFAULT_MIN_MOMENTS)
  const months = resolveActiveMonths(client, month, history)

  if (client.kpiManualMonth === month && client.kpiManualIncluded === false) {
    await deleteMonthLog(db, client.id, month, { force: true })
    await updateClientKpi(db, client.id, {
      kpiQualified: false,
      kpiQualifiedMonth: month,
      kpiSignificantMoments: client.kpiSignificantMoments ?? 0,
      kpiQualificationReason: 'Админ снял лид из KPI вручную',
      kpiManualIncluded: false,
      kpiManualMonth: month,
    })
    return { qualifies: false, skipped: 'admin_exclude', activeMonthsCount: months }
  }

  if (client.kpiManualMonth === month && client.kpiManualIncluded === true) {
    const moments = Number(client.kpiSignificantMoments) || minMoments
    await updateClientKpi(db, client.id, {
      kpiQualified: true,
      kpiQualifiedMonth: month,
      kpiSignificantMoments: moments,
      kpiQualificationReason: 'Админ засчитал лид вручную',
      kpiManualIncluded: true,
      kpiManualMonth: month,
    })
    await writeKpiLeadLog(db, client, moments, month, months, 'admin')
    return { qualifies: true, skipped: 'admin_include', activeMonthsCount: months }
  }

  if (isPauseText(client.waitStatus)) {
    await deleteMonthLog(db, client.id, month)
    await updateClientKpi(db, client.id, {
      kpiQualified: false,
      kpiQualifiedMonth: month,
      kpiSignificantMoments: 0,
      kpiQualificationReason:
        'На паузе — не трогаем. KPI начнётся с дня, когда снимут паузу и снова начнут работу.',
    })
    return { qualifies: false, skipped: 'paused', activeMonthsCount: months }
  }

  if (months > 3) {
    await deleteMonthLog(db, client.id, month)
    await updateClientKpi(db, client.id, {
      kpiQualified: false,
      kpiQualifiedMonth: month,
      kpiSignificantMoments: client.kpiSignificantMoments ?? 0,
      kpiQualificationReason: 'Лид на 4-м месяце — максимальный срок истёк',
    })
    return { qualifies: false, reason: 'month4', activeMonthsCount: months }
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
    await deleteMonthLog(db, client.id, month)
    await updateClientKpi(db, client.id, {
      kpiQualified: false,
      kpiQualifiedMonth: month,
      kpiSignificantMoments: client.kpiSignificantMoments ?? 0,
      kpiQualificationReason: 'Лид не активный в этом месяце — в KPI не идёт',
    })
    return { qualifies: false, skipped: 'not_active', activeMonthsCount: months }
  }

  const parsed = scoreFromHistory(client, history || [], minMoments, month)
  await updateClientKpi(db, client.id, {
    kpiQualified: parsed.qualifies,
    kpiQualifiedMonth: month,
    kpiSignificantMoments: parsed.significantMoments,
    kpiQualificationReason: parsed.reason,
  })
  if (parsed.qualifies) {
    await writeKpiLeadLog(db, client, parsed.significantMoments, month, months)
  } else {
    await deleteMonthLog(db, client.id, month)
  }
  return { ...parsed, activeMonthsCount: months }
}

async function testKpiQualification(_db, _groq, client, history, config, month) {
  const minMoments = Math.max(3, Number(config.minKpiMoments) || DEFAULT_MIN_MOMENTS)
  const months = resolveActiveMonths(client, month, history)
  const parsed = scoreFromHistory(client, history || [], minMoments, month)
  return {
    ...parsed,
    activeMonthsCount: months,
    minKpiMoments: minMoments,
    clientName: client.name,
    prompt: DEFAULT_KPI_PROMPT.split('{minKpiMoments}').join(String(minMoments)),
  }
}

module.exports = {
  DEFAULT_KPI_PROMPT,
  DEFAULT_MIN_MOMENTS,
  qualifyLeadForKpi,
  testKpiQualification,
  resolveActiveMonths,
}
