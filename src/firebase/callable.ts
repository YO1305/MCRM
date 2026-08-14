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
