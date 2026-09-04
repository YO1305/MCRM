import { useState } from 'react'
import { Link } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { auth } from '@/firebase/config'
import type { AnalyticsSharePayload } from '@/utils/analyticsSharePayload'

export function CopyAnalyticsLinkButton({
  buildPayload,
}: {
  buildPayload: () => AnalyticsSharePayload
}) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function copy() {
    setBusy(true)
    setMsg('')
    try {
      const user = auth.currentUser
      if (!user) throw new Error('Нужно войти')
      const token = await user.getIdToken()
      const payload = buildPayload()
      const res = await fetch('/api/analytics-share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payload }),
      })
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string }
      if (!res.ok || !data.id) throw new Error(data.error || 'Не удалось создать ссылку')
      const url = `${window.location.origin}/a/${data.id}`
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        window.prompt('Скопируйте ссылку', url)
      }
      setMsg(url)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex max-w-xl flex-col items-stretch gap-1 sm:items-end">
      <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void copy()}>
        <Link className="h-3.5 w-3.5" />
        {busy ? 'Готовлю ссылку…' : 'Скопировать ссылку'}
      </Button>
      {msg ? (
        <p className="break-all text-right text-xs text-muted">{msg}</p>
      ) : (
        <p className="text-right text-[11px] text-muted">
          Откроется одна страница, без входа в CRM
        </p>
      )}
    </div>
  )
}
