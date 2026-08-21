const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { runDailyAiLeadAnalysis } = require('./groqAnalyzer')
const { runActivityAnalysis } = require('./leadActivityAnalyzer')

initializeApp()

const groqApiKey = defineSecret('GROQ_API_KEY')

/**
 * Admin-only: change employee login email and/or password in Firebase Auth
 * and sync email to Firestore users/{uid}.
 */
exports.adminSetUserCredentials = onCall(
  { region: 'us-central1', cors: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Нужно войти в систему')
    }

    const db = getFirestore()
    const caller = await db.collection('users').doc(request.auth.uid).get()
    if (!caller.exists || caller.data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Только администратор может менять логин/пароль')
    }

    const userId = String(request.data?.userId || '').trim()
    const emailRaw = request.data?.email
    const passwordRaw = request.data?.password

    if (!userId) {
      throw new HttpsError('invalid-argument', 'Не указан сотрудник')
    }

    const authUpdates = {}
    let newEmail = null

    if (typeof emailRaw === 'string' && emailRaw.trim()) {
      newEmail = emailRaw.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        throw new HttpsError('invalid-argument', 'Некорректный email')
      }
      authUpdates.email = newEmail
      authUpdates.emailVerified = true
    }

    if (typeof passwordRaw === 'string' && passwordRaw.length > 0) {
      if (passwordRaw.length < 6) {
        throw new HttpsError('invalid-argument', 'Пароль минимум 6 символов')
      }
      authUpdates.password = passwordRaw
    }

    if (!Object.keys(authUpdates).length) {
      throw new HttpsError('invalid-argument', 'Укажите новый email и/или пароль')
    }

    try {
      await getAuth().updateUser(userId, authUpdates)
    } catch (err) {
      const code = err?.code || ''
      if (code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'Такой email уже занят')
      }
      if (code === 'auth/user-not-found') {
        throw new HttpsError('not-found', 'Пользователь не найден в Auth')
      }
      if (code === 'auth/invalid-password') {
        throw new HttpsError('invalid-argument', 'Пароль слишком слабый')
      }
      console.error('adminSetUserCredentials Auth error', err)
      throw new HttpsError('internal', err?.message || 'Ошибка обновления Auth')
    }

    if (newEmail) {
      await db.collection('users').doc(userId).set({ email: newEmail }, { merge: true })
    }

    return {
      ok: true,
      emailUpdated: Boolean(newEmail),
      passwordUpdated: Boolean(authUpdates.password),
    }
  },
)

function tashkentToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })
}

function isLeadFinal(stage) {
  return ['deal', 'rejected', 'failed', 'abandoned'].includes(stage)
}

function notifId(dedupeKey) {
  return String(dedupeKey).replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 700)
}

async function writeNotice(db, notice) {
  const ref = db.collection('notifications').doc(notifId(notice.dedupeKey))
  const existing = await ref.get()
  if (existing.exists) return
  await ref.set({
    userId: notice.userId,
    type: notice.type,
    title: notice.title,
    body: notice.body,
    clientId: notice.clientId,
    link: notice.link,
    dedupeKey: notice.dedupeKey,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
}

/** Daily 08:00 Tashkent — overdue next-step notices only (old activityStatus retired). */
exports.dailyLeadActivityCheck = onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: 'Asia/Tashkent',
    region: 'us-central1',
  },
  async () => {
    const db = getFirestore()
    const todayStr = tashkentToday()
    const snap = await db.collection('clients').get()

    for (const docSnap of snap.docs) {
      const client = { id: docSnap.id, ...docSnap.data() }
      if (isLeadFinal(client.stage)) continue
      if (client.nextStepDeadline && client.nextStepDeadline < todayStr && client.assignedTo) {
        await writeNotice(db, {
          userId: client.assignedTo,
          type: 'lead_next_step_overdue',
          title: 'Пропущен срок по клиенту',
          body: `Истёк срок следующего шага по ${client.name}. Обнови дату.`,
          clientId: client.id,
          link: `/crm?client=${client.id}`,
          dedupeKey: `lead_next_step_overdue:${client.id}:${client.nextStepDeadline}`,
        })
      }
    }
  },
)

/** Daily 08:15 Tashkent — Groq AI tasks for active leads */
exports.dailyAiLeadAnalysis = onSchedule(
  {
    schedule: '15 8 * * *',
    timeZone: 'Asia/Tashkent',
    region: 'us-central1',
    secrets: [groqApiKey],
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const db = getFirestore()
    await runDailyAiLeadAnalysis(db, groqApiKey.value())
  },
)

/** Admin-only: run AI lead analysis now (for testing) */
exports.runAiLeadAnalysisNow = onCall(
  {
    region: 'us-central1',
    cors: true,
    secrets: [groqApiKey],
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Нужно войти в систему')
    }
    const db = getFirestore()
    const caller = await db.collection('users').doc(request.auth.uid).get()
    if (!caller.exists || caller.data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Только администратор')
    }
    await runDailyAiLeadAnalysis(db, groqApiKey.value())
    return { ok: true }
  },
)

/** Daily 08:05 Tashkent — Groq active/passive/paused for open leads */
exports.dailyLeadActivityAnalysis = onSchedule(
  {
    schedule: '5 8 * * *',
    timeZone: 'Asia/Tashkent',
    region: 'us-central1',
    secrets: [groqApiKey],
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const db = getFirestore()
    await runActivityAnalysis(db, groqApiKey.value(), { maxClients: 80 })
  },
)

/** Admin-only: run Groq monthly activity analysis now */
exports.runActivityAnalysisNow = onCall(
  {
    region: 'us-central1',
    cors: true,
    secrets: [groqApiKey],
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Нужно войти в систему')
    }
    const db = getFirestore()
    const caller = await db.collection('users').doc(request.auth.uid).get()
    if (!caller.exists || caller.data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Только администратор')
    }
    return runActivityAnalysis(db, groqApiKey.value(), {
      maxClients: 80,
      clientId: request.data?.clientId || null,
      force: Boolean(request.data?.force),
    })
  },
)
