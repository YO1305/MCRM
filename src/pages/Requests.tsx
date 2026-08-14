import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Textarea'
import { useDeletionRequests } from '@/hooks/useDeletionRequests'
import type { DeletionRequest } from '@/types/deletionRequest.types'

function formatTime(value: unknown) {
  const seconds = (value as { seconds?: number } | null)?.seconds
  if (!seconds) return ''
  return new Date(seconds * 1000).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_LABEL: Record<DeletionRequest['status'], string> = {
  pending: 'Ожидает',
  approved: 'Одобрено',
  rejected: 'Отклонено',
}

const STATUS_BADGE: Record<DeletionRequest['status'], 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

export function Requests() {
  const { requests, loading, pendingCount, approveAndDelete, rejectRequest } =
    useDeletionRequests()
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const visible =
    filter === 'pending' ? requests.filter((r) => r.status === 'pending') : requests

  async function handleApprove(req: DeletionRequest) {
    if (
      !confirm(
        `Одобрить и удалить клиента «${req.clientName}»? Действие необратимо.`,
      )
    ) {
      return
    }
    setBusyId(req.id)
    try {
      await approveAndDelete(req, notes[req.id])
    } catch (err) {
      console.error(err)
      alert('Не удалось одобрить / удалить. Возможно, клиент уже удалён.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(req: DeletionRequest) {
    setBusyId(req.id)
    try {
      await rejectRequest(req, notes[req.id])
    } catch (err) {
      console.error(err)
      alert('Не удалось отклонить заявку')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Заявки на удаление</h1>
        <p className="mt-1 text-sm text-muted">
          Менеджеры не удаляют сделки сами — только через ваше одобрение
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter('pending')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            filter === 'pending' ? 'bg-secondary text-white' : 'bg-surface text-muted shadow-sm'
          }`}
        >
          Ожидают ({pendingCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            filter === 'all' ? 'bg-secondary text-white' : 'bg-surface text-muted shadow-sm'
          }`}
        >
          Все ({requests.length})
        </button>
      </div>

      <Card className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted">Загрузка...</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted">
            {filter === 'pending' ? 'Нет ожидающих заявок' : 'Заявок пока нет'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {visible.map((req) => (
              <li key={req.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-text">{req.clientName}</p>
                    <p className="text-xs text-muted">
                      {req.clientPhone} · от {req.requestedByName}
                      {formatTime(req.createdAt) ? ` · ${formatTime(req.createdAt)}` : ''}
                    </p>
                  </div>
                  <Badge variant={STATUS_BADGE[req.status]}>{STATUS_LABEL[req.status]}</Badge>
                </div>
                <p className="rounded-lg bg-background px-3 py-2 text-sm text-text">
                  <span className="text-xs font-medium text-muted">Причина: </span>
                  {req.reason}
                </p>
                {req.status === 'pending' && (
                  <>
                    <Textarea
                      value={notes[req.id] || ''}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                      }
                      placeholder="Комментарий админа (необязательно)..."
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="danger"
                        disabled={busyId === req.id}
                        onClick={() => handleApprove(req)}
                      >
                        {busyId === req.id ? '…' : 'Разрешить и удалить'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busyId === req.id}
                        onClick={() => handleReject(req)}
                      >
                        Отклонить
                      </Button>
                    </div>
                  </>
                )}
                {req.status !== 'pending' && req.reviewedByName && (
                  <p className="text-xs text-muted">
                    Решение: {req.reviewedByName}
                    {req.reviewNote ? ` — ${req.reviewNote}` : ''}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
