import { useEffect, useState } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'

export interface AppUpdateInfo {
  version: string
  title: string
  message: string
  /** Detailed changelog — shown only to admin */
  changes: string[]
  /** Short text for employees (no internal details) */
  employeeMessage?: string
}

const DEFER_KEY = 'mcrm_update_deferred_v'

const EMPLOYEE_TITLE = 'Обновление CRM'
const EMPLOYEE_MESSAGE =
  'Исправлены ошибки. Обновите страницу, когда закончите текущую работу.'

/**
 * Polls /app-update.json. Admin sees full changelog; employees only
 * «исправлены ошибки» without internal details.
 */
export function AppUpdateBanner() {
  const { isRealAdmin } = useAuth()
  const [baseline, setBaseline] = useState<string | null>(null)
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null)
  const [deferred, setDeferred] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch(`/app-update.json?t=${Date.now()}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = (await res.json()) as AppUpdateInfo
        if (!data?.version || cancelled) return

        if (!baseline) {
          setBaseline(data.version)
          if (sessionStorage.getItem(DEFER_KEY) === data.version) {
            sessionStorage.removeItem(DEFER_KEY)
          }
          return
        }
        if (data.version !== baseline) {
          setUpdate(data)
          if (sessionStorage.getItem(DEFER_KEY) === data.version) {
            setDeferred(true)
          }
        }
      } catch {
        /* offline / first paint */
      }
    }

    void check()
    const id = window.setInterval(() => void check(), 45_000)
    const onFocus = () => void check()
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [baseline])

  function hardRefresh() {
    sessionStorage.removeItem(DEFER_KEY)
    const go = () => {
      const url = new URL(window.location.href)
      url.searchParams.set('_refresh', Date.now().toString())
      window.location.replace(url.toString())
    }
    if ('caches' in window) {
      void caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .finally(go)
    } else {
      go()
    }
  }

  function deferUpdate() {
    if (!update) return
    sessionStorage.setItem(DEFER_KEY, update.version)
    setDeferred(true)
  }

  if (!update) return null

  const title = isRealAdmin
    ? update.title || 'Обновление CRM'
    : EMPLOYEE_TITLE
  const message = isRealAdmin
    ? update.message ||
      'Вышла новая версия CRM. Можно закончить текущую работу, сохранить, и обновить позже.'
    : update.employeeMessage || EMPLOYEE_MESSAGE
  const changes = isRealAdmin && update.changes?.length ? update.changes : []

  return (
    <>
      {deferred && (
        <div
          className="fixed inset-x-0 top-0 z-[280] flex items-center justify-between gap-3 bg-danger px-3 py-2.5 text-white shadow-md sm:px-4"
          role="status"
        >
          <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">
            {isRealAdmin
              ? 'Важно: новая версия CRM. Сохраните работу и перезагрузите страницу.'
              : 'Важно: исправлены ошибки. Сохраните работу и перезагрузите страницу.'}
          </p>
          <button
            type="button"
            onClick={hardRefresh}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-bold text-danger hover:bg-white/90"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Перезагрузить
          </button>
        </div>
      )}

      {deferred && <div className="h-12 shrink-0" aria-hidden />}

      {!deferred && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div
            className="w-full max-w-md rounded-t-2xl bg-surface p-5 shadow-2xl sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-update-title"
          >
            <div className="mb-3 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-secondary">
                  Новое обновление
                </p>
                <h2 id="app-update-title" className="text-lg font-bold text-text">
                  {title}
                </h2>
              </div>
            </div>

            <p className="text-sm text-muted">{message}</p>

            {changes.length > 0 && (
              <ul className="mt-3 space-y-1.5 rounded-xl bg-background px-3 py-3">
                {changes.map((line) => (
                  <li key={line} className="flex gap-2 text-sm text-text">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 flex flex-col gap-2">
              <Button type="button" size="lg" fullWidth onClick={hardRefresh}>
                <RefreshCw className="h-4 w-4" />
                Обновить сейчас
              </Button>
              <Button type="button" size="lg" variant="ghost" fullWidth onClick={deferUpdate}>
                Обновить позже
              </Button>
              <p className="text-center text-[11px] text-muted">
                «Позже» — окно закроется, сверху останется красная полоса. Сохраните работу и
                нажмите «Перезагрузить».
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
