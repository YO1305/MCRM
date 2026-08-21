import admin from 'firebase-admin'
import crypto from 'crypto'

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

const POSITIONS = new Set([
  'head',
  'leads_manager_1',
  'leads_manager_2',
  'designer',
  'dev_manager',
  'assistant',
  'operator',
])

const SECTIONS = new Set([
  'dashboard',
  'tasks',
  'reports',
  'crm',
  'contacts',
  'kpi',
  'design',
  'showroom',
  'labels',
  'smm',
  'smm_payments',
  'projects',
  'milestones',
  'analytics',
  'requests',
  'catalogue',
  'settings',
])

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
      return res.status(403).json({ error: 'Только администратор может добавлять сотрудников' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const name = String(body.name || '').trim()
    const position = String(body.position || '').trim()
    const role = body.role === 'admin' ? 'admin' : 'employee'
    const withLogin = Boolean(body.withLogin)
    const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const passwordRaw = typeof body.password === 'string' ? body.password : ''
    const useCustomMenu = Boolean(body.useCustomMenu)
    let enabledSections = null

    if (useCustomMenu && Array.isArray(body.enabledSections)) {
      enabledSections = body.enabledSections.filter((s) => SECTIONS.has(String(s)))
    }

    if (!name) {
      return res.status(400).json({ error: 'Укажите имя' })
    }
    if (!POSITIONS.has(position)) {
      return res.status(400).json({ error: 'Некорректная должность' })
    }

    let userId
    let email = ''
    let hasLogin = false

    if (withLogin) {
      if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
        return res.status(400).json({ error: 'Укажите корректный email (логин)' })
      }
      if (!passwordRaw || passwordRaw.length < 6) {
        return res.status(400).json({ error: 'Пароль минимум 6 символов' })
      }

      try {
        const created = await admin.auth().createUser({
          email: emailRaw,
          password: passwordRaw,
          emailVerified: true,
          displayName: name,
        })
        userId = created.uid
        email = emailRaw
        hasLogin = true
      } catch (err) {
        const code = err?.code || ''
        if (code === 'auth/email-already-exists') {
          return res.status(409).json({ error: 'Такой email уже занят' })
        }
        if (code === 'auth/invalid-password') {
          return res.status(400).json({ error: 'Пароль слишком слабый' })
        }
        console.error('createUser failed', err)
        return res.status(500).json({ error: err.message || 'Ошибка Auth' })
      }
    } else {
      userId = crypto.randomUUID()
      email = emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : ''
      hasLogin = false
    }

    const profile = {
      name,
      email,
      role,
      position,
      isActive: true,
      hasLogin,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }
    if (useCustomMenu) {
      profile.enabledSections = enabledSections || []
    }

    await admin.firestore().collection('users').doc(userId).set(profile)

    return res.status(200).json({
      ok: true,
      userId,
      hasLogin,
      email,
      name,
    })
  } catch (err) {
    console.error('admin-create-user', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
