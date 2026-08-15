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
  if (!fromDate) return 999
  const from = new Date(`${fromDate}T00:00:00`)
  const to = new Date(`${todayStr}T00:00:00`)
  return Math.round((to.getTime() - from.getTime()) / 86400000)
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
  return {
    clientId: client.id,
    clientName: client.name || '',
    company: client.company || '',
    category: client.category || '',
    stage: STAGE_LABELS[client.stage] || client.stage || '',
    waitStatus: client.waitStatus || null,
    nextStep: client.nextStep || null,
    nextStepDeadline: client.nextStepDeadline || null,
    lastTouchDate: client.lastTouchDate || null,
    daysSinceTouch: daysDiff(client.lastTouchDate, todayStr),
    daysSinceStageChange: daysDiff(client.lastStageChangeDate, todayStr),
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

function buildPrompt(lead) {
  const historyText =
    lead.recentHistory.length > 0
      ? lead.recentHistory
          .map((h) => `- ${h.date} [${h.type}] ${h.authorName}: ${h.text}`)
          .join('\n')
      : '- История пуста'

  return `Ты помощник менеджера по продажам в текстильной компании BAHMAL HOME (Узбекистан).
Проанализируй данные по клиенту и дай ОДНУ конкретную задачу на сегодня менеджеру.

ДАННЫЕ КЛИЕНТА:
- Имя: ${lead.clientName} (${lead.company})
- Категория: ${lead.category}
- Этап воронки: ${lead.stage}
- Статус ожидания: ${lead.waitStatus || 'не указан'}
- Следующий шаг: ${lead.nextStep || 'не указан'}
- Срок следующего шага: ${lead.nextStepDeadline || 'не указан'}
- Дней без контакта: ${lead.daysSinceTouch}
- Дней без движения по воронке: ${lead.daysSinceStageChange}
- Месяц работы с лидом: ${lead.activeMonthsCount} из 3

ПОСЛЕДНИЕ ДЕЙСТВИЯ:
${historyText}

ПРАВИЛА:
1. Дай ОДНУ задачу — максимум 2 предложения
2. Задача должна быть конкретной — что именно написать или спросить
3. Не используй общие фразы типа "свяжись с клиентом"
4. Учитывай контекст — что ждём, что было отправлено, сколько времени прошло
5. Если образцы отправлены — спроси про результат или трек-номер
6. Если КП отправлено давно — напомни и спроси о решении
7. Если клиент молчит — предложи конкретный текст сообщения
8. Отвечай только на русском языке
9. Начинай ответ сразу с задачи, без вступлений

Задача для менеджера на сегодня:`
}

async function analyzeLeadWithGroq(groq, lead) {
  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: buildPrompt(lead) }],
      max_tokens: 150,
      temperature: 0.4,
    })
    const taskText = completion.choices[0]?.message?.content?.trim()
    if (!taskText) throw new Error('Empty response from Groq')
    return taskText
  } catch (error) {
    console.error(`Groq error for client ${lead.clientId}:`, error)
    return `Проверь статус по клиенту ${lead.clientName} — последний контакт был ${lead.daysSinceTouch} дней назад.`
  }
}

function detectTaskType(taskText, lead) {
  const text = String(taskText || '').toLowerCase()
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
  if (lead.daysSinceTouch > 20) return 'reactivate'
  if (!lead.nextStep || !lead.nextStepDeadline) return 'update_next_step'
  return 'follow_up'
}

async function saveAiTask(db, lead, taskText, taskType, todayStr) {
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

  const clientsSnap = await db.collection('clients').get()
  const candidates = []

  for (const docSnap of clientsSnap.docs) {
    const client = { id: docSnap.id, ...docSnap.data() }
    if (FINAL_STAGES.has(client.stage)) continue
    if (client.activityStatus === 'frozen') continue
    if (!client.assignedTo) continue
    const daysSinceTouch = daysDiff(client.lastTouchDate, todayStr)
    if (daysSinceTouch === 0) continue
    candidates.push({ client, daysSinceTouch })
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
      const taskText = await analyzeLeadWithGroq(groq, snapshot)
      const taskType = detectTaskType(taskText, snapshot)
      const ok = await saveAiTask(db, snapshot, taskText, taskType, todayStr)
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
