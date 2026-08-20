const { FieldValue } = require('firebase-admin/firestore')
const Groq = require('groq-sdk')

const FINAL_STAGES = new Set(['deal', 'rejected', 'failed', 'abandoned'])
const REQUEST_DELAY_MS = 300
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

const DEFAULT_ACTIVITY_PROMPT = `Ты аналитик CRM системы текстильной компании BAHMAL HOME (Узбекистан).

Проанализируй активность по клиенту за текущий месяц и определи:
активный лид или пассивный.

ДАННЫЕ КЛИЕНТА:
- Имя: {clientName}
- Этап воронки: {stage}
- Статус ожидания: {waitStatus}
- Дней с активностью в этом месяце: {activeDaysCount} (минимум нужно: {minActiveDaysRequired})
- Дней без контакта: {daysSinceLastTouch}

ИСТОРИЯ ЗА ТЕКУЩИЙ МЕСЯЦ:
{monthHistory}

ПРАВИЛА ОЦЕНКИ:

Активный лид (active) — если:
- Идут реальные переговоры: обсуждение цены, объёма, условий, прайса, образцов
- Клиент отвечает и задаёт вопросы по существу
- Менеджер и клиент обмениваются конкретной информацией
- Есть движение вперёд даже если медленное

Пассивный лид (passive) — если:
- Менеджер пишет но клиент не отвечает или отвечает формально
- Нет конкретных обсуждений цены, объёма, условий
- Записи формальные ("напомнил", "написал" без результата)

На паузе (paused) — если:
- Явно стоит статус "На паузе" или "Ждём решения" долго без ответа
- Клиент попросил подождать
- Нет активности больше 14 дней подряд

ЖЁСТКО (важнее содержания):
- Если дней с активностью >= минимума — label только "active"
- Шаги, смена этапа, звонок, комментарий, назначение продаж = активность
- "passive" только если дней меньше порога
- "paused" только если статус ожидания явно "На паузе"
- В reason кратко опиши, что было в истории

Ответь строго в формате JSON:
{
  "label": "active" | "passive" | "paused",
  "score": 0-100,
  "reason": "краткое объяснение на русском (1 предложение)"
}`

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

/** Day count wins over Groq content judgment. */
function applyDayThreshold(result, activeDaysCount, minDays, waitStatus) {
  const min = Math.max(1, Number(minDays) || DEFAULT_MIN_DAYS)
  const groqLabel = result?.label
  let label = 'passive'
  if (isPauseText(waitStatus)) label = 'paused'
  else if (activeDaysCount >= min) label = 'active'

  let reason = String(result?.reason || 'Авто-оценка по количеству дней')
  if (label !== groqLabel) {
    const prefix =
      label === 'paused'
        ? 'Стоит «на паузе».'
        : `В истории ${activeDaysCount} дн. при пороге ${min} — ${
            label === 'active' ? 'активный' : 'пассивный'
          }.`
    reason = `${prefix} ${reason}`.trim()
  }

  let score = Number(result?.score)
  if (!Number.isFinite(score)) score = 0
  if (label === 'active') {
    score = Math.max(score, Math.min(100, Math.round((activeDaysCount / min) * 70)))
  } else if (label === 'passive') {
    score = Math.min(score, 45)
  }
  return { label, score, reason: reason.slice(0, 280) }
}

function buildActivityPrompt(template, input) {
  const historyText =
    input.monthHistory.length > 0
      ? input.monthHistory
          .map((h) => `- ${h.date} [${h.type}] ${h.authorName}: ${h.text}`)
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
  return {
    minActiveDays: Math.max(1, Number(data.minActiveDays) || DEFAULT_MIN_DAYS),
    activityPrompt: data.activityPrompt || DEFAULT_ACTIVITY_PROMPT,
    isActive: data.isActive !== false,
  }
}

async function loadMonthHistory(db, clientId, month) {
  let snap
  try {
    snap = await db
      .collection('client_history')
      .where('clientId', '==', clientId)
      .orderBy('createdAt', 'desc')
      .limit(250)
      .get()
  } catch (err) {
    console.error('history ordered query failed, fallback', clientId, err)
    snap = await db.collection('client_history').where('clientId', '==', clientId).limit(250).get()
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

function alreadyAnalyzedToday(client, todayStr, month) {
  if (client.activityMonth !== month) return false
  const analyzed = formatHistoryDate(client.activityAnalyzedAt)
  return analyzed === todayStr
}

async function analyzeOneClient(db, groq, client, config, month, todayStr) {
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
  const groqResult = await analyzeWithGroq(groq, input, config)
  const result = applyDayThreshold(
    groqResult,
    activeDaysCount,
    config.minActiveDays,
    client.waitStatus,
  )
  await db.collection('clients').doc(client.id).update({
    activityScore: result.score,
    activityLabel: result.label,
    activityMonth: month,
    activityAnalyzedAt: FieldValue.serverTimestamp(),
    activityReason: result.reason,
    activeDaysThisMonth: activeDaysCount,
    updatedAt: FieldValue.serverTimestamp(),
  })
  return { ...result, activeDaysCount, input }
}

/**
 * Analyze open leads for the current Tashkent month.
 * @param {{ maxClients?: number, clientId?: string, force?: boolean }} options
 */
async function runActivityAnalysis(db, apiKey, options = {}) {
  const config = await loadConfig(db)
  if (!config.isActive && !options.force) {
    return { ok: true, skippedAll: true, reason: 'Activity analysis disabled', processed: 0, remaining: 0 }
  }

  const groqClient = new Groq({ apiKey: String(apiKey || '') })
  const month = tashkentMonth()
  const todayStr = tashkentToday()
  const maxClients = Number(options.maxClients) || 40
  const deadline = Date.now() + (Number(options.timeBudgetMs) || 50000)

  if (options.clientId) {
    const snap = await db.collection('clients').doc(options.clientId).get()
    if (!snap.exists) {
      const err = new Error('Клиент не найден')
      err.status = 404
      throw err
    }
    const client = { id: snap.id, ...snap.data() }
    const analyzed = await analyzeOneClient(db, groqClient, client, config, month, todayStr)
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
      },
    }
  }

  const clientsSnap = await db.collection('clients').get()
  const candidates = []
  for (const docSnap of clientsSnap.docs) {
    const client = { id: docSnap.id, ...docSnap.data() }
    if (FINAL_STAGES.has(client.stage)) continue
    if (!options.force && alreadyAnalyzedToday(client, todayStr, month)) continue
    candidates.push(client)
  }

  const batch = candidates.slice(0, maxClients)
  let processed = 0
  let errors = 0
  let lastError = ''
  for (const client of batch) {
    if (Date.now() > deadline) break
    try {
      await analyzeOneClient(db, groqClient, client, config, month, todayStr)
      processed += 1
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS))
    } catch (error) {
      console.error(`Activity analysis error for ${client.id}:`, error)
      lastError = error?.message || String(error)
      try {
        const failDays = calculateActiveDays(
          await loadMonthHistory(db, client.id, month).catch(() => []),
        )
        const failed = applyDayThreshold(
          { label: 'passive', score: 0, reason: 'Авто-оценка: сбой анализа' },
          failDays,
          config.minActiveDays,
          client.waitStatus,
        )
        await db.collection('clients').doc(client.id).update({
          activityScore: failed.score,
          activityLabel: failed.label,
          activityMonth: month,
          activityAnalyzedAt: FieldValue.serverTimestamp(),
          activityReason: failed.reason,
          activeDaysThisMonth: failDays,
          updatedAt: FieldValue.serverTimestamp(),
        })
        processed += 1
      } catch (writeErr) {
        errors += 1
        lastError = writeErr?.message || lastError
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
  }
}

module.exports = {
  runActivityAnalysis,
  analyzeOneClient,
  buildActivityPrompt,
  buildTestPreview,
  testClientActivity,
  loadConfig,
  DEFAULT_ACTIVITY_PROMPT,
  calculateActiveDays,
  applyDayThreshold,
}
