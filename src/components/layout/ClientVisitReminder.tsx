import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/hooks/useClients'
import { useNotifications } from '@/hooks/useNotifications'
import { Button } from '@/components/ui/Button'
import { formatISODateShort, todayISO } from '@/utils/dates'
import { shouldRemindVisit } from '@/utils/clientWork'
import type { Client } from '@/types/client.types'

function visitRecipients(client: Client): string[] {
  const ids = [client.assignedTo, client.salesManagerId].filter(
    (id): id is string => Boolean(id),
  )
  return [...new Set(ids)]
}

/**
 * Creates visit-prep notifications (1 day before; Sunday → Saturday)
 * and shows a large alert the manager cannot miss.
 */
export function ClientVisitReminder() {
  const { user, viewAsUser } = useAuth()
  const { clients, loading } = useClients()
  const { notify, notifications, markRead } = useNotifications()
  const navigate = useNavigate()
  const scanned = useRef('')
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!user || viewAsUser || loading) return
    const today = todayISO()
    const due = clients.filter((c) => shouldRemindVisit(c.visitDate, today))
    const key = `${today}:${due.map((c) => `${c.id}:${c.visitDate}`).sort().join(',')}`
    if (scanned.current === key) return
    scanned.current = key
    if (!due.length) return

    void (async () => {
      for (const client of due) {
        const dateLabel = formatISODateShort(client.visitDate || '')
        const note = client.visitNote?.trim()
        const body = [
          `${client.name}${client.company ? ` · ${client.company}` : ''}`,
          `Приезд ${dateLabel}`,
          note || 'Подготовьте образцы, зал и встречу.',
        ].join(' · ')
        for (const uid of visitRecipients(client)) {
          try {
            await notify({
              userId: uid,
              type: 'client_visit',
              title: 'Подготовить к приезду клиента',
              body,
              clientId: client.id,
              link: `/crm?client=${client.id}`,
              dedupeKey: `visit:${client.id}:${client.visitDate}:${uid}`,
            })
          } catch (err) {
            console.error('visit notify failed', err)
          }
        }
      }
    })()
  }, [user, viewAsUser, loading, clients, notify])

  const mine = useMemo(() => {
    if (!user) return []
    return notifications.filter((n) => {
      if (n.type !== 'client_visit' || n.read) return false
      const client = n.clientId ? clients.find((c) => c.id === n.clientId) : null
      if (client) return shouldRemindVisit(client.visitDate)
      return true
    })
  }, [notifications, user, clients])

  if (dismissed || mine.length === 0) return null

  async function dismissAll() {
    await Promise.all(mine.map((n) => markRead(n.id)))
    setDismissed(true)
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-amber-50 p-6 shadow-2xl ring-4 ring-amber-400 sm:p-8">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white">
            <MapPin className="h-7 w-7" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Напоминание
            </p>
            <h2 className="mt-1 text-2xl font-bold text-amber-950">
              Подготовить к приезду
            </h2>
            <p className="mt-1 text-sm text-amber-900">
              Завтра (или в ближайший рабочий день) клиент приезжает — соберите образцы
              и подготовьте встречу.
            </p>
          </div>
        </div>

        <ul className="mt-5 space-y-3">
          {mine.map((n) => (
            <li
              key={n.id}
              className="rounded-xl border border-amber-200 bg-white px-4 py-3"
            >
              <p className="text-base font-semibold text-text">{n.title}</p>
              <p className="mt-1 text-sm text-amber-950">{n.body}</p>
              {n.link && (
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-amber-800 underline"
                  onClick={() => {
                    void markRead(n.id)
                    navigate(n.link || '/crm')
                    if (mine.length <= 1) setDismissed(true)
                  }}
                >
                  Открыть карточку
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void dismissAll()}>
            Понятно
          </Button>
          {mine[0]?.link && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void markRead(mine[0].id)
                navigate(mine[0].link || '/crm')
                if (mine.length <= 1) setDismissed(true)
              }}
            >
              К клиенту
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
