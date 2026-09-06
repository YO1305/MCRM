/**
 * Publish firestore.rules to project mcrm-781a1.
 * On Vercel runs only for Production (uses FIREBASE_SERVICE_ACCOUNT_JSON).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JWT } from 'google-auth-library'

const PROJECT_ID = (process.env.VITE_FIREBASE_PROJECT_ID || 'mcrm-781a1').trim()
const RELEASE = 'cloud.firestore'
const API = 'https://firebaserules.googleapis.com/v1'

function skip(reason) {
  console.log(`[firestore-rules] skip: ${reason}`)
}

function fail(message) {
  console.error(`[firestore-rules] ${message}`)
  process.exit(1)
}

const vercelEnv = process.env.VERCEL_ENV || ''
if (vercelEnv && vercelEnv !== 'production') {
  skip(`Vercel ${vercelEnv}, only production publishes rules`)
  process.exit(0)
}

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
if (!raw) {
  if (process.env.VERCEL === '1') {
    fail('FIREBASE_SERVICE_ACCOUNT_JSON нет в Vercel — правила не выкатить')
  }
  skip('нет FIREBASE_SERVICE_ACCOUNT_JSON')
  process.exit(0)
}

let sa
try {
  sa = JSON.parse(raw)
} catch {
  fail('FIREBASE_SERVICE_ACCOUNT_JSON: невалидный JSON')
}

const rulesPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'firestore.rules')
const content = readFileSync(rulesPath, 'utf8')
if (!content.includes('match /shops/{id}')) {
  fail('firestore.rules без раздела shops — отказ')
}

const client = new JWT({
  email: sa.client_email,
  key: String(sa.private_key || '').replace(/\\n/g, '\n'),
  scopes: [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/firebase',
  ],
})

const { access_token: token } = await client.authorize()
if (!token) fail('не получил access token service account')

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    const msg = json?.error?.message || text || res.statusText
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`)
  }
  return json
}

const files = [{ name: 'firestore.rules', content }]

try {
  const test = await api('POST', `/projects/${encodeURIComponent(PROJECT_ID)}:test`, {
    source: { files },
  })
  const issues = test?.issues || []
  const errors = issues.filter((i) => i.severity === 'ERROR')
  if (errors.length) {
    fail(errors.map((i) => i.description).join('\n'))
  }
} catch (err) {
  fail(`проверка правил: ${err instanceof Error ? err.message : err}`)
}

const created = await api('POST', `/projects/${encodeURIComponent(PROJECT_ID)}/rulesets`, {
  source: { files },
})
const rulesetName = created?.name
if (!rulesetName) fail('Rules API не вернул имя ruleset')

const releaseName = `projects/${PROJECT_ID}/releases/${RELEASE}`
try {
  await api('PATCH', `/projects/${encodeURIComponent(PROJECT_ID)}/releases/${RELEASE}`, {
    release: { name: releaseName, rulesetName },
  })
} catch {
  await api('POST', `/projects/${encodeURIComponent(PROJECT_ID)}/releases`, {
    name: releaseName,
    rulesetName,
  })
}

console.log(`[firestore-rules] published ${RELEASE} ← ${rulesetName}`)
