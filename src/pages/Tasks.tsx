import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Download, LayoutGrid, List, Play, Plus, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'
import { useTasks } from '@/hooks/useTasks'
import { useUsers } from '@/hooks/useUsers'
import { useNotifications } from '@/hooks/useNotifications'
import { Button } from '@/components/ui/Button'
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'
import { TaskKanban } from '@/components/tasks/TaskKanban'
import { TaskList } from '@/components/tasks/TaskList'
import { TaskCalendar } from '@/components/tasks/TaskCalendar'
import { TaskDetail } from '@/components/tasks/TaskDetail'
import { POSITION_LABELS } from '@/constants/positions'
import { exportTasksToExcel } from '@/utils/exportTasks'
import { todayISO, toISODate } from '@/utils/dates'
import type { Task } from '@/types/task.types'
import type { User } from '@/types/user.types'
import type { TaskStatus } from '@/constants/taskStatuses'
import { TASK_STATUSES } from '@/constants/taskStatuses'

type ViewMode = 'list' | 'kanban' | 'calendar'
type ScopeFilter = 'active' | 'today' | 'overdue' | 'done' | 'all'

function timestampToISO(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string' && value.length >= 10) return value.slice(0, 10)
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return toISODate((value as { toDate: () => Date }).toDate())
    } catch {
      return null
    }
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const sec = (value as { seconds: number }).seconds
    return toISODate(new Date(sec * 1000))
  }
  return null
}

/** Date used for range filter: done → completedAt; else due/start. */
function taskFilterDate(task: Task, forDone: boolean): string | null {
  if (forDone) {
    return (
      timestampToISO(task.completedAt) ||
      task.dueDate ||
      task.startDate ||
      task.generatedForDate ||
      null
    )
  }
  return task.dueDate || task.startDate || task.generatedForDate || null
}

function calcStats(list: Task[], today: string) {
  const active = list.filter((t) => t.status !== 'done')
  return {
    total: list.length,
    active: active.length,
    remaining: active.length,
    done: list.filter((t) => t.status === 'done').length,
    overdue: active.filter((t) => t.dueDate && t.dueDate < today).length,
    today: active.filter((t) => t.dueDate === today).length,
    inProgress: list.filter((t) => t.status === 'in_progress').length,
    todo: list.filter((t) => t.status === 'todo').length,
    postponed: list.filter((t) => t.status === 'postponed').length,
    blocked: list.filter((t) => t.status === 'blocked').length,
  }
}

function startOfWeekISO(today: string): string {
  const d = new Date(`${today}T12:00:00`)
  const day = d.getDay() // 0 Sun
  const mondayOffset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + mondayOffset)
  return toISODate(d)
}

function startOfMonthISO(today: string): string {
  return `${today.slice(0, 7)}-01`
}

export function Tasks() {
  const { user, isAdmin } = useAuth()
  const { canCreateTasks } = useRole()
  const { tasks, loading, error, createTasks, setStatus, updateTask, deleteTask } = useTasks()
  const { users, loading: usersLoading, error: usersError } = useUsers(true)
  const { scanOverdue } = useNotifications()
  const [view, setView] = useState<ViewMode>('list')
  const [scope, setScope] = useState<ScopeFilter>('active')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Task | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const today = todayISO()

  useEffect(() => {
    if (loading || !user) return
    const adminIds = users.filter((u) => u.role === 'admin').map((u) => u.id)
    if (isAdmin && !adminIds.includes(user.id)) adminIds.push(user.id)
    void scanOverdue(tasks, adminIds.length ? adminIds : [user.id])
  }, [loading, tasks, users, isAdmin, user, scanOverdue])

  const teamUsers = useMemo(() => {
    if (!canCreateTasks) return [] as User[]
    return users.filter((u) => u.position !== 'head' || u.id === user?.id)
  }, [canCreateTasks, users, user?.id])

  const scopedTasks = useMemo(() => {
    if (!canCreateTasks) return tasks
    if (assigneeFilter === 'all') return tasks
    return tasks.filter((t) => t.assignedTo === assigneeFilter)
  }, [tasks, canCreateTasks, assigneeFilter])

  const hasDateFilter = Boolean(dateFrom || dateTo)

  function matchesDateRange(task: Task, forDone: boolean): boolean {
    if (!hasDateFilter) return true
    const iso = taskFilterDate(task, forDone)
    if (!iso) return false
    if (dateFrom && iso < dateFrom) return false
    if (dateTo && iso > dateTo) return false
    return true
  }

  const teamStats = useMemo(() => calcStats(tasks, today), [tasks, today])
  const personStats = useMemo(() => {
    const list = hasDateFilter
      ? scopedTasks.filter((t) => matchesDateRange(t, t.status === 'done'))
      : scopedTasks
    return calcStats(list, today)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesDateRange closes over dateFrom/dateTo
  }, [scopedTasks, today, dateFrom, dateTo, hasDateFilter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scopedTasks.filter((task) => {
      if (q) {
        const hay = `${task.title} ${task.description || ''} ${task.assignedToName}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      let ok = true
      switch (scope) {
        case 'active':
          ok = task.status !== 'done'
          break
        case 'today':
          ok = task.dueDate === today && task.status !== 'done'
          break
        case 'overdue':
          ok = !!task.dueDate && task.dueDate < today && task.status !== 'done'
          break
        case 'done':
          ok = task.status === 'done'
          break
        default:
          ok = true
      }
      if (!ok) return false
      return matchesDateRange(task, scope === 'done' || task.status === 'done')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedTasks, scope, today, search, dateFrom, dateTo])

  const perUserStats = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calcStats>>()
    for (const u of teamUsers) {
      map.set(u.id, calcStats(tasks.filter((t) => t.assignedTo === u.id), today))
    }
    return map
  }, [teamUsers, tasks, today])

  const selectedUser = useMemo(
    () => teamUsers.find((u) => u.id === assigneeFilter) || null,
    [teamUsers, assigneeFilter],
  )

  /** My tasks that still need to be taken into work */
  const takeToWork = useMemo(() => {
    if (!user) return [] as Task[]
    return tasks.filter((t) => t.assignedTo === user.id && t.status === 'todo')
  }, [tasks, user])

  function setDatePreset(preset: 'today' | 'week' | 'month' | 'clear') {
    if (preset === 'clear') {
      setDateFrom('')
      setDateTo('')
      return
    }
    if (preset === 'today') {
      setDateFrom(today)
      setDateTo(today)
      return
    }
    if (preset === 'week') {
      setDateFrom(startOfWeekISO(today))
      setDateTo(today)
      return
    }
    setDateFrom(startOfMonthISO(today))
    setDateTo(today)
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    try {
      const next = await setStatus(taskId, status)
      if (next === 'awaiting_confirm') {
        alert(
          'Отправлено на проверку тому, кто поставил задачу. После подтверждения статус станет «Выполнена».',
        )
      }
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Не удалось обновить статус')
    }
  }

  return (
    <div className="space-y-4">
      {takeToWork.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Взять в работу · {takeToWork.length}
          </p>
          {takeToWork.map((task) => (
            <div
              key={task.id}
              className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-secondary/30 bg-secondary text-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => setSelected(task)}
                className="min-w-0 flex-1 px-4 py-3 text-left"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-white/70">
                  Нужно взять в работу
                  {task.createdByName ? ` · от ${task.createdByName}` : ''}
                  {task.dueDate ? ` · до ${task.dueDate}` : ''}
                </p>
                <p className="mt-0.5 truncate text-base font-semibold">{task.title}</p>
              </button>
              <div className="flex shrink-0 items-center gap-2 px-3 pb-3 sm:pb-0 sm:pr-3">
                <button
                  type="button"
                  onClick={() => void handleStatusChange(task.id, 'in_progress')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-secondary shadow-sm hover:bg-white/90"
                >
                  <Play className="h-3.5 w-3.5" />
                  Взять в работу
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">
            {canCreateTasks ? 'Задачи команды' : 'Мои задачи'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {canCreateTasks
              ? selectedUser
                ? `Задачи: ${selectedUser.name}`
                : 'Выберите сотрудника или смотрите всю команду'
              : 'Свои задачи и статусы — можно добавить задачу себе, если сказали устно'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              exportTasksToExcel(
                filtered,
                canCreateTasks ? 'zadachi_komandy' : 'moi_zadachi',
              )
            }
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {canCreateTasks ? 'Поставить задачу' : 'Добавить себе'}
          </Button>
          <div className="flex rounded-lg border border-gray-200 bg-surface p-1">
            {(
              [
                ['list', List, 'Список'],
                ['kanban', LayoutGrid, 'Канбан'],
                ['calendar', CalendarDays, 'Календарь'],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                  view === key ? 'bg-primary text-white' : 'text-muted hover:text-text'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {canCreateTasks && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-text">Сотрудники</p>
            {usersLoading && <span className="text-xs text-muted">Загрузка...</span>}
          </div>
          {usersError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{usersError}</div>
          )}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => setAssigneeFilter('all')}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                assigneeFilter === 'all'
                  ? 'border-secondary bg-secondary/10'
                  : 'border-gray-200 bg-surface hover:border-gray-300'
              }`}
            >
              <span className="block text-sm font-semibold text-text">Вся команда</span>
              <span className="mt-1 block text-xs text-muted">
                Всего {teamStats.total} · активных {teamStats.active}
              </span>
            </button>
            {teamUsers.map((u) => {
              const s = perUserStats.get(u.id) || calcStats([], today)
              const active = assigneeFilter === u.id
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setAssigneeFilter(u.id)}
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                    active
                      ? 'border-secondary bg-secondary/10'
                      : 'border-gray-200 bg-surface hover:border-gray-300'
                  }`}
                >
                  <span className="block truncate text-sm font-semibold text-text">{u.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {POSITION_LABELS[u.position]}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted">
                    <span>всего {s.total}</span>
                    <span>· осталось {s.remaining}</span>
                    {s.overdue > 0 && <span className="text-danger">· просрок {s.overdue}</span>}
                    <span>· готово {s.done}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatChip label="Всего" value={personStats.total} />
        <StatChip label="Осталось" value={personStats.remaining} tone="secondary" />
        <StatChip
          label="Просрочено"
          value={personStats.overdue}
          tone={personStats.overdue > 0 ? 'danger' : 'muted'}
        />
        <StatChip label="Выполнено" value={personStats.done} tone="success" />
      </div>

      {(personStats.todo > 0 ||
        personStats.inProgress > 0 ||
        personStats.postponed > 0 ||
        personStats.blocked > 0) && (
        <p className="text-xs text-muted">
          По статусам: не начата {personStats.todo} · в работе {personStats.inProgress}
          {personStats.postponed > 0 ? ` · отложена ${personStats.postponed}` : ''}
          {personStats.blocked > 0 ? ` · блокер ${personStats.blocked}` : ''}
          {personStats.today > 0 ? ` · на сегодня ${personStats.today}` : ''}
        </p>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-[13px] z-10 h-4 w-4 text-muted" />
        <input
          name="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию, описанию, сотруднику..."
          className="w-full rounded-lg border border-gray-200 bg-surface py-2.5 pl-9 pr-3 text-sm text-text outline-none placeholder:text-muted focus:border-secondary focus:ring-2 focus:ring-secondary/20"
        />
      </div>

      <div className="space-y-2 rounded-xl border border-gray-100 bg-surface p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted">Дата с</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-background px-3 py-2 text-sm outline-none focus:border-secondary"
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted">Дата по</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-background px-3 py-2 text-sm outline-none focus:border-secondary"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 pb-0.5">
            {(
              [
                ['today', 'Сегодня'],
                ['week', 'Неделя'],
                ['month', 'Месяц'],
                ['clear', 'Сбросить'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDatePreset(key)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  key === 'clear'
                    ? 'text-muted hover:bg-background hover:text-text'
                    : 'bg-background text-muted hover:text-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted">
          Фильтр по дате работает вместе с менеджером и статусом (активные / просрок / готово).
          Для «Готово» — дата выполнения, иначе — срок задачи.
          {hasDateFilter
            ? ` · показано: ${filtered.length}`
            : ''}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['active', 'Активные'],
            ['today', 'Сегодня'],
            ['overdue', 'Просрок'],
            ['done', 'Готово'],
            ['all', 'Все'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setScope(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              scope === key
                ? 'bg-primary text-white'
                : 'bg-surface text-muted shadow-sm hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : view === 'calendar' ? (
        <TaskCalendar tasks={filtered} onOpen={setSelected} />
      ) : view === 'kanban' ? (
        <TaskKanban
          tasks={filtered}
          showAssignee={canCreateTasks && assigneeFilter === 'all'}
          viewerId={user?.id}
          canConfirmTasks={canCreateTasks}
          onStatusChange={handleStatusChange}
          onOpen={setSelected}
        />
      ) : (
        <TaskList
          tasks={filtered}
          showAssignee={canCreateTasks && assigneeFilter === 'all'}
          viewerId={user?.id}
          canConfirmTasks={canCreateTasks}
          onStatusChange={handleStatusChange}
          onOpen={setSelected}
        />
      )}

      {!loading && filtered.length > 0 && view === 'list' && (
        <p className="text-center text-xs text-muted">
          Показано {filtered.length} · статусы: {Object.values(TASK_STATUSES).join(' · ')}
        </p>
      )}

      <TaskDetail
        task={selected}
        canDelete={isAdmin || selected?.createdBy === user?.id}
        onClose={() => setSelected(null)}
        onSave={async (id, data) => {
          await updateTask(id, data)
        }}
        onDelete={deleteTask}
      />

      <CreateTaskModal
        open={createOpen}
        users={canCreateTasks ? users : user ? [user] : []}
        usersLoading={canCreateTasks ? usersLoading : false}
        usersError={canCreateTasks ? usersError : undefined}
        selfOnly={!canCreateTasks}
        onClose={() => setCreateOpen(false)}
        onSubmit={createTasks}
      />
    </div>
  )
}

function StatChip({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'secondary' | 'danger' | 'success' | 'muted'
}) {
  const tones = {
    default: 'bg-surface text-text',
    secondary: 'bg-secondary/10 text-secondary',
    danger: 'bg-red-50 text-danger',
    success: 'bg-emerald-50 text-emerald-700',
    muted: 'bg-surface text-muted',
  }
  return (
    <div className={`rounded-xl px-3 py-2.5 shadow-sm ${tones[tone]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-xl font-bold">{value}</p>
    </div>
  )
}
