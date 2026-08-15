const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

initializeApp()

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

function tashkentMonth() {
  return tashkentToday().slice(0, 7)
}

function daysDiff(fromDate, todayStr) {
  if (!fromDate) return 999
  const from = new Date(`${fromDate}T00:00:00`)
  const to = new Date(`${todayStr}T00:00:00`)
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

function monthDiff(openedMonth, todayStr) {
  if (!openedMonth) return 0
  const [year, month] = openedMonth.split('-').map(Number)
  const [ty, tm] = todayStr.split('-').map(Number)
  return (ty - year) * 12 + (tm - month)
}

function calculateActiveMonths(openedMonth, todayStr) {
  if (!openedMonth) return 1
  return Math.min(monthDiff(openedMonth, todayStr) + 1, 99)
}

function isLeadFinal(stage) {
  return ['deal', 'rejected', 'failed', 'abandoned'].includes(stage)
}

function openedMonthFromCreatedAt(createdAt, fallbackMonth) {
  const seconds = createdAt && createdAt.seconds
  if (!seconds) return fallbackMonth
  return new Date(seconds * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' }).slice(0, 7)
}

function calculateActivityStatus(client, todayStr) {
  if (isLeadFinal(client.stage)) return client.activityStatus || 'active'
  const openedMonth = client.openedMonth || openedMonthFromCreatedAt(client.createdAt, todayStr.slice(0, 7))
  const activeMonths = calculateActiveMonths(openedMonth, todayStr)
  if (activeMonths >= 4) return 'frozen'
  if (activeMonths === 1) return 'new'
  const failedCount = [
    daysDiff(client.lastTouchDate, todayStr) > 14,
    !client.nextStepDeadline || client.nextStepDeadline < todayStr,
    daysDiff(client.lastStageChangeDate, todayStr) > 45,
  ].filter(Boolean).length
  if (failedCount === 0) return 'active'
  if (failedCount === 1) return 'critical'
  return 'frozen'
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

/** Daily 08:00 Tashkent — recalc activity and send in-app notices. */
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
    const admins = await db.collection('users').get()
    const adminIds = admins.docs
      .filter((d) => {
        const u = d.data() || {}
        return u.isActive !== false && (u.role === 'admin' || u.position === 'head')
      })
      .map((d) => d.id)

    for (const docSnap of snap.docs) {
      const client = { id: docSnap.id, ...docSnap.data() }
      if (isLeadFinal(client.stage)) continue

      const openedMonth =
        client.openedMonth || openedMonthFromCreatedAt(client.createdAt, tashkentMonth())
      const newStatus = calculateActivityStatus({ ...client, openedMonth }, todayStr)
      const newMonths = calculateActiveMonths(openedMonth, todayStr)

      if (newStatus !== client.activityStatus || newMonths !== client.activeMonthsCount || !client.openedMonth) {
        await docSnap.ref.update({
          openedMonth,
          activityStatus: newStatus,
          activeMonthsCount: newMonths,
          updatedAt: FieldValue.serverTimestamp(),
        })
      }

      const link = `/crm?client=${client.id}`
      const daysSinceTouch = daysDiff(client.lastTouchDate, todayStr)

      if (daysSinceTouch === 14 && client.assignedTo) {
        await writeNotice(db, {
          userId: client.assignedTo,
          type: 'lead_no_touch',
          title: 'Нет контакта с клиентом',
          body: `14 дней без активности по клиенту ${client.name}. Напиши или позвони.`,
          clientId: client.id,
          link,
          dedupeKey: `lead_no_touch:${client.id}:${todayStr}`,
        })
      }

      if (daysSinceTouch === 30) {
        for (const adminId of adminIds) {
          await writeNotice(db, {
            userId: adminId,
            type: 'lead_no_touch_admin',
            title: 'Менеджер не работает с клиентом',
            body: `${client.assignedToName || 'Менеджер'} не контактировал с ${client.name} уже 30 дней.`,
            clientId: client.id,
            link,
            dedupeKey: `lead_no_touch_admin:${client.id}:${adminId}:${todayStr}`,
          })
        }
      }

      if (client.nextStepDeadline && client.nextStepDeadline < todayStr && client.assignedTo) {
        await writeNotice(db, {
          userId: client.assignedTo,
          type: 'lead_next_step_overdue',
          title: 'Пропущен срок по клиенту',
          body: `Истёк срок следующего шага по ${client.name}. Обнови дату.`,
          clientId: client.id,
          link,
          dedupeKey: `lead_next_step_overdue:${client.id}:${client.nextStepDeadline}`,
        })
      }

      if (newMonths === 3 && client.activeMonthsCount !== 3 && client.assignedTo) {
        await writeNotice(db, {
          userId: client.assignedTo,
          type: 'lead_month_3',
          title: 'Лид на 3-м месяце',
          body: `Клиент ${client.name} на 3-м месяце. Это последний оплачиваемый месяц — нужен договор или решение.`,
          clientId: client.id,
          link,
          dedupeKey: `lead_month_3:${client.id}:${openedMonth}`,
        })
      }

      if (newStatus === 'frozen' && client.activityStatus && client.activityStatus !== 'frozen') {
        const frozenBody = `Клиент ${client.name} переведён в статус «Заморожен». Оплата за этот лид прекращена.`
        if (client.assignedTo) {
          await writeNotice(db, {
            userId: client.assignedTo,
            type: 'lead_frozen',
            title: 'Лид заморожен',
            body: frozenBody,
            clientId: client.id,
            link,
            dedupeKey: `lead_frozen:${client.id}`,
          })
        }
        for (const adminId of adminIds) {
          if (adminId === client.assignedTo) continue
          await writeNotice(db, {
            userId: adminId,
            type: 'lead_frozen',
            title: 'Лид заморожен',
            body: frozenBody,
            clientId: client.id,
            link,
            dedupeKey: `lead_frozen:${client.id}:${adminId}`,
          })
        }
      }
    }
  },
)
