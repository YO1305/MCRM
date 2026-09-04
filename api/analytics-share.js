import admin from 'firebase-admin'
import crypto from 'crypto'

function initAdmin() {
  if (admin.apps.length) return admin.app()
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    const err = new Error('FIREBASE_SERVICE_ACCOUNT_JSON не задан в Vercel')
    err.code = 'NO_SERVICE_ACCOUNT'
    throw err
  }
  return admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(raw)),
  })
}

async function assertUser(req) {
  const authHeader = req.headers.authorization || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!bearer) {
    const err = new Error('Нужно войти в систему')
    err.status = 401
    throw err
  }
  const decoded = await admin.auth().verifyIdToken(bearer)
  const callerSnap = await admin.firestore().collection('users').doc(decoded.uid).get()
  const data = callerSnap.data() || {}
  const sections = Array.isArray(data.enabledSections) ? data.enabledSections : null
  const allowed =
    data.role === 'admin' ||
    (sections ? sections.includes('analytics') : false)
  if (!callerSnap.exists || !allowed) {
    const err = new Error('Нет доступа к аналитике')
    err.status = 403
    throw err
  }
  return { uid: decoded.uid, name: data.name || '' }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    initAdmin()
    const db = admin.firestore()

    if (req.method === 'GET') {
      const id = String(req.query.id || '').trim()
      if (!id || id.length < 8) return res.status(400).json({ error: 'Нет ссылки' })
      const snap = await db.collection('analytics_shares').doc(id).get()
      if (!snap.exists) return res.status(404).json({ error: 'Ссылка не найдена или устарела' })
      const data = snap.data() || {}
      return res.status(200).json({
        ok: true,
        id: snap.id,
        payload: data.payload,
        createdByName: data.createdByName || '',
        createdAt: data.createdAt || null,
      })
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const user = await assertUser(req)
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const payload = body.payload
    if (!payload || (payload.tab !== 'crm' && payload.tab !== 'tasks')) {
      return res.status(400).json({ error: 'Нет данных отчёта' })
    }
    const clean = JSON.parse(JSON.stringify(payload))
    const size = Buffer.byteLength(JSON.stringify(clean), 'utf8')
    if (size > 900000) {
      return res.status(413).json({ error: 'Отчёт слишком большой для ссылки' })
    }
    const id = crypto.randomBytes(12).toString('hex')
    await db.collection('analytics_shares').doc(id).set({
      payload: clean,
      createdBy: user.uid,
      createdByName: clean.createdByName || user.name,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return res.status(200).json({ ok: true, id })
  } catch (err) {
    console.error('analytics-share', err)
    return res.status(err.status || 500).json({
      error: err.message || 'Не удалось сохранить ссылку',
    })
  }
}
