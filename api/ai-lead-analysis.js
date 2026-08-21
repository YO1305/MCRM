import admin from 'firebase-admin'
import Groq from 'groq-sdk'

const GROQ_MODEL = 'llama-3.1-8b-instant'
const FINAL_STAGES = new Set(['deal', 'rejected', 'failed', 'abandoned'])
const REQUEST_DELAY_MS = 200
/** Hobby Vercel ~10s; keep batch small so the request finishes. */
const MAX_LEADS_PER_RUN = 12

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

function initAdmin() {
  if (admin.apps.length) return admin.app()
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    const err = new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON не задан в Vercel. Добавьте JSON ключ service account.',
    )
    err.code = 'NO_SERVICE_ACCOUNT'
    throw err
  }
  let sa
  try {
    sa = JSON.parse(raw)
  } catch {
    const err = new Error('FIREBASE_SERVICE_ACCOUNT_JSON: невалидный JSON')
    err.code = 'BAD_SERVICE_ACCOUNT'
    throw err
  }
  return admin.initializeApp({
    credential: admin.credential.cert(sa),
  })
}

function tashkentToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })
}

function daysDiff(fromDate, todayStr) {
  if (!fromDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(fromDate))) return null
  const from = new Date(`${fromDate}T00:00:00`)
  const to = new Date(`${todayStr}T00:00:00`)
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

function openedDateFromCreatedAt(createdAt) {
  if (!createdAt) return null
  if (typeof createdAt.toDate === 'function') {
    return createdAt.toDate().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })
  }
  if (createdAt.seconds) {
    return new Date(createdAt.seconds * 1000).toLocaleDateString('en-CA', {
      timeZone: 'Asia/Tashkent',
    })
  }
  return null
}

function resolveLastTouchDate(client, history) {
  if (client.lastTouchDate && /^\d{4}-\d{2}-\d{2}$/.test(client.lastTouchDate)) {
    return client.lastTouchDate
  }
  if (client.lastStageChangeDate && /^\d{4}-\d{2}-\d{2}$/.test(client.lastStageChangeDate)) {
    return client.lastStageChangeDate
  }
  if (client.openedDate && /^\d{4}-\d{2}-\d{2}$/.test(client.openedDate)) {
    return client.openedDate
  }
  if (client.openedMonth && /^\d{4}-\d{2}$/.test(client.openedMonth)) {
    return `${client.openedMonth}-01`
  }
  const fromCreated = openedDateFromCreatedAt(client.createdAt)
  if (fromCreated) return fromCreated
  if (history?.length) {
    let latest = null
    for (const h of history) {
      const d = formatHistoryDate(h.createdAt)
      if (d && (!latest || d > latest)) latest = d
    }
    if (latest) return latest
  }
  return null
}

function daysSinceTouchForLead(client, history, todayStr) {
  const touch = resolveLastTouchDate(client, history)
  if (!touch) return null
  return daysDiff(touch, todayStr)
}

function isRecurringTasksPaused(user, dateISO) {
  const until = user?.recurringTasksPausedUntil
  if (!until) return false
  const from = user?.recurringTasksPausedFrom || until
  return dateISO >= from && dateISO <= until
}

async function loadPausedManagerIds(db, todayStr) {
  const snap = await db.collection('users').get()
  const paused = new Set()
  for (const docSnap of snap.docs) {
    if (isRecurringTasksPaused(docSnap.data(), todayStr)) {
      paused.add(docSnap.id)
    }
  }
  return paused
}

function formatHistoryDate(createdAt) {
  if (!createdAt) return tashkentToday()
  if (typeof createdAt.toDate === 'function') {
    return createdAt.toDate().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })
  }
  if (createdAt._seconds) {
    return new Date(createdAt._seconds * 1000).toLocaleDateString('en-CA', {
      timeZone: 'Asia/Tashkent',
    })
  }
  if (createdAt.seconds) {
    return new Date(createdAt.seconds * 1000).toLocaleDateString('en-CA', {
      timeZone: 'Asia/Tashkent',
    })
  }
  return String(createdAt).slice(0, 10)
}

function collectLeadSnapshot(client, history, todayStr) {
  const resolvedTouch = resolveLastTouchDate(client, history)
  const daysSinceTouch = resolvedTouch ? daysDiff(resolvedTouch, todayStr) : null
  const daysSinceMovement = daysDiff(client.lastStageChangeDate, todayStr)
  return {
    clientId: client.id,
    clientName: client.name || '',
    company: client.company || '',
    category: client.category || '',
    stage: STAGE_LABELS[client.stage] || client.stage || '',
    waitStatus: client.waitStatus || null,
    nextStep: client.nextStep || null,
    nextStepDeadline: client.nextStepDeadline || null,
    lastTouchDate: resolvedTouch,
    daysSinceTouch,
    daysSinceMovement,
    activeMonthsCount: client.activeMonthsCount || 1,
    assignedTo: client.assignedTo,
    assignedToName: client.assignedToName || '',
    recentHistory: history.slice(0, 5).map((h) => ({
      type: h.type || '',
      text: h.text || '',
      authorName: h.authorName || '',
      date: formatHistoryDate(h.createdAt),
    })),
  }
}

function buildPromptFromTemplate(template, lead, maxActiveMonths) {
  const historyText =
    lead.recentHistory.length > 0
      ? lead.recentHistory
          .map((h) => `- ${h.date} [${h.type}] ${h.authorName}: ${h.text}`)
          .join('\n')
      : '- История пуста'

  const filled = String(template || '')
    .split('{clientName}').join(lead.clientName)
    .split('{company}').join(lead.company || 'не указана')
    .split('{category}').join(lead.category || 'не указана')
    .split('{stage}').join(lead.stage)
    .split('{waitStatus}').join(lead.waitStatus || 'не указан')
    .split('{nextStep}').join(lead.nextStep || 'не указан')
    .split('{nextStepDeadline}').join(lead.nextStepDeadline || 'не указан')
    .split('{daysSinceTouch}').join(
      lead.daysSinceTouch != null ? String(lead.daysSinceTouch) : 'не указано',
    )
    .split('{daysSinceMovement}').join(
      lead.daysSinceMovement != null ? String(lead.daysSinceMovement) : 'не указано',
    )
    .split('{activeMonthsCount}').join(String(lead.activeMonthsCount))
    .split('{maxActiveMonths}').join(String(maxActiveMonths ?? 3))
    .split('{recentHistory}').join(historyText)

  const hardRules = `

ЖЁСТКИЕ ОГРАНИЧЕНИЯ (обязательно соблюдай):
- Пиши нейтрально от системы, НЕ от имени менеджера и НЕ от имени «Отабек» / любого автора из истории. Не используй «я», «мне», «от меня».
- Заметки менеджера о запросе клиента (документы, КП, образцы, вопросы) = работа ЕЩЁ впереди. Не пиши, будто уже всё отправлено или клиенту уже ответили.
- ЗАПРЕЩЕНО генерировать готовое сообщение/письмо клиенту в кавычках или «напиши ему: …». Только действие: что сделать по клиенту (подготовить, отправить, уточнить у ассистента, напомнить о сроке).
- Если клиент «на паузе» / в статусе ожидания — НЕ советуй писать «мы ждём ответа». Только напоминание менеджеру о своём follow-up, если срок уже подошёл.
- Не дублируй уже запланированный менеджером следующий шаг.
- Не генерируй задачи в первые дни ожидания ответа клиента.
- Сначала проанализируй этап, ожидание, историю и сроки, потом одну короткую задачу или совет-действие.`

  return `${filled}${hardRules}`
}

function hasPlannedNextStep(client) {
  return Boolean(String(client.nextStep || '').trim())
}

function shouldSkipWhileWaiting(client, todayStr, graceDays = 5) {
  if (!String(client.waitStatus || '').trim()) return false
  const followUp = client.waitFollowUpDate || null
  if (followUp && followUp > todayStr) return true
  if (followUp && followUp <= todayStr) return false
  const days = daysSinceTouchForLead(client, [], todayStr)
  if (days == null) return false
  return days < graceDays
}

const DEFAULT_PROMPT = `Ты помощник менеджера по продажам в текстильной компании BAHMAL HOME (Узбекистан).
Проанализируй данные по клиенту и дай ОДНУ конкретную задачу на сегодня менеджеру.

ДАННЫЕ КЛИЕНТА:
- Имя: {clientName} ({company})
- Категория: {category}
- Этап воронки: {stage}
- Статус ожидания: {waitStatus}
- Следующий шаг: {nextStep}
- Срок следующего шага: {nextStepDeadline}
- Дней без контакта: {daysSinceTouch}
- Дней без движения по воронке: {daysSinceMovement}
- Месяц работы с лидом: {activeMonthsCount} из {maxActiveMonths}

ПОСЛЕДНИЕ ДЕЙСТВИЯ:
{recentHistory}

ПРАВИЛА:
1. Дай ОДНУ задачу — максимум 2 предложения
2. Задача должна быть конкретной
3. Отвечай только на русском языке
4. Начинай ответ сразу с задачи

Задача для менеджера на сегодня:`

async function loadAiConfig(db) {
  const snap = await db.doc('ai_config/groq_settings').get()
  const data = snap.exists ? snap.data() : {}
  return {
    model: data.model || GROQ_MODEL,
    temperature: data.temperature ?? 0.4,
    maxTokens: data.maxTokens ?? 150,
    maxActiveMonths: data.maxActiveMonths ?? 3,
    waitChaseMinDays: data.waitChaseMinDays ?? 5,
    promptTemplate: data.promptTemplate || DEFAULT_PROMPT,
    isActive: data.isActive !== false,
    enabledForManagers: Array.isArray(data.enabledForManagers) ? data.enabledForManagers : [],
  }
}

async function analyzeLeadWithGroq(groq, lead, config) {
  try {
    const prompt = buildPromptFromTemplate(
      config.promptTemplate,
      lead,
      config.maxActiveMonths,
    )
    const completion = await groq.chat.completions.create({
      model: config.model || GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: config.maxTokens || 150,
      temperature: config.temperature ?? 0.4,
    })
    const taskText = completion.choices[0]?.message?.content?.trim()
    if (!taskText) throw new Error('Empty response from Groq')
    return taskText
  } catch (error) {
    console.error(`Groq error for client ${lead.clientId}:`, error)
    return `Уточните актуальный статус по клиенту ${lead.clientName} — посмотрите этап воронки и последние действия в истории.`
  }
}

function detectTaskType(taskText, lead) {
  const text = String(taskText || '').toLowerCase()
  if (lead.waitStatus) return 'wait_advice'
  if (text.includes('трек') || text.includes('посылк') || text.includes('почт')) {
    return 'check_delivery'
  }
  if (text.includes('коммерческ') || text.includes('кп') || text.includes('прайс')) {
    return 'send_reminder'
  }
  if (text.includes('решени') || text.includes('готов') || text.includes('подтверд')) {
    return 'get_decision'
  }
  if (lead.activeMonthsCount >= 3) return 'close_or_drop'
  if (lead.daysSinceTouch != null && lead.daysSinceTouch > 20) return 'reactivate'
  if (!lead.nextStep || !lead.nextStepDeadline) return 'update_next_step'
  return 'follow_up'
}

function detectTaskKind(taskText, taskType, lead) {
  const text = String(taskText || '').toLowerCase()
  if (lead.waitStatus || taskType === 'wait_advice' || text.includes('совет')) {
    return 'tip'
  }
  if (taskType === 'send_reminder' || taskType === 'reactivate' || text.includes('напомн')) {
    return 'reminder'
  }
  return 'action'
}

async function saveAiTask(db, lead, taskText, taskType, taskKind, todayStr) {
  const existingTasks = await db
    .collection('ai_tasks')
    .where('clientId', '==', lead.clientId)
    .where('status', '==', 'pending')
    .get()

  const alreadyCreatedToday = existingTasks.docs.some((docSnap) => {
    const data = docSnap.data()
    if (!data.generatedAt) return false
    return formatHistoryDate(data.generatedAt) === todayStr
  })

  if (alreadyCreatedToday) return false

  await db.collection('ai_tasks').add({
    clientId: lead.clientId,
    clientName: lead.clientName,
    assignedTo: lead.assignedTo,
    assignedToName: lead.assignedToName,
    taskText,
    taskType,
    kind: taskKind || 'action',
    status: 'pending',
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  return true
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function assertCaller(req) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.authorization || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  // Vercel Cron
  if (req.method === 'GET') {
    if (cronSecret && bearer === cronSecret) return { kind: 'cron' }
    if (!cronSecret && req.headers['x-vercel-cron'] === '1') return { kind: 'cron' }
    if (cronSecret) {
      const err = new Error('Unauthorized cron')
      err.status = 401
      throw err
    }
  }

  if (!bearer) {
    const err = new Error('Нужно войти в систему')
    err.status = 401
    throw err
  }
  const decoded = await admin.auth().verifyIdToken(bearer)
  const callerSnap = await admin.firestore().collection('users').doc(decoded.uid).get()
  if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
    const err = new Error('Только администратор')
    err.status = 403
    throw err
  }
  return { kind: 'admin', uid: decoded.uid }
}

async function runAnalysis() {
  const apiKey = (process.env.GROQ_API_KEY || '').trim()
  if (!apiKey) {
    const err = new Error('GROQ_API_KEY не задан в Vercel Environment Variables')
    err.code = 'NO_GROQ_KEY'
    err.status = 503
    throw err
  }

  const groq = new Groq({ apiKey })
  const db = admin.firestore()
  const todayStr = tashkentToday()
  const config = await loadAiConfig(db)

  if (!config.isActive) {
    return {
      ok: true,
      skippedAll: true,
      reason: 'AI disabled in ai_config/groq_settings',
      today: todayStr,
      candidates: 0,
      processed: 0,
      remaining: 0,
      created: 0,
      skipped: 0,
      errors: 0,
    }
  }

  const enabledSet = new Set(config.enabledForManagers || [])
  const pausedManagers = await loadPausedManagerIds(db, todayStr)
  const clientsSnap = await db.collection('clients').get()
  const candidates = []

  for (const docSnap of clientsSnap.docs) {
    const client = { id: docSnap.id, ...docSnap.data() }
    if (FINAL_STAGES.has(client.stage)) continue
    if (!client.assignedTo) continue
    if (pausedManagers.has(client.assignedTo)) continue
    if (enabledSet.size && !enabledSet.has(client.assignedTo)) continue
    // Manager already planned next step — do not invent another AI task
    if (hasPlannedNextStep(client)) continue
    // Waiting for client reply — do not nag until follow-up day / grace period
    if (shouldSkipWhileWaiting(client, todayStr, config.waitChaseMinDays)) continue
    const daysSinceTouch = daysSinceTouchForLead(client, [], todayStr)
    if (daysSinceTouch === 0) continue
    candidates.push({ client, daysSinceTouch: daysSinceTouch ?? 0 })
  }

  candidates.sort((a, b) => b.daysSinceTouch - a.daysSinceTouch)
  const batch = candidates.slice(0, MAX_LEADS_PER_RUN)

  let created = 0
  let skipped = 0
  let errors = 0

  for (const { client } of batch) {
    try {
      const historySnap = await db
        .collection('client_history')
        .where('clientId', '==', client.id)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get()
      const history = historySnap.docs.map((d) => d.data())
      const snapshot = collectLeadSnapshot(client, history, todayStr)
      const taskText = await analyzeLeadWithGroq(groq, snapshot, config)
      const taskType = detectTaskType(taskText, snapshot)
      const taskKind = detectTaskKind(taskText, taskType, snapshot)
      const ok = await saveAiTask(db, snapshot, taskText, taskType, taskKind, todayStr)
      if (ok) created += 1
      else skipped += 1
      await sleep(REQUEST_DELAY_MS)
    } catch (error) {
      console.error(`Error processing lead ${client.id}:`, error)
      errors += 1
    }
  }

  return {
    ok: true,
    today: todayStr,
    candidates: candidates.length,
    processed: batch.length,
    remaining: Math.max(0, candidates.length - batch.length),
    created,
    skipped,
    errors,
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    initAdmin()
  } catch (err) {
    return res.status(503).json({
      error: err.message || 'Service account not configured',
      code: err.code || 'NO_SERVICE_ACCOUNT',
    })
  }

  try {
    await assertCaller(req)
    const result = await runAnalysis()
    return res.status(200).json(result)
  } catch (err) {
    const status = err.status || 500
    console.error('ai-lead-analysis', err)
    return res.status(status).json({
      error: err.message || 'Ошибка генерации ИИ-задач',
      code: err.code || 'AI_ERROR',
    })
  }
}
