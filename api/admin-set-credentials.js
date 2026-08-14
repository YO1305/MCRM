import admin from 'firebase-admin'

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
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
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) {
      return res.status(401).json({ error: 'Нужно войти в систему' })
    }

    const decoded = await admin.auth().verifyIdToken(token)
    const callerSnap = await admin.firestore().collection('users').doc(decoded.uid).get()
    if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
      return res.status(403).json({ error: 'Только администратор может менять логин/пароль' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const userId = String(body.userId || '').trim()
    const emailRaw = body.email
    const passwordRaw = body.password

    if (!userId) {
      return res.status(400).json({ error: 'Не указан сотрудник' })
    }

    const authUpdates = {}
    let newEmail = null

    if (typeof emailRaw === 'string' && emailRaw.trim()) {
      newEmail = emailRaw.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return res.status(400).json({ error: 'Некорректный email' })
      }
      authUpdates.email = newEmail
      authUpdates.emailVerified = true
    }

    if (typeof passwordRaw === 'string' && passwordRaw.length > 0) {
      if (passwordRaw.length < 6) {
        return res.status(400).json({ error: 'Пароль минимум 6 символов' })
      }
      authUpdates.password = passwordRaw
    }

    if (!Object.keys(authUpdates).length) {
      return res.status(400).json({ error: 'Укажите новый email и/или пароль' })
    }

    let createdLogin = false

    try {
      await admin.auth().updateUser(userId, authUpdates)
    } catch (err) {
      const code = err?.code || ''
      if (code === 'auth/user-not-found') {
        if (!newEmail || !authUpdates.password) {
          return res.status(400).json({
            error: 'Чтобы включить вход, укажите email и пароль',
          })
        }
        try {
          await admin.auth().createUser({
            uid: userId,
            email: newEmail,
            password: authUpdates.password,
            emailVerified: true,
          })
          createdLogin = true
        } catch (createErr) {
          const c = createErr?.code || ''
          if (c === 'auth/email-already-exists') {
            return res.status(409).json({ error: 'Такой email уже занят' })
          }
          if (c === 'auth/invalid-password') {
            return res.status(400).json({ error: 'Пароль слишком слабый' })
          }
          console.error('createUser for existing profile failed', createErr)
          return res.status(500).json({ error: createErr.message || 'Ошибка Auth' })
        }
      } else if (code === 'auth/email-already-exists') {
        return res.status(409).json({ error: 'Такой email уже занят' })
      } else if (code === 'auth/invalid-password') {
        return res.status(400).json({ error: 'Пароль слишком слабый' })
      } else {
        console.error('updateUser failed', err)
        return res.status(500).json({ error: err.message || 'Ошибка Auth' })
      }
    }

    const firestorePatch = { hasLogin: true }
    if (newEmail) firestorePatch.email = newEmail
    await admin.firestore().collection('users').doc(userId).set(firestorePatch, { merge: true })

    return res.status(200).json({
      ok: true,
      emailUpdated: Boolean(newEmail),
      passwordUpdated: Boolean(authUpdates.password),
      loginCreated: createdLogin,
    })
  } catch (err) {
    console.error('admin-set-credentials', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
