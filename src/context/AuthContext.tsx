import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import { auth } from '@/firebase/config'
import { signIn as firebaseSignIn, signOut as firebaseSignOut } from '@/firebase/auth'
import { getDocument } from '@/firebase/firestore'
import type { User } from '@/types/user.types'

const VIEW_AS_KEY = 'bahmal_view_as_user_id'

interface AuthContextType {
  /** Effective user for UI / filters (view-as employee or real login). */
  user: User | null
  /** Always the signed-in account (admin stays admin here). */
  realUser: User | null
  /** Employee cabinet currently previewed; null = own cabinet. */
  viewAsUser: User | null
  loading: boolean
  /** Effective admin (false while previewing an employee). */
  isAdmin: boolean
  /** True if the real login is admin — for cabinet switcher. */
  isRealAdmin: boolean
  setViewAsUser: (employee: User | null) => void
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const KNOWN_PROFILES: Record<
  string,
  Pick<User, 'name' | 'role' | 'position'>
> = {
  'admin@bahmal.uz': {
    name: 'Начальник отдела',
    role: 'admin',
    position: 'head',
  },
  'leads1@bahmal.uz': {
    name: 'Старший менеджер по лидам',
    role: 'employee',
    position: 'leads_manager_1',
  },
  'leads2@bahmal.uz': {
    name: 'Менеджер по лидам',
    role: 'employee',
    position: 'leads_manager_2',
  },
  'design@bahmal.uz': {
    name: 'Дизайнер',
    role: 'employee',
    position: 'designer',
  },
  'dev@bahmal.uz': {
    name: 'Менеджер по развитию',
    role: 'employee',
    position: 'dev_manager',
  },
  'assistant@bahmal.uz': {
    name: 'Ассистент',
    role: 'employee',
    position: 'assistant',
  },
}

function fallbackUser(firebaseUser: FirebaseUser): User {
  const email = firebaseUser.email?.toLowerCase() || ''
  const knownProfile = KNOWN_PROFILES[email]

  return {
    id: firebaseUser.uid,
    name:
      knownProfile?.name ||
      firebaseUser.displayName ||
      firebaseUser.email ||
      'Пользователь',
    email,
    role: knownProfile?.role || 'employee',
    position: knownProfile?.position || 'assistant',
    isActive: true,
  }
}

function normalizeProfile(firebaseUser: FirebaseUser, profile: User): User {
  return {
    ...profile,
    // Always bind to Auth UID — profile.id may be stale/wrong and breaks security rules
    id: firebaseUser.uid,
    name: profile.name || firebaseUser.displayName || firebaseUser.email || 'Пользователь',
    email: profile.email || firebaseUser.email || '',
    role: profile.role === 'admin' ? 'admin' : 'employee',
    position: profile.position || 'assistant',
    isActive: profile.isActive !== false,
    enabledSections: Array.isArray(profile.enabledSections) ? profile.enabledSections : null,
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        window.clearTimeout(timer)
        reject(err)
      },
    )
  })
}

async function fetchProfileOnce(firebaseUser: FirebaseUser, timeoutMs: number): Promise<User | null> {
  return withTimeout(getDocument<User>('users', firebaseUser.uid), timeoutMs)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [realUser, setRealUser] = useState<User | null>(null)
  const [viewAsUser, setViewAsUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const profileRequestId = useRef(0)
  const retryTimer = useRef<number | null>(null)

  const clearRetry = () => {
    if (retryTimer.current != null) {
      window.clearTimeout(retryTimer.current)
      retryTimer.current = null
    }
  }

  const clearViewAs = useCallback(() => {
    setViewAsUserState(null)
    try {
      sessionStorage.removeItem(VIEW_AS_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const setViewAsUser = useCallback(
    (employee: User | null) => {
      if (!employee || employee.id === realUser?.id) {
        clearViewAs()
        return
      }
      setViewAsUserState(employee)
      try {
        sessionStorage.setItem(VIEW_AS_KEY, employee.id)
      } catch {
        /* ignore */
      }
    },
    [clearViewAs, realUser?.id],
  )

  const scheduleUpgrade = useCallback((firebaseUser: FirebaseUser, requestId: number) => {
    clearRetry()
    retryTimer.current = window.setTimeout(() => {
      if (profileRequestId.current !== requestId) return
      void fetchProfileOnce(firebaseUser, 10000)
        .then((doc) => {
          if (profileRequestId.current !== requestId || !doc) return
          setRealUser(normalizeProfile(firebaseUser, doc))
        })
        .catch(() => {
          if (profileRequestId.current !== requestId) return
          scheduleUpgrade(firebaseUser, requestId)
        })
    }, 2500)
  }, [])

  const applyProfile = useCallback(
    async (firebaseUser: FirebaseUser, requestId: number) => {
      const timeouts = [5000, 8000, 12000]

      for (let i = 0; i < timeouts.length; i++) {
        if (profileRequestId.current !== requestId) return
        try {
          const doc = await fetchProfileOnce(firebaseUser, timeouts[i])
          if (profileRequestId.current !== requestId) return

          if (doc) {
            setRealUser(normalizeProfile(firebaseUser, doc))
            setLoading(false)
            return
          }

          setRealUser(fallbackUser(firebaseUser))
          setLoading(false)
          return
        } catch (err) {
          console.warn(`Profile load attempt ${i + 1} failed`, err)
        }
      }

      if (profileRequestId.current !== requestId) return

      setRealUser(fallbackUser(firebaseUser))
      setLoading(false)
      scheduleUpgrade(firebaseUser, requestId)
    },
    [scheduleUpgrade],
  )

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const requestId = ++profileRequestId.current
      clearRetry()

      if (!firebaseUser) {
        setRealUser(null)
        clearViewAs()
        setLoading(false)
        return
      }

      setRealUser(fallbackUser(firebaseUser))
      setLoading(false)
      void applyProfile(firebaseUser, requestId)
    })

    return () => {
      clearRetry()
      unsubscribe()
    }
  }, [applyProfile, clearViewAs])

  // Restore view-as from session after real admin profile is ready
  useEffect(() => {
    if (!realUser || realUser.role !== 'admin') {
      if (viewAsUser) clearViewAs()
      return
    }

    let storedId: string | null = null
    try {
      storedId = sessionStorage.getItem(VIEW_AS_KEY)
    } catch {
      storedId = null
    }
    if (!storedId || storedId === realUser.id) return
    if (viewAsUser?.id === storedId) return

    void getDocument<User>('users', storedId).then((doc) => {
      if (!doc || doc.isActive === false) {
        clearViewAs()
        return
      }
      setViewAsUserState({
        ...doc,
        id: doc.id || storedId,
        enabledSections: Array.isArray(doc.enabledSections) ? doc.enabledSections : null,
      })
    })
  }, [realUser, viewAsUser, clearViewAs])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const cred = await firebaseSignIn(email, password)
      const requestId = ++profileRequestId.current
      clearRetry()
      clearViewAs()
      setRealUser(fallbackUser(cred.user))
      setLoading(false)
      void applyProfile(cred.user, requestId)
    },
    [applyProfile, clearViewAs],
  )

  const signOut = useCallback(async () => {
    profileRequestId.current += 1
    clearRetry()
    clearViewAs()
    await firebaseSignOut()
    setRealUser(null)
    setLoading(false)
  }, [clearViewAs])

  const isRealAdmin = realUser?.role === 'admin'
  const effectiveUser = isRealAdmin && viewAsUser ? viewAsUser : realUser
  const isAdmin = effectiveUser?.role === 'admin'

  const value = useMemo(
    () => ({
      user: effectiveUser,
      realUser,
      viewAsUser: isRealAdmin ? viewAsUser : null,
      loading,
      isAdmin,
      isRealAdmin: !!isRealAdmin,
      setViewAsUser,
      signIn,
      signOut,
    }),
    [
      effectiveUser,
      realUser,
      viewAsUser,
      loading,
      isAdmin,
      isRealAdmin,
      setViewAsUser,
      signIn,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
