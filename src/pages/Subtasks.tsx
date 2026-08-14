import { useEffect, useMemo, useState } from 'react'
import { Check, MessageSquare, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useDevModule, useDevSubtaskComments } from '@/hooks/useDevModule'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Textarea'
import {
  SUBTASK_STATUS_LABELS,
  type DevSubtask,
  type SubtaskStatus,
} from '@/types/dev.types'
import {
  getCurrentMonth,
  isSubtaskOverdue,
  monthLabel,
  todayISO,
} from '@/utils/devDates'

type Filter = 'all' | 'overdue' | 'pending' | 'mine' | 'open'

export function Subtasks() {
  const { user, isAdmin } = useAuth()
  const {
    subtasks,
    loading,
    canManageProjects,
    isDevManager,
    submitForConfirm,
    confirmSubtask,
    rejectSubtask,
    setSubtaskStatus,
    materializeMonth,
  } = useDevModule()

  const [month, setMonth] = useState(getCurrentMonth())
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<DevSubtask | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    void materializeMonth().catch(() => {})
  }, [materializeMonth])

  const today = todayISO()

  const monthTasks = useMemo(
    () => subtasks.filter((s) => s.monthKey === month),
    [subtasks, month],
  )

  const filtered = useMemo(() => {
    let list = monthTasks
    if (filter === 'overdue') {
      list = list.filter((s) => isSubtaskOverdue(s.dueDate, s.status, today))
    } else if (filter === 'pending') {
      list = list.filter((s) => s.status === 'pending_confirm')
    } else if (filter === 'mine' && user) {
      list = list.filter((s) => s.assignedTo === user.id)
    } else if (filter === 'open') {
      list = list.filter((s) => s.status !== 'done')
    }
    return list
  }, [monthTasks, filter, today, user])

  const stats = useMemo(() => {
    const overdue = monthTasks.filter((s) =>
      isSubtaskOverdue(s.dueDate, s.status, today),
    ).length
    const pending = monthTasks.filter((s) => s.status === 'pending_confirm').length
    const done = monthTasks.filter((s) => s.status === 'done').length
    const open = monthTasks.filter((s) => s.status !== 'done').length
    return { overdue, pending, done, open, total: monthTasks.length }
  }, [monthTasks, today])

  async function run(id: string, fn: () => Promise<void>) {
    setBusyId(id)
    try {
      await fn()
      if (selected?.id === id) {
        // refresh selected from list after update via subscription
      }
    } finally {
      setBusyId(null)
    }
  }

  const canConfirm = canManageProjects || isAdmin

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Подзадачи</h1>
        <p className="mt-1 text-sm text-muted">
          Рабочий кабинет: просрочки, комментарии, отметка выполнения и подтверждение.
          Просроченные автоматически переносятся на следующий месяц.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Месяц / этап</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all', 'Все'],
              ['open', 'Открытые'],
              ['overdue', 'Просрочено'],
              ['pending', 'На подтверждении'],
              ['mine', 'Мои'],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={filter === id ? 'secondary' : 'ghost'}
              onClick={() => setFilter(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Всего" value={stats.total} />
        <Stat label="Открытые" value={stats.open} />
        <Stat label="Просрочено" value={stats.overdue} danger={stats.overdue > 0} />
        <Stat label="На подтверждении" value={stats.pending} warn={stats.pending > 0} />
      </div>

      {loading ? (
        <p className="text-sm text-muted">Загрузка...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Нет подзадач за {monthLabel(month)}.
            {canManageProjects
              ? ' Добавьте их в разделе «Проекты» или настройте ежемесячные шаблоны.'
              : ''}
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s) => {
            const overdue = isSubtaskOverdue(s.dueDate, s.status, today)
            const mine = user?.id === s.assignedTo
            return (
              <li key={s.id}>
                <Card
                  className={`cursor-pointer space-y-2 transition-colors hover:border-secondary/40 ${
                    overdue ? 'border-red-200 bg-red-50/40' : ''
                  }`}
                  onClick={() => setSelected(s)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text">{s.title}</p>
                      <p className="text-xs text-muted">
                        {s.projectTitle}
                        {s.dueDate ? ` · до ${s.dueDate}` : ''}
                        {s.carriedFromMonth ? ` · перенос с ${s.carriedFromMonth}` : ''}
                        {` · ${s.assignedToName}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {overdue && <Badge variant="danger">Просрочено</Badge>}
                      <Badge
                        variant={
                          s.status === 'done'
                            ? 'success'
                            : s.status === 'pending_confirm'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {SUBTASK_STATUS_LABELS[s.status]}
                      </Badge>
                    </div>
                  </div>

                  <div
                    className="flex flex-wrap gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(isDevManager || mine) &&
                      s.status !== 'done' &&
                      s.status !== 'pending_confirm' && (
                        <>
                          {s.status === 'todo' && (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busyId === s.id}
                              onClick={() =>
                                void run(s.id, () => setSubtaskStatus(s, 'in_progress'))
                              }
                            >
                              В работу
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            disabled={busyId === s.id}
                            onClick={() => void run(s.id, () => submitForConfirm(s))}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Выполнено
                          </Button>
                        </>
                      )}

                    {canConfirm && s.status === 'pending_confirm' && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyId === s.id}
                          onClick={() => void run(s.id, () => confirmSubtask(s))}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Подтвердить
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busyId === s.id}
                          onClick={() => void run(s.id, () => rejectSubtask(s))}
                        >
                          <X className="h-3.5 w-3.5" />
                          Отклонить
                        </Button>
                      </>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelected(s)}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Комментарии
                    </Button>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {selected && (
        <SubtaskDetail
          subtask={
            subtasks.find((x) => x.id === selected.id) || selected
          }
          onClose={() => setSelected(null)}
          canConfirm={canConfirm}
          canWork={Boolean(isDevManager || user?.id === selected.assignedTo)}
          onStatus={(st) => void run(selected.id, () => setSubtaskStatus(selected, st))}
          onSubmit={() => void run(selected.id, () => submitForConfirm(selected))}
          onConfirm={() => void run(selected.id, () => confirmSubtask(selected))}
          onReject={() => void run(selected.id, () => rejectSubtask(selected))}
          busy={busyId === selected.id}
        />
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  danger,
  warn,
}: {
  label: string
  value: number
  danger?: boolean
  warn?: boolean
}) {
  return (
    <Card className="!p-3">
      <p className="text-[11px] font-medium uppercase text-muted">{label}</p>
      <p
        className={`text-xl font-bold ${
          danger ? 'text-danger' : warn ? 'text-amber-600' : 'text-text'
        }`}
      >
        {value}
      </p>
    </Card>
  )
}

function SubtaskDetail({
  subtask,
  onClose,
  canConfirm,
  canWork,
  onStatus,
  onSubmit,
  onConfirm,
  onReject,
  busy,
}: {
  subtask: DevSubtask
  onClose: () => void
  canConfirm: boolean
  canWork: boolean
  onStatus: (s: SubtaskStatus) => void
  onSubmit: () => void
  onConfirm: () => void
  onReject: () => void
  busy: boolean
}) {
  const { comments, addComment } = useDevSubtaskComments(subtask.id)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const overdue = isSubtaskOverdue(subtask.dueDate, subtask.status)

  async function send() {
    if (!text.trim()) return
    setSending(true)
    try {
      await addComment(text)
      setText('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text">{subtask.title}</h2>
            <p className="text-xs text-muted">
              {subtask.projectTitle} · {monthLabel(subtask.monthKey)}
              {subtask.dueDate ? ` · до ${subtask.dueDate}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-background"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {overdue && <Badge variant="danger">Просрочено</Badge>}
            <Badge variant="default">{SUBTASK_STATUS_LABELS[subtask.status]}</Badge>
            {subtask.carriedFromMonth && (
              <Badge variant="warning">Перенос с {subtask.carriedFromMonth}</Badge>
            )}
          </div>

          {subtask.description && (
            <p className="text-sm text-text whitespace-pre-wrap">{subtask.description}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {canWork &&
              subtask.status !== 'done' &&
              subtask.status !== 'pending_confirm' && (
                <>
                  {subtask.status === 'todo' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => onStatus('in_progress')}
                    >
                      В работу
                    </Button>
                  )}
                  <Button type="button" size="sm" disabled={busy} onClick={onSubmit}>
                    Выполнено → на подтверждение
                  </Button>
                </>
              )}
            {canConfirm && subtask.status === 'pending_confirm' && (
              <>
                <Button type="button" size="sm" disabled={busy} onClick={onConfirm}>
                  Подтвердить
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={onReject}
                >
                  Отклонить
                </Button>
              </>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-text">Комментарии</h3>
            {comments.length === 0 ? (
              <p className="text-xs text-muted">Пока нет комментариев</p>
            ) : (
              <ul className="space-y-2">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-background px-3 py-2">
                    <p className="text-xs font-medium text-muted">{c.authorName}</p>
                    <p className="text-sm text-text whitespace-pre-wrap">{c.text}</p>
                  </li>
                ))}
              </ul>
            )}
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Написать комментарий..."
              rows={2}
            />
            <Button
              type="button"
              size="sm"
              disabled={sending || !text.trim()}
              onClick={() => void send()}
            >
              Отправить
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
