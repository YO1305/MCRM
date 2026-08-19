const { FieldValue } = require('firebase-admin/firestore')
const { createGroqClient, GROQ_MODEL } = require('./groqClient')

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

const FINAL_STAGES = new Set(['deal', 'rejected', 'failed', 'abandoned'])
const BATCH_SIZE = 25
const BATCH_DELAY_MS = 62000
const REQUEST_DELAY_MS = 200

function tashkentToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })
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

function resolveTouchDate(client, todayStr, history) {
  if (isIsoDay(client.lastTouchDate)) return client.lastTouchDate
  if (Array.isArray(history) && history.length) {
    const fromHistory = formatHistoryDate(history[0].createdAt)
    if (isIsoDay(fromHistory)) return fromHistory
  }
  return resolveOpenedDate(client, todayStr)
}

function resolveMovementDate(client, todayStr) {
  if (isIsoDay(client.lastStageChangeDate)) return client.lastStageChangeDate
  return resolveOpenedDate(client, todayStr)
}

function daysAgoPhrase(days) {
  if (days === 0) return 'сегодня'
  const mod10 = days % 10
  const mod100 = days % 100
  let word = 'дней'
  if (mod10 === 1 && mod100 !== 11) word = 'день'
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = 'дня'
  return `${days} ${word} назад`
}

function isLeadFinal(stage) {
  return FINAL_STAGES.has(stage)
}

function formatHistoryDate(createdAt) {
  if (!createdAt) return tashkentToday()
  if (typeof createdAt.toDate === 'function') {
    return createdAt.toDate().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })
  }
  if (createdAt.seconds) {
    return new Date(createdAt.seconds * 1000).toLocaleDateString('en-CA', {
      timeZone: 'Asia/Tashkent',
    })
  }
  return String(createdAt).slice(0, 10)
}

function collectLeadSnapshot(client, history, todayStr) {
  const daysTouch = daysDiff(resolveTouchDate(client, todayStr, history), todayStr)
  const daysMove = daysDiff(resolveMovementDate(client, todayStr), todayStr)
  return {
    clientId: client.id,
    clientName: client.name || '',
    company: client.company || '',
    category: client.category || '',
    stage: STAGE_LABELS[client.stage] || client.stage || '',
    waitStatus: client.waitStatus || null,
    nextStep: client.nextStep || null,
    nextStepDeadline: client.nextStepDeadline || null,
    lastTouchDate: resolveTouchDate(client, todayStr, history),
    daysSinceTouch: daysTouch,
    daysSinceMovement: daysMove,
    daysSinceStageChange: daysMove,
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

function buildPromptFromTemplate(template, lead, maxActiveMonths) {
  const historyText =
    lead.recentHistory.length > 0
      ? lead.recentHistory
          .map((h) => `- ${h.date} [${h.type}] ${h.authorName}: ${h.text}`)
          .join('\n')
      : '- История пуста'

  const filled = String(template || buildPrompt(lead))
    .split('{clientName}').join(lead.clientName)
    .split('{company}').join(lead.company || 'не указана')
    .split('{category}').join(lead.category || 'не указана')
    .split('{stage}').join(lead.stage)
    .split('{waitStatus}').join(lead.waitStatus || 'не указан')
    .split('{nextStep}').join(lead.nextStep || 'не указан')
    .split('{nextStepDeadline}').join(lead.nextStepDeadline || 'не указан')
    .split('{daysSinceTouch}').join(String(lead.daysSinceTouch))
    .split('{daysSinceMovement}').join(String(lead.daysSinceMovement))
    .split('{activeMonthsCount}').join(String(lead.activeMonthsCount))
    .split('{maxActiveMonths}').join(String(maxActiveMonths ?? 3))
    .split('{recentHistory}').join(historyText)

  const hardRules = `

ЖЁСТКИЕ ОГРАНИЧЕНИЯ (обязательно соблюдай):
- Пиши нейтрально от системы, НЕ от имени менеджера и НЕ от имени «Отабек» / любого автора из истории. Не используй «я», «мне», «от меня».
- Заметки менеджера о запросе клиента (документы, КП, образцы, вопросы) = работа ЕЩЁ впереди. Не пиши, будто уже всё отправлено или клиенту уже ответили.
- ЗАПРЕЩЕНО генерировать готовое сообщение/письмо клиенту в кавычках или «напиши ему: …». Только действие: что сделать по клиенту (подготовить, отправить, уточнить у ассистента, напомнить о сроке).
- Если клиент «на паузе» / в статусе ожидания — учти, чего ждём; дай совет или напоминание о действии, не ломай паузу без причины.
- Не дублируй уже запланированный менеджером следующий шаг.
- Сначала проанализируй этап, ожидание, историю и сроки, потом одну короткую задачу или совет-действие.`

  return `${filled}${hardRules}`
}

async function analyzeLeadWithGroq(groq, lead, config = {}) {
  try {
    const content = config.promptTemplate
      ? buildPromptFromTemplate(config.promptTemplate, lead, config.maxActiveMonths)
      : buildPrompt(lead)
    const completion = await groq.chat.completions.create({
      model: config.model || GROQ_MODEL,
      messages: [{ role: 'user', content }],
      max_tokens: config.maxTokens || 150,
      temperature: config.temperature ?? 0.4,
    })
    const taskText = completion.choices[0]?.message?.content?.trim()
    if (!taskText) throw new Error('Empty response from Groq')
    return taskText
  } catch (error) {
    console.error(`Groq error for client ${lead.clientId}:`, error)
    return `Проверь статус по клиенту ${lead.clientName} — последний контакт был ${daysAgoPhrase(lead.daysSinceTouch)}.`
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
  if (lead.daysSinceTouch > 20) return 'reactivate'
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
    const generatedAt = data.generatedAt
    if (!generatedAt) return false
    return formatHistoryDate(generatedAt) === todayStr
  })

  if (alreadyCreatedToday) {
    console.log(`AI task already exists for client ${lead.clientId} today, skipping`)
    return false
  }

  await db.collection('ai_tasks').add({
    clientId: lead.clientId,
    clientName: lead.clientName,
    assignedTo: lead.assignedTo,
    assignedToName: lead.assignedToName,
    taskText,
    taskType,
    kind: taskKind || 'action',
    status: 'pending',
    generatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  })
  return true
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runDailyAiLeadAnalysis(db, apiKey) {
  const groq = createGroqClient(apiKey)
  const todayStr = tashkentToday()
  console.log('Starting daily AI lead analysis...', todayStr)

  const configSnap = await db.doc('ai_config/groq_settings').get()
  const cfg = configSnap.exists ? configSnap.data() : {}
  if (cfg.isActive === false) {
    console.log('AI analysis disabled in config, skipping')
    return
  }
  const enabledSet = new Set(Array.isArray(cfg.enabledForManagers) ? cfg.enabledForManagers : [])
  const model = cfg.model || GROQ_MODEL
  const temperature = cfg.temperature ?? 0.4
  const maxTokens = cfg.maxTokens ?? 150

  const clientsSnap = await db.collection('clients').get()
  const activeDocs = clientsSnap.docs.filter((docSnap) => {
    const client = docSnap.data() || {}
    if (isLeadFinal(client.stage)) return false
    if (client.activityStatus === 'frozen') return false
    if (!client.assignedTo) return false
    if (enabledSet.size && !enabledSet.has(client.assignedTo)) return false
    if (String(client.nextStep || '').trim()) return false
    const waitStatus = String(client.waitStatus || '').trim()
    if (waitStatus) {
      const followUp = client.waitFollowUpDate || null
      const todayStr = tashkentToday()
      if (followUp && followUp > todayStr) return false
      if (!followUp) {
        const daysSinceTouch = daysDiff(resolveTouchDate(client, todayStr), todayStr)
        const grace = cfg.waitChaseMinDays ?? 5
        if (daysSinceTouch < grace) return false
      }
    }
    return true
  })

  console.log(`Analyzing ${activeDocs.length} active leads`)

  for (let i = 0; i < activeDocs.length; i += BATCH_SIZE) {
    const batch = activeDocs.slice(i, i + BATCH_SIZE)
    for (const docSnap of batch) {
      const client = { id: docSnap.id, ...docSnap.data() }
      try {
        const historySnap = await db
          .collection('client_history')
          .where('clientId', '==', client.id)
          .orderBy('createdAt', 'desc')
          .limit(5)
          .get()
        const history = historySnap.docs.map((d) => d.data())
        const snapshot = collectLeadSnapshot(client, history, todayStr)

        if (snapshot.daysSinceTouch === 0) {
          console.log(`Skipping ${client.name} — touched today`)
          continue
        }

        const taskText = await analyzeLeadWithGroq(groq, snapshot, {
          model,
          temperature,
          maxTokens,
          promptTemplate: cfg.promptTemplate,
          maxActiveMonths: cfg.maxActiveMonths ?? 3,
        })
        const taskType = detectTaskType(taskText, snapshot)
        const taskKind = detectTaskKind(taskText, taskType, snapshot)
        await saveAiTask(db, snapshot, taskText, taskType, taskKind, todayStr)
        await sleep(REQUEST_DELAY_MS)
      } catch (error) {
        console.error(`Error processing lead ${client.id}:`, error)
      }
    }
    if (i + BATCH_SIZE < activeDocs.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  console.log('Daily AI lead analysis complete')
}

module.exports = { runDailyAiLeadAnalysis }
