import admin from 'firebase-admin'
import Groq from 'groq-sdk'

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

  if (req.method === 'OPTIONS') return res.status(204).end()
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
    if (!token) return res.status(401).json({ error: 'Нужно войти в систему' })

    const decoded = await admin.auth().verifyIdToken(token)
    const callerSnap = await admin.firestore().collection('users').doc(decoded.uid).get()
    if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
      return res.status(403).json({ error: 'Только администратор' })
    }

    const apiKey = (process.env.GROQ_API_KEY || '').trim()
    if (!apiKey) {
      return res.status(503).json({
        error: 'GROQ_API_KEY не задан в Vercel Environment Variables',
        code: 'NO_GROQ_KEY',
      })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const prompt = String(body.prompt || '').trim()
    if (!prompt) return res.status(400).json({ error: 'Пустой промпт' })

    const model = String(body.model || 'llama-3.1-8b-instant')
    const temperature = Number(body.temperature ?? 0.4)
    const maxTokens = Math.min(300, Math.max(50, Number(body.maxTokens ?? 150)))

    const groq = new Groq({ apiKey })
    const completion = await groq.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
    })

    const taskText = completion.choices[0]?.message?.content?.trim()
    if (!taskText) {
      return res.status(502).json({ error: 'Пустой ответ от Groq' })
    }

    return res.status(200).json({
      taskText,
      tokensUsed: completion.usage?.total_tokens ?? null,
    })
  } catch (err) {
    console.error('ai-test-prompt', err)
    return res.status(500).json({
      error: err.message || 'Ошибка теста Groq',
      code: err.code || 'AI_TEST_ERROR',
    })
  }
}
