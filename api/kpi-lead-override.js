import admin from 'firebase-admin'

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

function leadCategories(client) {
  if (Array.isArray(client.categories) && client.categories.length) {
    return client.categories.filter(Boolean)
  }
  return client.category ? [client.category] : ['fabric']
}

function logDocId(clientId, month) {
  return `kl_${clientId}_${month}`
}

function isQuota(err) {
  return /RESOURCE_EXHAUSTED|Quota exceeded|8 RESOURCE_EXHAUSTED/i.test(
    String(err?.message || err || ''),
  )
}

function busyMessage(action) {
  return action === 'exclude'
    ? 'База перегружена. Подождите минуту и нажмите «Убрать из KPI» ещё раз.'
    : 'База перегружена. Подождите минуту и нажмите «Засчитать» ещё раз.'
}

async function withQuotaRetry(fn, action) {
  let last
  for (let i = 0; i < 4; i += 1) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (!isQuota(err)) throw err
      await new Promise((r) => setTimeout(r, 800 * (i + 1)))
    }
  }
  const err = new Error(busyMessage(action))
  err.status = 429
  err.code = 'QUOTA'
  err.cause = last
  throw err
}

async function assertAdmin(req) {
  const authHeader = req.headers.authorization || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
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
  return decoded.uid
}

async function collectLogRefs(db, clientId, month, extraLogId) {
  const refs = new Map()
  const named = db.collection('kpi_lead_log').doc(logDocId(clientId, month))
  refs.set(named.id, named)
  if (extraLogId && extraLogId !== named.id) {
    refs.set(extraLogId, db.collection('kpi_lead_log').doc(extraLogId))
  }
  try {
    const snap = await db
      .collection('kpi_lead_log')
      .where('clientId', '==', clientId)
      .where('month', '==', month)
      .limit(20)
      .get()
    snap.docs.forEach((doc) => refs.set(doc.id, doc.ref))
  } catch (err) {
    if (!isQuota(err)) throw err
  }
  return [...refs.values()]
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let action = ''
  try {
    initAdmin()
    await assertAdmin(req)
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    action = String(body.action || '')
    const clientId = String(body.clientId || '')
    const month = String(body.month || '')
    const extraLogId = String(body.logId || '').trim()
    if (!clientId || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Нужны clientId и месяц YYYY-MM' })
    }
    if (action !== 'include' && action !== 'exclude') {
      return res.status(400).json({ error: 'action: include или exclude' })
    }

    const db = admin.firestore()
    const FieldValue = admin.firestore.FieldValue
    const clientRef = db.collection('clients').doc(clientId)

    await withQuotaRetry(async () => {
      if (action === 'exclude') {
        const logRefs = await collectLogRefs(db, clientId, month, extraLogId)
        const batch = db.batch()
        logRefs.forEach((ref) => batch.delete(ref))
        batch.update(clientRef, {
          kpiQualified: false,
          kpiQualifiedMonth: month,
          kpiQualificationReason: 'Админ снял лид из KPI вручную',
          kpiManualIncluded: false,
          kpiManualMonth: month,
          kpiQualifiedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })
        await batch.commit()
        return
      }

      const clientSnap = await clientRef.get()
      if (!clientSnap.exists) {
        const err = new Error('Клиент не найден')
        err.status = 404
        throw err
      }
      const client = { id: clientSnap.id, ...clientSnap.data() }
      const cats = leadCategories(client)
      const logRef = db.collection('kpi_lead_log').doc(logDocId(clientId, month))
      const batch = db.batch()
      batch.set(
        logRef,
        {
          clientId,
          clientName: client.name || '',
          assignedTo: client.assignedTo || '',
          assignedToName: client.assignedToName || '',
          category: cats[0] || 'fabric',
          categories: cats,
          country: client.country || null,
          month,
          significantMoments: Math.max(3, Number(client.kpiSignificantMoments) || 3),
          qualifiedAt: FieldValue.serverTimestamp(),
          fixedAt: FieldValue.serverTimestamp(),
          stage: client.stage || '',
          source: 'admin',
        },
        { merge: true },
      )
      batch.set(
        clientRef,
        {
          kpiQualified: true,
          kpiQualifiedMonth: month,
          kpiQualificationReason: 'Админ засчитал лид вручную',
          kpiManualIncluded: true,
          kpiManualMonth: month,
          kpiQualifiedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      await batch.commit()
    }, action)

    return res.status(200).json({ ok: true, action })
  } catch (err) {
    console.error('kpi-lead-override', err)
    const quota = isQuota(err) || err.code === 'QUOTA' || err.status === 429
    return res.status(err.status || (quota ? 429 : 500)).json({
      error: quota ? busyMessage(action) : err.message || 'Не удалось изменить KPI-лид',
      code: quota ? 'QUOTA' : err.code || 'OVERRIDE_ERROR',
    })
  }
}
