import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { where } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/hooks/useClients'
import { Card } from '@/components/ui/Card'
import { POSITION_LABELS } from '@/constants/positions'
import { subscribeToCollection } from '@/firebase/firestore'
import type { Task } from '@/types/task.types'
import { canSeeLeadActivity, countLeadActivity } from '@/utils/leadActivity'

export function Dashboard() {
  const { user, isAdmin } = useAuth()
  const { clients } = useClients()
  const showActivity = isAdmin || canSeeLeadActivity(user)
  const activityCounts = useMemo(() => countLeadActivity(clients), [clients])
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    if (!user) return
    const constraints = isAdmin ? [] : [where('assignedTo', '==', user.id)]
    return subscribeToCollection<Task>('tasks', constraints, setTasks)
  }, [user, isAdmin])

  const today = new Date().toISOString().slice(0, 10)

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
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-text">Лиды по активности</h2>
            <Link to="/crm" className="text-sm font-medium text-secondary hover:underline">
              Открыть CRM
            </Link>
          </div>
          <p className="text-xs text-muted">Текущий месяц · только открытые лиды</p>
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
