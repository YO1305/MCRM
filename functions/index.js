const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')

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
