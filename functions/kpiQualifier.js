const { FieldValue } = require('firebase-admin/firestore')
const { evaluateKpiLead } = require('./kpiLeadSteps')

const FINAL_STAGES = new Set(['deal', 'rejected', 'failed', 'abandoned'])
const DEFAULT_MIN_MOMENTS = 4

const DEFAULT_KPI_PROMPT = `Отбор KPI считает программа, не ИИ.

Правило (простое, план спокойно 70–80%):
1) Активный = любая работа в Истории за месяц.
2) KPI-лид = активный, не старше 3 месяцев, и все четыре пункта:
   — 4 содержательных шага;
   — работа в 3 разных дня;
   — звонок или визит;
   — КП или образцы или сдвиг этапа.
3) Сделка в 1-м месяце = сразу.
4) «Написала» без сути не шаг. Фразы клиента не нужны.`

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

function scoreFromHistory(history, minMoments) {
  return evaluateKpiLead(history || [], minMoments)
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

async function deleteMonthLog(db, clientId, month) {
  const existing = await findMonthLog(db, clientId, month)
  if (!existing) return
  const moments = Number(existing.data().significantMoments) || 0
  if (moments >= 900) return
  await existing.ref.delete()
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
    source: 'journal_steps',
  })
  return { wrote: true }
}

/**
 * Level 2 KPI: after the lead is active this month (or fast deal in month 1).
 * Counts manager steps on the lead from CRM history. Groq is not used.
 */
async function qualifyLeadForKpi(db, _groq, client, history, config, month, options = {}) {
  const minMoments = Math.max(4, Number(config.minKpiMoments) || DEFAULT_MIN_MOMENTS)
  const months = resolveActiveMonths(client, month)

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

  const parsed = scoreFromHistory(history || [], minMoments)
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
  const minMoments = Math.max(4, Number(config.minKpiMoments) || DEFAULT_MIN_MOMENTS)
  const months = resolveActiveMonths(client, month)
  const parsed = scoreFromHistory(history || [], minMoments)
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
