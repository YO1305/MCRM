const { FieldValue } = require('firebase-admin/firestore')
const Groq = require('groq-sdk')
const { qualifyLeadForKpi, testKpiQualification, DEFAULT_KPI_PROMPT, DEFAULT_MIN_MOMENTS, resolveActiveMonths } = require('./kpiQualifier')

const FINAL_STAGES = new Set(['deal', 'rejected', 'failed', 'abandoned'])
const REQUEST_DELAY_MS = 0
const DEFAULT_MIN_DAYS = 10
const GROQ_MODEL = 'llama-3.1-8b-instant'

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

const SKIP_TYPES = new Set(['created', 'system', 'auto'])

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

const DEFAULT_ACTIVITY_PROMPT = `Ты смотришь журнал CRM BAHMAL HOME, не чат с клиентом.
В истории почти никогда нет прямой речи клиента — это нормально.

Твоя задача: одной фразой на русском сказать, ЧТО менеджер делал с лидом в этом месяце.
Метку active/passive/paused ставит система по журналу, не ты. Но label в JSON всё равно заполни так:
- active — в истории есть работа (шаг, этап, звонок, комментарий, ТЗ, цены, образцы, продажи)
- passive — за месяц журнала нет
- paused — в карточке «На паузе» и другой работы нет

Примеры работы (это active):
- «Шаг выполнен: Предоставить цены на основе ТЗ»
- «КП отправлено → ТЗ получено»
- «Итог звонка…», комментарий, визит, образцы, назначение продаж

Не ставь passive из‑за «нет ответа клиента» или «запись формальная».

ДАННЫЕ:
- Имя: {clientName}
- Этап: {stage}
- Ожидание: {waitStatus}
- Дней с записями: {activeDaysCount}
- Дней без касания: {daysSinceLastTouch}

ЖУРНАЛ ЗА МЕСЯЦ:
{monthHistory}

JSON:
{"label":"active|passive|paused","score":0-100,"reason":"одно предложение что сделали"}`

function tashkentToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })
}

function tashkentMonth() {
  return tashkentToday().slice(0, 7)
}

function isIsoDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function daysDiff(fromDate, todayStr) {
  if (!isIsoDay(fromDate) || !isIsoDay(todayStr)) return 0
  const from = new Date(`${fromDate}T00:00:00`)
  const to = new Date(`${todayStr}T00:00:00`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86400000))
}

function dateFromCreatedAt(createdAt, fallback) {
  if (!createdAt) return fallback
  if (typeof createdAt === 'string' && createdAt.length >= 10) return createdAt.slice(0, 10)
  if (typeof createdAt.toDate === 'function') {
    try {
      return createdAt.toDate().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })
    } catch {
      /* fall through */
    }
  }
  const seconds = createdAt.seconds || createdAt._seconds
  if (typeof seconds === 'number') {
    return new Date(seconds * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })
  }
  return fallback
}

function resolveOpenedDate(client, todayStr) {
  if (isIsoDay(client.openedDate)) return client.openedDate
  if (typeof client.openedMonth === 'string' && /^\d{4}-\d{2}$/.test(client.openedMonth)) {
    return `${client.openedMonth}-01`
  }
  return dateFromCreatedAt(client.createdAt, todayStr)
}

function resolveTouchDate(client, todayStr) {
  if (isIsoDay(client.lastTouchDate)) return client.lastTouchDate
  return resolveOpenedDate(client, todayStr)
}

function formatHistoryDate(createdAt) {
  return dateFromCreatedAt(createdAt, tashkentToday())
}

function isPauseText(value) {
  return String(value || '').toLowerCase().includes('на паузе')
}

function calculateActiveDays(entries) {
  const byDay = new Map()
  for (const entry of entries) {
    if (SKIP_TYPES.has(entry.type)) continue
    const day = entry.date
    if (!isIsoDay(day)) continue
    const list = byDay.get(day) || []
    list.push(entry)
    byDay.set(day, list)
  }
  let count = 0
  for (const dayEntries of byDay.values()) {
    const pauseOnly =
      dayEntries.length > 0 &&
      dayEntries.every((e) => e.type === 'wait_status' && isPauseText(e.text))
    if (pauseOnly) continue
    count += 1
  }
  return count
}

function hasCrmWork(entries) {
  return (entries || []).some((e) => {
    if (SKIP_TYPES.has(e.type)) return false
    if (e.type === 'wait_status' && isPauseText(e.text)) return false
    return Boolean(e.type || e.text)
  })
}

function classifyLabel(entries, waitStatus) {
  if (isPauseText(waitStatus)) return 'paused'
  const work = hasCrmWork(entries)
  if (work) return 'active'
  return 'passive'
}

function autoReason(entries, label) {
  if (label === 'paused') return 'На паузе — не трогаем, пока снова не начнут работу.'
  if (label === 'passive') return 'За этот месяц в истории нет работы по лиду.'
  const line = (entries || []).find((e) => !SKIP_TYPES.has(e.type) && e.text)
  if (line?.text) return String(line.text).replace(/\s+/g, ' ').slice(0, 220)
  return 'В истории месяца есть действия менеджера.'
}

function previousYearMonth(month) {
  const [y, m] = String(month).split('-').map(Number)
  const d = new Date(y, (m || 1) - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function hadRecentWork(client, month) {
  const prev = previousYearMonth(month)
  const touch = String(client.lastTouchDate || '').slice(0, 7)
  const move = String(client.lastStageChangeDate || '').slice(0, 7)
  if (touch === month || touch === prev || move === month || move === prev) return true
  if (client.activityMonth === prev && client.activityLabel === 'active') return true
  if (client.activityCarriedFrom && client.activityLabel === 'active') return true
  return false
}

function applyCarryForward(result, client, month, entries) {
  if (isPauseText(client.waitStatus)) {
    return {
      label: 'paused',
      score: 0,
      reason: 'На паузе — не трогаем, пока снова не начнут работу.',
      carried: false,
    }
  }
  if (result.label !== 'passive') return { ...result, carried: false }
  if (hasCrmWork(entries)) return { ...result, carried: false }
  if (!hadRecentWork(client, month)) return { ...result, carried: false }
  return {
    label: 'active',
    score: Math.max(Number(result.score) || 0, 55),
    reason:
      'Активность не сбрасывается с 1-го числа: в этом месяце новых записей пока нет, работа с прошлого месяца продолжается.',
    carried: true,
  }
}

/** Label from the CRM journal (what you see in История), not Groq chat-style rules. */
function applyDayThreshold(result, activeDaysCount, minDays, waitStatus, entries = []) {
  const label = classifyLabel(entries, waitStatus)
  const groqReason = String(result?.reason || '').trim()
  const groqLooksWrong =
    /клиент не ответ|нет ответ|формальн|нет перегово|не отвечает/i.test(groqReason)
  const reason = (groqReason && !groqLooksWrong ? groqReason : autoReason(entries, label)).slice(
    0,
    280,
  )

  let score = Number(result?.score)
  if (!Number.isFinite(score)) score = 0
  if (label === 'active') {
    const min = Math.max(1, Number(minDays) || DEFAULT_MIN_DAYS)
    score = Math.max(score, Math.min(100, 55 + activeDaysCount * 5, Math.round((activeDaysCount / min) * 80)))
  } else if (label === 'passive') {
    score = Math.min(score, 25)
  }
  return { label, score, reason }
}

function buildActivityPrompt(template, input) {
  const historyText =
    input.monthHistory.length > 0
      ? input.monthHistory
          .map((h) => {
            const type = HISTORY_TYPE_LABELS[h.type] || h.type || 'запись'
            return `- ${h.date} — ${type}: ${h.text}`
          })
          .join('\n')
      : '- Записей за месяц нет'

  return String(template || DEFAULT_ACTIVITY_PROMPT)
    .split('{clientName}')
    .join(input.clientName)
    .split('{stage}')
    .join(input.stage)
    .split('{waitStatus}')
    .join(input.waitStatus || 'не указан')
    .split('{activeDaysCount}')
    .join(String(input.activeDaysCount))
    .split('{minActiveDaysRequired}')
    .join(String(input.minActiveDaysRequired))
    .split('{daysSinceLastTouch}')
    .join(String(input.daysSinceLastTouch))
    .split('{monthHistory}')
    .join(historyText)
}

function parseActivityResult(raw, fallbackDays, minDays) {
  const fallbackLabel = fallbackDays >= minDays ? 'active' : 'passive'
  const fallback = {
    label: fallbackLabel,
    score: 0,
    reason: 'Авто-оценка по количеству дней',
  }
  try {
    const match = String(raw || '').match(/\{[\s\S]*\}/)
    const obj = JSON.parse(match ? match[0] : '{}')
    const label = ['active', 'passive', 'paused'].includes(obj.label) ? obj.label : fallbackLabel
    const score = Math.max(0, Math.min(100, Number(obj.score)))
    const reason = String(obj.reason || fallback.reason).slice(0, 280)
    return { label, score: Number.isFinite(score) ? score : 0, reason }
  } catch {
    return fallback
  }
}

async function loadConfig(db) {
  const snap = await db.doc('ai_config/activity_settings').get()
  const data = snap.exists ? snap.data() || {} : {}
  const storedPrompt = String(data.activityPrompt || '')
  const legacyPrompt =
    /клиент отвечает|смотри на содержание|формальные \(|нет конкретных обсуждений/i.test(
      storedPrompt,
    )
  return {
    minActiveDays: Math.max(1, Number(data.minActiveDays) || DEFAULT_MIN_DAYS),
    activityPrompt: !storedPrompt.trim() || legacyPrompt ? DEFAULT_ACTIVITY_PROMPT : storedPrompt,
    isActive: data.isActive !== false,
    minKpiMoments: Math.max(3, Number(data.minKpiMoments) || DEFAULT_MIN_MOMENTS),
    kpiPrompt:
      !String(data.kpiPrompt || '').trim() ||
      /4 содержательных шага|3 разных дня|все четыре пункта/i.test(String(data.kpiPrompt || '')) ||
      !/3 содержательных шага/i.test(String(data.kpiPrompt || '')) ||
      !/на паузе/i.test(String(data.kpiPrompt || '')) ||
      !/заброш|тишин/i.test(String(data.kpiPrompt || ''))
        ? DEFAULT_KPI_PROMPT
        : data.kpiPrompt,
  }
}

async function loadMonthHistory(db, clientId, month) {
  let snap
  try {
    snap = await db
      .collection('client_history')
      .where('clientId', '==', clientId)
      .orderBy('createdAt', 'desc')
      .limit(80)
      .get()
  } catch (err) {
    console.error('history ordered query failed, fallback', clientId, err)
    snap = await db.collection('client_history').where('clientId', '==', clientId).limit(80).get()
  }

  return snap.docs
    .map((d) => {
      const data = d.data() || {}
      return {
        date: formatHistoryDate(data.createdAt),
        type: data.type || '',
        authorName: data.authorName || '',
        text: data.text || '',
      }
    })
    .filter((h) => typeof h.date === 'string' && h.date.startsWith(month))
}

async function analyzeWithGroq(groq, input, config) {
  const prompt = buildActivityPrompt(config.activityPrompt, input)
  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 120,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    })
    const raw = completion.choices[0]?.message?.content?.trim()
    return parseActivityResult(raw, input.activeDaysCount, input.minActiveDaysRequired)
  } catch (error) {
    console.error(`Groq activity analysis error for ${input.clientId}:`, error)
    try {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 120,
        temperature: 0.2,
      })
      const raw = completion.choices[0]?.message?.content?.trim()
      return parseActivityResult(raw, input.activeDaysCount, input.minActiveDaysRequired)
    } catch (retryError) {
      console.error(`Groq activity fallback failed for ${input.clientId}:`, retryError)
      return parseActivityResult('', input.activeDaysCount, input.minActiveDaysRequired)
    }
  }
}

function resolveAnalysisMonth(options) {
  const raw = String(options?.month || '').trim()
  if (/^\d{4}-\d{2}$/.test(raw) && raw <= tashkentMonth()) return raw
  return tashkentMonth()
}

function analyzedMs(client) {
  const at = client.activityAnalyzedAt
  if (!at) return 0
  if (typeof at.toDate === 'function') {
    try {
      return at.toDate().getTime()
    } catch {
      /* fall through */
    }
  }
  const seconds = at.seconds || at._seconds
  if (typeof seconds === 'number') return seconds * 1000
  const parsed = Date.parse(String(at))
  return Number.isFinite(parsed) ? parsed : 0
}

function alreadyDoneThisRun(client, month, runStartedAt) {
  if (client.activityMonth !== month) return false
  const started = Date.parse(String(runStartedAt || ''))
  if (!Number.isFinite(started)) return alreadyAnalyzedToday(client, tashkentToday(), month)
  return analyzedMs(client) >= started - 2000
}

function alreadyAnalyzedToday(client, todayStr, month) {
  if (client.activityMonth !== month) return false
  const analyzed = formatHistoryDate(client.activityAnalyzedAt)
  return analyzed === todayStr
}

async function analyzeOneClient(db, groq, client, config, month, todayStr, options = {}) {
  let history = []
  try {
    history = await loadMonthHistory(db, client.id, month)
  } catch (err) {
    console.error(`history load failed for ${client.id}:`, err)
  }
  const activeDaysCount = calculateActiveDays(history)
  const input = {
    clientId: client.id,
    clientName: client.name || '',
    stage: STAGE_LABELS[client.stage] || client.stage || '',
    currentMonth: month,
    activeDaysCount,
    minActiveDaysRequired: config.minActiveDays,
    monthHistory: history,
    waitStatus: client.waitStatus || null,
    daysSinceLastTouch: daysDiff(resolveTouchDate(client, todayStr), todayStr),
  }
  if (isPauseText(client.waitStatus)) {
    const paused = {
      label: 'paused',
      score: 0,
      reason: 'На паузе — не трогаем, пока снова не начнут работу.',
      carried: false,
    }
    await db.collection('clients').doc(client.id).update({
      activityScore: 0,
      activityLabel: 'paused',
      activityMonth: month,
      activityAnalyzedAt: FieldValue.serverTimestamp(),
      activityReason: paused.reason,
      activeDaysThisMonth: 0,
      activityCarriedFrom: null,
      updatedAt: FieldValue.serverTimestamp(),
    })
    let kpi = null
    try {
      kpi = await qualifyLeadForKpi(
        db,
        groq,
        { ...client, activityLabel: 'paused', activityMonth: month, activeDaysThisMonth: 0 },
        history,
        config,
        month,
        options,
      )
    } catch (err) {
      console.error(`KPI step failed for ${client.id}:`, err)
    }
    return { ...paused, activeDaysCount: 0, input, kpi }
  }
  const groqResult = { label: 'passive', score: 0, reason: '' }
  const classified = applyDayThreshold(
    groqResult,
    activeDaysCount,
    config.minActiveDays,
    client.waitStatus,
    history,
  )
  const result =
    month === tashkentMonth()
      ? applyCarryForward(classified, client, month, history)
      : { ...classified, carried: false }
  const prevMonth = previousYearMonth(month)
  await db.collection('clients').doc(client.id).update({
    activityScore: result.score,
    activityLabel: result.label,
    activityMonth: month,
    activityAnalyzedAt: FieldValue.serverTimestamp(),
    activityReason: result.reason,
    activeDaysThisMonth: activeDaysCount,
    activityCarriedFrom: result.carried ? client.activityCarriedFrom || prevMonth : null,
    updatedAt: FieldValue.serverTimestamp(),
  })
  let kpi = null
  try {
    if (!hasCrmWork(history) && client.stage !== 'deal') {
      kpi = { skipped: 'empty_month_carry', qualifies: false }
    } else {
      kpi = await qualifyLeadForKpi(
      db,
      groq,
      {
        ...client,
        activityLabel: result.label,
        activityMonth: month,
        activeDaysThisMonth: activeDaysCount,
      },
      history,
      config,
      month,
      options,
    )
    }
  } catch (err) {
    console.error(`KPI step failed for ${client.id}:`, err)
  }
  return { ...result, activeDaysCount, input, kpi }
}

/**
 * Analyze open leads for a month (default: current Tashkent month).
 * @param {{ maxClients?: number, clientId?: string, force?: boolean, month?: string, runStartedAt?: string, timeBudgetMs?: number }} options
 */
async function runActivityAnalysis(db, apiKey, options = {}) {
  const config = await loadConfig(db)
  if (!config.isActive && !options.force) {
    return { ok: true, skippedAll: true, reason: 'Activity analysis disabled', processed: 0, remaining: 0 }
  }

  const groqClient = new Groq({ apiKey: String(apiKey || '') })
  const month = resolveAnalysisMonth(options)
  const todayStr = tashkentToday()
  const maxClients = Number(options.maxClients) || 40
  const deadline = Date.now() + (Number(options.timeBudgetMs) || 50000)
  const runStartedAt = options.runStartedAt || null

  if (options.clientId) {
    const snap = await db.collection('clients').doc(options.clientId).get()
    if (!snap.exists) {
      const err = new Error('Клиент не найден')
      err.status = 404
      throw err
    }
    const client = { id: snap.id, ...snap.data() }
    const analyzed = await analyzeOneClient(db, groqClient, client, config, month, todayStr, options)
    return {
      ok: true,
      month,
      processed: 1,
      remaining: 0,
      result: {
        label: analyzed.label,
        score: analyzed.score,
        reason: analyzed.reason,
        activeDaysCount: analyzed.activeDaysCount,
        minActiveDays: config.minActiveDays,
        kpi: analyzed.kpi || null,
      },
    }
  }

  const clientsSnap = await db.collection('clients').get()
  const candidates = []
  for (const docSnap of clientsSnap.docs) {
    const client = { id: docSnap.id, ...docSnap.data() }
    if (FINAL_STAGES.has(client.stage)) continue
    if (runStartedAt) {
      if (alreadyDoneThisRun(client, month, runStartedAt)) continue
    } else if (!options.force && alreadyAnalyzedToday(client, todayStr, month)) {
      continue
    }
    candidates.push(client)
  }

  const batch = candidates.slice(0, maxClients)
  let processed = 0
  let errors = 0
  let lastError = ''
  for (const client of batch) {
    if (Date.now() > deadline) break
    try {
      await analyzeOneClient(db, groqClient, client, config, month, todayStr, options)
      processed += 1
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS))
    } catch (error) {
      console.error(`Activity analysis error for ${client.id}:`, error)
      lastError = error?.message || String(error)
      if (/RESOURCE_EXHAUSTED|Quota exceeded/i.test(lastError)) {
        errors += 1
        break
      }
      try {
        const failHistory = await loadMonthHistory(db, client.id, month).catch(() => [])
        const failDays = calculateActiveDays(failHistory)
        const failedRaw = applyDayThreshold(
          { label: 'passive', score: 0, reason: 'Авто-оценка: сбой анализа' },
          failDays,
          config.minActiveDays,
          client.waitStatus,
          failHistory,
        )
        const failed = applyCarryForward(failedRaw, client, month, failHistory)
        await db.collection('clients').doc(client.id).update({
          activityScore: failed.score,
          activityLabel: failed.label,
          activityMonth: month,
          activityAnalyzedAt: FieldValue.serverTimestamp(),
          activityReason: failed.reason,
          activeDaysThisMonth: failDays,
          activityCarriedFrom: failed.carried ? previousYearMonth(month) : null,
          updatedAt: FieldValue.serverTimestamp(),
        })
        processed += 1
      } catch (writeErr) {
        errors += 1
        lastError = writeErr?.message || lastError
      }
    }
  }

  if (Date.now() < deadline) {
    for (const docSnap of clientsSnap.docs) {
      if (Date.now() > deadline) break
      const client = { id: docSnap.id, ...docSnap.data() }
      if (client.stage !== 'deal') continue
      if (resolveActiveMonths(client, month) !== 1) continue
      try {
        await qualifyLeadForKpi(db, groqClient, client, [], config, month, options)
      } catch (err) {
        console.error(`KPI auto-deal failed for ${client.id}:`, err)
      }
    }
  }

  return {
    ok: true,
    month,
    candidates: candidates.length,
    processed,
    remaining: Math.max(0, candidates.length - processed),
    errors,
    lastError: lastError || undefined,
  }
}

async function testClientActivity(db, apiKey, clientId, configOverride) {
  const groqClient = new Groq({ apiKey: String(apiKey || '') })
  const preview = await buildTestPreview(db, clientId, configOverride)
  const result = applyDayThreshold(
    await analyzeWithGroq(groqClient, preview.input, preview.config),
    preview.input.activeDaysCount,
    preview.config.minActiveDays,
    preview.input.waitStatus,
    preview.input.monthHistory,
  )
  return {
    label: result.label,
    score: result.score,
    reason: result.reason,
    activeDaysCount: preview.input.activeDaysCount,
    minActiveDays: preview.config.minActiveDays,
    clientName: preview.input.clientName,
  }
}

async function testClientKpi(db, apiKey, clientId, configOverride) {
  const groqClient = new Groq({ apiKey: String(apiKey || '') })
  const preview = await buildTestPreview(db, clientId, configOverride)
  return testKpiQualification(
    db,
    groqClient,
    preview.client,
    preview.history,
    preview.config,
    tashkentMonth(),
  )
}

async function buildTestPreview(db, clientId, configOverride) {
  const config = { ...(await loadConfig(db)), ...(configOverride || {}) }
  const snap = await db.collection('clients').doc(clientId).get()
  if (!snap.exists) {
    const err = new Error('Клиент не найден')
    err.status = 404
    throw err
  }
  const client = { id: snap.id, ...snap.data() }
  const month = tashkentMonth()
  const todayStr = tashkentToday()
  const history = await loadMonthHistory(db, client.id, month)
  const activeDaysCount = calculateActiveDays(history)
  const input = {
    clientId: client.id,
    clientName: client.name || '',
    stage: STAGE_LABELS[client.stage] || client.stage || '',
    currentMonth: month,
    activeDaysCount,
    minActiveDaysRequired: config.minActiveDays,
    monthHistory: history,
    waitStatus: client.waitStatus || null,
    daysSinceLastTouch: daysDiff(resolveTouchDate(client, todayStr), todayStr),
  }
  return {
    input,
    prompt: buildActivityPrompt(config.activityPrompt, input),
    config,
    client,
    history,
  }
}

module.exports = {
  runActivityAnalysis,
  analyzeOneClient,
  buildActivityPrompt,
  buildTestPreview,
  testClientActivity,
  testClientKpi,
  loadConfig,
  DEFAULT_ACTIVITY_PROMPT,
  calculateActiveDays,
  applyDayThreshold,
  classifyLabel,
  hasCrmWork,
}
