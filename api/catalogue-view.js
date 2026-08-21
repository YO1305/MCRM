import { createRequire } from 'node:module'
import admin from 'firebase-admin'

const require = createRequire(import.meta.url)
const { incrementCatalogueViewBySlug } = require('../functions/catalogueViews.js')

function initAdmin() {
  if (admin.apps.length) return admin.app()
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    const err = new Error('FIREBASE_SERVICE_ACCOUNT_JSON не задан')
    err.status = 500
    throw err
  }
  return admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(raw)),
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    initAdmin()
    const slug = String(req.body?.slug || '').trim()
    if (!slug) return res.status(400).json({ error: 'Нет slug' })
    const result = await incrementCatalogueViewBySlug(slug)
    return res.status(200).json(result)
  } catch (err) {
    console.error('catalogue-view', err)
    return res.status(err.status || 500).json({ error: err.message || 'Ошибка' })
  }
}
