import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnalyticsShareView } from '@/components/analytics/AnalyticsShareView'
import type { AnalyticsSharePayload } from '@/utils/analyticsSharePayload'

export function PublicAnalytics() {
  const { id } = useParams()
  const [payload, setPayload] = useState<AnalyticsSharePayload | null | undefined>(undefined)
  const [meta, setMeta] = useState({ createdByName: '', error: '' })

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) {
        setPayload(null)
        return
      }
      try {
        const res = await fetch(`/api/analytics-share?id=${encodeURIComponent(id)}`)
        const data = (await res.json().catch(() => ({}))) as {
          payload?: AnalyticsSharePayload
          createdByName?: string
          error?: string
        }
        if (cancelled) return
        if (!res.ok || !data.payload) {
          setPayload(null)
          setMeta({ createdByName: '', error: data.error || 'Ссылка не найдена' })
          return
        }
        setPayload(data.payload)
        setMeta({ createdByName: data.createdByName || data.payload.createdByName || '', error: '' })
      } catch {
        if (!cancelled) {
          setPayload(null)
          setMeta({ createdByName: '', error: 'Не удалось открыть отчёт' })
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (payload === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted">
        Загрузка отчёта…
      </div>
    )
  }

  if (!payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center text-sm text-muted">
        {meta.error || 'Такой страницы нет'}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-gray-100 bg-surface px-4 py-4 lg:px-8">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Bahmal · аналитика</p>
        <h1 className="text-2xl font-bold text-text">
          {payload.tab === 'crm' ? 'CRM' : 'Задачи'} · {payload.monthLabel}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Снимок на момент отправки
          {meta.createdByName ? ` · ${meta.createdByName}` : ''}. Вход в CRM не нужен.
        </p>
      </header>
      <main className="mx-auto max-w-6xl space-y-4 p-4 lg:p-8">
        <AnalyticsShareView payload={payload} />
      </main>
    </div>
  )
}
