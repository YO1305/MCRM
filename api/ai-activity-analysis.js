import { createRequire } from 'node:module'
import admin from 'firebase-admin'

const require = createRequire(import.meta.url)
const { runActivityAnalysis, testClientActivity, testClientKpi } = require('../functions/leadActivityAnalyzer.js')

const MAX_LEADS_PER_RUN = 30

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

async function assertCaller(req) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.authorization || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

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
    const apiKey = (process.env.GROQ_API_KEY || '').trim()
    if (!apiKey) {
      const err = new Error('GROQ_API_KEY не задан в Vercel Environment Variables')
      err.code = 'NO_GROQ_KEY'
      err.status = 503
      throw err
    }

    const db = admin.firestore()
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}

    if (body.testKpi && body.clientId) {
      const result = await testClientKpi(db, apiKey, String(body.clientId), {
        kpiPrompt: body.kpiPrompt || undefined,
        minKpiMoments: body.minKpiMoments ? Number(body.minKpiMoments) : undefined,
      })
      return res.status(200).json({ ok: true, result })
    }

    if (body.test && body.clientId) {
      const result = await testClientActivity(db, apiKey, String(body.clientId), {
        activityPrompt: body.activityPrompt || undefined,
        minActiveDays: body.minActiveDays ? Number(body.minActiveDays) : undefined,
      })
      return res.status(200).json({ ok: true, result })
    }

    const result = await runActivityAnalysis(db, apiKey, {
      maxClients: Number(body.maxClients) || MAX_LEADS_PER_RUN,
      clientId: body.clientId ? String(body.clientId) : null,
      force: req.method === 'POST' ? body.force !== false : Boolean(body.force),
    })
    return res.status(200).json(result)
  } catch (err) {
    const status = err.status || 500
    console.error('ai-activity-analysis', err)
    return res.status(status).json({
      error: err.message || 'Ошибка анализа активности',
      code: err.code || 'ACTIVITY_ERROR',
    })
  }
}
