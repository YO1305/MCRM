import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { where } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/hooks/useClients'
import { useAiTasks } from '@/hooks/useAiTasks'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { POSITION_LABELS } from '@/constants/positions'
import { subscribeToCollection } from '@/firebase/firestore'
import { runAiLeadAnalysisNow } from '@/firebase/callable'
import type { Task } from '@/types/task.types'
import { useAiConfig } from '@/hooks/useAiConfig'
import { canSeeLeadActivity, countLeadActivity } from '@/utils/leadActivity'
import { syncOpenedMonthsFromHistory } from '@/utils/syncOpenedMonths'
import { todayISO, toISODate } from '@/utils/dates'

export function Dashboard() {
  const { user, isAdmin } = useAuth()
  const { clients } = useClients()
  const { tasks: aiTasks } = useAiTasks()
  const showActivity = isAdmin || canSeeLeadActivity(user)
  const { config: aiConfig } = useAiConfig()
  const activityCounts = useMemo(
    () =>
      countLeadActivity(clients, {
        touchThresholdDays: aiConfig?.touchThresholdDays,
        movementThresholdDays: aiConfig?.movementThresholdDays,
        maxActiveMonths: aiConfig?.maxActiveMonths,
      }),
    [clients, aiConfig],
  )
  const [tasks, setTasks] = useState<Task[]>([])
  const [aiRunning, setAiRunning] = useState(false)
  const [syncingMonths, setSyncingMonths] = useState(false)

  useEffect(() => {
    if (!user) return
    const constraints = isAdmin ? [] : [where('assignedTo', '==', user.id)]
    return subscribeToCollection<Task>('tasks', constraints, setTasks)
  }, [user, isAdmin])

  const today = todayISO()

  const aiOverview = useMemo(() => {
    if (!isAdmin) return null
    const isToday = (value: unknown) => {
      if (!value) return false
      if (typeof value === 'object' && value !== null && 'seconds' in value) {
        return toISODate(new Date((value as { seconds: number }).seconds * 1000)) === today
      }
      if (typeof value === 'object' && value !== null && 'toDate' in value) {
        try {
          return toISODate((value as { toDate: () => Date }).toDate()) === today
        } catch {
          return false
        }
      }
      return false
    }
    const todays = aiTasks.filter((t) => isToday(t.generatedAt) || t.status === 'pending')
    const byManager = new Map<string, { name: string; total: number; done: number }>()
    for (const t of todays) {
      const row = byManager.get(t.assignedTo) || {
        name: t.assignedToName || 'Менеджер',
        total: 0,
        done: 0,
      }
      row.total += 1
      if (t.status === 'done') row.done += 1
      byManager.set(t.assignedTo, row)
    }
    const rows = [...byManager.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    const total = rows.reduce((s, r) => s + r.total, 0)
    const done = rows.reduce((s, r) => s + r.done, 0)
    return { rows, total, done }
  }, [aiTasks, isAdmin, today])

  const stats = useMemo(() => {
    const active = tasks.filter((t) => t.status !== 'done')
    return {
      active: active.length,
      today: active.filter((t) => t.dueDate === today).length,
      overdue: active.filter((t) => t.dueDate && t.dueDate < today).length,
      done: tasks.filter((t) => t.status === 'done').length,
    }
  }, [tasks, today])

  const nextTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'done')
        .slice(0, 5),
    [tasks],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">
          {isAdmin ? 'Дашборд руководителя' : 'Мой дашборд'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Добро пожаловать, {user?.name}
          {user ? ` · ${POSITION_LABELS[user.position]}` : ''}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-muted">Активные задачи</p>
          <p className="mt-2 text-2xl font-bold text-primary">{stats.active}</p>
          <p className="mt-1 text-xs text-muted">
            {isAdmin ? 'По всей команде' : 'Ваши открытые'}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">На сегодня</p>
          <p className="mt-2 text-2xl font-bold text-primary">{stats.today}</p>
          <p className="mt-1 text-xs text-muted">Со сроком сегодня</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Просрок</p>
          <p
            className={`mt-2 text-2xl font-bold ${stats.overdue ? 'text-danger' : 'text-primary'}`}
          >
            {stats.overdue}
          </p>
          <p className="mt-1 text-xs text-muted">Нужно закрыть</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Выполнено</p>
          <p className="mt-2 text-2xl font-bold text-success">{stats.done}</p>
          <p className="mt-1 text-xs text-muted">Всего завершённых</p>
        </Card>
      </div>

      {showActivity && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-text">Лиды по активности</h2>
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={syncingMonths}
                  onClick={() => {
                    if (
                      !confirm(
                        'Проставить всем открытым лидам дату открытия по самой ранней записи в истории? Это нужно, если карточки завели в CRM позже реального старта.',
                      )
                    ) {
                      return
                    }
                    void (async () => {
                      setSyncingMonths(true)
                      try {
                        const result = await syncOpenedMonthsFromHistory(clients, {
                          overwrite: true,
                        })
                        alert(
                          `Готово: обновлено ${result.updated}, пропущено ${result.skipped}, ошибок ${result.errors}`,
                        )
                      } catch (err) {
                        console.error(err)
                        alert(
                          err instanceof Error
                            ? err.message
                            : 'Не удалось проставить месяцы открытия',
                        )
                      } finally {
                        setSyncingMonths(false)
                      }
                    })()
                  }}
                >
                  {syncingMonths ? 'Считаю…' : 'Проставить даты по истории'}
                </Button>
              )}
              <Link to="/crm" className="text-sm font-medium text-secondary hover:underline">
                Открыть CRM
              </Link>
            </div>
          </div>
          <p className="text-xs text-muted">
            «Новый» = 1-й месяц с даты открытия лида (не дата занесения в CRM). Менеджер ставит
            точную дату в карточке; либо используйте кнопку выше по истории.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-sm text-muted">Новые</p>
              <p className="mt-1 text-2xl font-bold text-blue-600">{activityCounts.new}</p>
            </div>
            <div>
              <p className="text-sm text-muted">Активные</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{activityCounts.active}</p>
            </div>
            <div>
              <p className="text-sm text-muted">Требуют внимания</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">{activityCounts.critical}</p>
            </div>
            <div>
              <p className="text-sm text-muted">Замороженные</p>
              <p className="mt-1 text-2xl font-bold text-gray-600">{activityCounts.frozen}</p>
            </div>
          </div>
        </Card>
      )}

      {isAdmin && aiOverview && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-text">ИИ задачи на сегодня</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={aiRunning}
                onClick={() => {
                  void (async () => {
                    setAiRunning(true)
                    try {
                      const result = await runAiLeadAnalysisNow()
                      alert(
                        `ИИ: создано ${result.created}, пропущено ${result.skipped}` +
                          (result.remaining > 0
                            ? `, осталось ${result.remaining} — нажмите ещё раз`
                            : ''),
                      )
                    } catch (err) {
                      console.error(err)
                      alert(
                        err instanceof Error
                          ? err.message
                          : 'Не удалось запустить ИИ. Проверьте GROQ_API_KEY в Vercel.',
                      )
                    } finally {
                      setAiRunning(false)
                    }
                  })()
                }}
              >
                {aiRunning ? 'Генерирую…' : 'Сгенерировать ИИ-задачи'}
              </Button>
              <Link to="/tasks" className="text-sm font-medium text-secondary hover:underline">
                К задачам
              </Link>
            </div>
          </div>
          {aiOverview.rows.length === 0 ? (
            <p className="text-sm text-muted">
              Пока нет ИИ-задач. Нажмите «Сгенерировать» (нужен GROQ_API_KEY в Vercel) или дождитесь
              утреннего автозапуска.
            </p>
          ) : (
            <ul className="space-y-2">
              {aiOverview.rows.map((row) => (
                <li
                  key={row.name}
                  className="flex items-center justify-between gap-3 text-sm text-text"
                >
                  <span className="font-medium">{row.name}</span>
                  <span className="text-muted">
                    {row.total} задач ({row.done} выполнено)
                  </span>
                </li>
              ))}
              <li className="border-t border-gray-100 pt-2 text-sm font-medium text-text">
                Всего: {aiOverview.total} задач, {aiOverview.done} выполнено
              </li>
            </ul>
          )}
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-text">Ближайшие задачи</h2>
          <Link to="/tasks" className="text-sm font-medium text-secondary hover:underline">
            Все задачи
          </Link>
        </div>

        {nextTasks.length === 0 ? (
          <p className="text-sm text-muted">Активных задач нет — можно поставить новые.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {nextTasks.map((task) => (
              <li key={task.id} className="flex items-start justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-text">{task.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {isAdmin ? `${task.assignedToName} · ` : ''}
                    {task.dueDate || 'без срока'}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {task.status === 'in_progress'
                    ? 'В работе'
                    : task.status === 'blocked'
                      ? 'Блокер'
                      : task.status === 'postponed'
                        ? 'Отложена'
                        : 'Не начата'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
