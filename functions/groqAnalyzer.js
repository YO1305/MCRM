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

function daysDiff(fromDate, todayStr) {
  if (!fromDate) return 999
  const from = new Date(`${fromDate}T00:00:00`)
  const to = new Date(`${todayStr}T00:00:00`)
  return Math.round((to.getTime() - from.getTime()) / 86400000)
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

  const clientsSnap = await db.collection('clients').get()
  const activeDocs = clientsSnap.docs.filter((docSnap) => {
    const client = docSnap.data() || {}
    if (isLeadFinal(client.stage)) return false
    if (client.activityStatus === 'frozen') return false
    if (!client.assignedTo) return false
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

        const taskText = await analyzeLeadWithGroq(groq, snapshot)
        const taskType = detectTaskType(taskText, snapshot)
        await saveAiTask(db, snapshot, taskText, taskType, todayStr)
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
