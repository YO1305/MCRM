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

async function findMonthLog(db, clientId, month) {
  const snap = await db
    .collection('kpi_lead_log')
    .where('clientId', '==', clientId)
    .where('month', '==', month)
    .limit(5)
    .get()
  return snap.docs
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    initAdmin()
    await assertAdmin(req)
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const action = String(body.action || '')
    const clientId = String(body.clientId || '')
    const month = String(body.month || '')
    if (!clientId || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Нужны clientId и месяц YYYY-MM' })
    }
    if (action !== 'include' && action !== 'exclude') {
      return res.status(400).json({ error: 'action: include или exclude' })
    }

    const db = admin.firestore()
    const FieldValue = admin.firestore.FieldValue
    const clientSnap = await db.collection('clients').doc(clientId).get()
    if (!clientSnap.exists) return res.status(404).json({ error: 'Клиент не найден' })
    const client = { id: clientSnap.id, ...clientSnap.data() }
    const logs = await findMonthLog(db, clientId, month)

    if (action === 'exclude') {
      const batch = db.batch()
      for (const doc of logs) batch.delete(doc.ref)
      batch.update(db.collection('clients').doc(clientId), {
        kpiQualified: false,
        kpiQualifiedMonth: month,
        kpiQualificationReason: 'Админ снял лид из KPI вручную',
        kpiManualIncluded: false,
        kpiManualMonth: month,
        kpiQualifiedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      await batch.commit()
      return res.status(200).json({ ok: true, action: 'exclude' })
    }

    const cats = leadCategories(client)
    if (logs.length === 0) {
      await db.collection('kpi_lead_log').add({
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
      })
    }
    await db.collection('clients').doc(clientId).update({
      kpiQualified: true,
      kpiQualifiedMonth: month,
      kpiQualificationReason: 'Админ засчитал лид вручную',
      kpiManualIncluded: true,
      kpiManualMonth: month,
      kpiQualifiedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    return res.status(200).json({ ok: true, action: 'include' })
  } catch (err) {
    console.error('kpi-lead-override', err)
    return res.status(err.status || 500).json({
      error: err.message || 'Не удалось изменить KPI-лид',
      code: err.code || 'OVERRIDE_ERROR',
    })
  }
}
