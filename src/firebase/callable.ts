import { initializeApp, deleteApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, firebaseConfig } from './config'
import type { AppSection } from '@/constants/access'
import type { Position, Role } from '@/types/user.types'

export interface SetCredentialsInput {
  userId: string
  email?: string
  password?: string
}

export interface SetCredentialsResult {
  ok: boolean
  emailUpdated: boolean
  passwordUpdated: boolean
  loginCreated?: boolean
}

export interface CreateUserInput {
  name: string
  position: Position
  role?: Role
  withLogin: boolean
  email?: string
  password?: string
  useCustomMenu?: boolean
  enabledSections?: AppSection[]
}

export interface CreateUserResult {
  ok: boolean
  userId: string
  hasLogin: boolean
  email: string
  name: string
}

async function adminApi<T>(path: string, body: unknown): Promise<T> {
  const user = auth.currentUser
  if (!user) throw new Error('Нужно войти в систему')

  const token = await user.getIdToken()
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string
    code?: string
  }

  if (!res.ok) {
    const err = new Error(data.error || `Ошибка ${res.status}`)
    ;(err as Error & { code?: string }).code = data.code || `http/${res.status}`
    throw err
  }

  return data
}

/**
 * Admin changes employee login/password via Vercel API (Firebase Admin).
 * Needs FIREBASE_SERVICE_ACCOUNT_JSON on Vercel.
 */
export async function adminSetUserCredentials(
  input: SetCredentialsInput,
): Promise<SetCredentialsResult> {
  const data = await adminApi<SetCredentialsResult>('/api/admin-set-credentials', input)
  return {
    ok: true,
    emailUpdated: Boolean(data.emailUpdated),
    passwordUpdated: Boolean(data.passwordUpdated),
    loginCreated: Boolean(data.loginCreated),
  }
}

/**
 * Create team member without Admin SDK:
 * - with login: secondary Auth app (admin session stays) + Firestore profile
 * - without login: Firestore-only profile
 */
export async function adminCreateUser(input: CreateUserInput): Promise<CreateUserResult> {
  if (!auth.currentUser) throw new Error('Нужно войти в систему')

  const name = input.name.trim()
  if (!name) throw new Error('Укажите имя')

  const role: Role = input.role === 'admin' ? 'admin' : 'employee'
  let userId = ''
  let email = ''
  let hasLogin = false

  if (input.withLogin) {
    const emailRaw = (input.email || '').trim().toLowerCase()
    const password = input.password || ''
    if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      throw new Error('Укажите корректный email (логин)')
    }
    if (password.length < 6) {
      throw new Error('Пароль минимум 6 символов')
    }

    const secondary = initializeApp(firebaseConfig, `create-${crypto.randomUUID()}`)
    const secondaryAuth = getAuth(secondary)
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, emailRaw, password)
      userId = cred.user.uid
      email = emailRaw
      hasLogin = true
      await firebaseSignOut(secondaryAuth)
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: string }).code)
          : ''
      if (code === 'auth/email-already-in-use') {
        const e = new Error('Такой email уже занят')
        ;(e as Error & { code?: string }).code = 'auth/email-already-exists'
        throw e
      }
      if (code === 'auth/weak-password') {
        throw new Error('Пароль слишком слабый')
      }
      throw err instanceof Error ? err : new Error('Не удалось создать вход')
    } finally {
      try {
        await deleteApp(secondary)
      } catch {
        /* ignore */
      }
    }
  } else {
    userId = crypto.randomUUID()
    const emailRaw = (input.email || '').trim().toLowerCase()
    email =
      emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : ''
    hasLogin = false
  }

  const profile: Record<string, unknown> = {
    name,
    email,
    role,
    position: input.position,
    isActive: true,
    hasLogin,
    createdAt: serverTimestamp(),
  }
  if (input.useCustomMenu) {
    profile.enabledSections = Array.isArray(input.enabledSections)
      ? input.enabledSections
      : []
  }

  await setDoc(doc(db, 'users', userId), profile)

  return { ok: true, userId, hasLogin, email, name }
}

export interface AiLeadAnalysisResult {
  ok: boolean
  today: string
  candidates: number
  processed: number
  remaining: number
  created: number
  skipped: number
  errors: number
  skippedAll?: boolean
  reason?: string
}

/** Admin: generate Groq AI tasks for active leads (Vercel API). */
export async function runAiLeadAnalysisNow(): Promise<AiLeadAnalysisResult> {
  return adminApi<AiLeadAnalysisResult>('/api/ai-lead-analysis', {})
}

export interface GroqActivityAnalysisResult {
  ok: boolean
  month?: string
  candidates?: number
  processed?: number
  remaining?: number
  errors?: number
  lastError?: string
  code?: string
  skippedAll?: boolean
  reason?: string
  result?: {
    label?: 'active' | 'passive' | 'paused'
    score?: number
    reason?: string
    activeDaysCount?: number
    minActiveDays?: number
    clientName?: string
    significantMoments?: number
    qualifies?: boolean
    minKpiMoments?: number
    kpi?: unknown
  }
}

/** Admin: Groq monthly active/passive analysis (batch or one client). */
export async function runActivityAnalysisNow(input?: {
  clientId?: string
  force?: boolean
  test?: boolean
  testKpi?: boolean
  activityPrompt?: string
  minActiveDays?: number
  kpiPrompt?: string
  minKpiMoments?: number
  month?: string
  maxClients?: number
  runStartedAt?: string
  timeBudgetMs?: number
}): Promise<GroqActivityAnalysisResult> {
  return adminApi<GroqActivityAnalysisResult>('/api/ai-activity-analysis', input || {})
}

export async function overrideKpiLead(input: {
  action: 'include' | 'exclude'
  clientId: string
  month: string
  logId?: string
}): Promise<{ ok: boolean }> {
  return adminApi('/api/kpi-lead-override', input)
}

/** Keep calling until every open lead for the month is processed. */
export async function runActivityAnalysisUntilDone(input?: {
  month?: string
  onProgress?: (info: { processed: number; remaining: number; month?: string }) => void
}): Promise<GroqActivityAnalysisResult> {
  const runStartedAt = new Date().toISOString()
  let processed = 0
  let errors = 0
  let lastError = ''
  let remaining = 0
  let month = input?.month
  let stuck = 0
  let quotaTries = 0
  let lastRemaining = -1

  for (let i = 0; i < 12; i += 1) {
    try {
      const result = await runActivityAnalysisNow({
        force: true,
        month: input?.month,
        runStartedAt,
        maxClients: 20,
        timeBudgetMs: 25000,
      })
      const batch = Number(result.processed) || 0
      processed += batch
      errors += Number(result.errors) || 0
      if (result.lastError) lastError = result.lastError
      remaining = Number(result.remaining) || 0
      month = result.month || month
      input?.onProgress?.({ processed, remaining, month })
      if (remaining <= 0 && result.code !== 'QUOTA') {
        return { ok: true, month, processed, remaining: 0, errors, lastError: lastError || undefined }
      }
      const quota =
        result.code === 'QUOTA' || /Перегрузка|Quota|RESOURCE_EXHAUSTED/i.test(result.lastError || '')
      if (quota) {
        quotaTries += 1
        if (quotaTries >= 3) break
        await new Promise((r) => setTimeout(r, 4000))
        continue
      }
      quotaTries = 0
      if (remaining === lastRemaining && batch === 0) {
        stuck += 1
        if (stuck >= 2) break
      } else {
        stuck = 0
      }
      lastRemaining = remaining
      if (batch === 0) {
        stuck += 1
        if (stuck >= 2) break
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      const retry =
        /504|502|503|Quota|RESOURCE_EXHAUSTED|Перегрузка/i.test(lastError) ||
        /http\/504|http\/502/.test((err as Error & { code?: string }).code || '')
      if (retry && quotaTries < 3) {
        quotaTries += 1
        await new Promise((r) => setTimeout(r, 4000))
        continue
      }
      if (processed > 0) {
        return {
          ok: true,
          month,
          processed,
          remaining,
          errors,
          lastError,
        }
      }
      throw err
    }
  }

  return {
    ok: true,
    month,
    processed,
    remaining,
    errors,
    lastError: lastError || (remaining > 0 ? 'Прогон остановился раньше, чем все карточки' : undefined),
  }
}

/** Admin: test Groq prompt without saving an AI task. */
export async function runAiPromptTest(input: {
  prompt: string
  model: string
  temperature: number
  maxTokens: number
}): Promise<{ taskText: string; tokensUsed?: number }> {
  return adminApi('/api/ai-test-prompt', input)
}

