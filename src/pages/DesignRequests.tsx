import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'
import { useUsers } from '@/hooks/useUsers'
import { useTasks } from '@/hooks/useTasks'
import { useTaskTemplates } from '@/hooks/useTaskTemplates'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'
import { TaskList } from '@/components/tasks/TaskList'
import { TaskDetail } from '@/components/tasks/TaskDetail'
import { getCurrentMonth } from '@/utils/dates'
import type { Task } from '@/types/task.types'
import type { TaskRecurrence } from '@/types/taskTemplate.types'

const RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  daily: 'Ежедневно',
  weekly: 'Еженедельно',
  monthly: 'Ежемесячно',
  every_n_days: 'Раз в N дней',
  every_n_months: 'Раз в N месяцев',
}

export function DesignRequests() {
  const { user, isAdmin } = useAuth()
  const { canCreateTasks } = useRole()
  const isDesigner = user?.position === 'designer'
  const { users } = useUsers(canCreateTasks || isAdmin)

  const designer = useMemo(
    () => users.find((u) => u.position === 'designer' && u.isActive !== false) || null,
    [users],
  )

  const designerId = isDesigner ? user!.id : designer?.id || null
  const designerName = isDesigner ? user!.name : designer?.name || 'Дизайнер'

  const { tasks, loading, createTasks, setStatus, updateTask, deleteTask } = useTasks(
    designerId && (canCreateTasks || isAdmin) && !isDesigner
      ? { forAssigneeId: designerId }
      : undefined,
  )

  const designerTasks = useMemo(() => {
    if (isDesigner || !designerId) return tasks
    return tasks.filter((t) => t.assignedTo === designerId)
  }, [tasks, isDesigner, designerId])

  const {
    templates,
    loading: templatesLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  } = useTaskTemplates(designerId)

  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<Task | null>(null)
  const [month, setMonth] = useState(getCurrentMonth())
  const [tplTitle, setTplTitle] = useState('')
  const [tplDesc, setTplDesc] = useState('')
  const [tplRecurrence, setTplRecurrence] = useState<TaskRecurrence>('daily')
  const [tplBusy, setTplBusy] = useState(false)

  const monthTasks = useMemo(
    () =>
      designerTasks.filter((t) => {
        const d = t.dueDate || t.startDate || ''
        return d.startsWith(month)
      }),
    [designerTasks, month],
  )

  const monthStats = useMemo(() => {
    const done = monthTasks.filter((t) => t.status === 'done').length
    const active = monthTasks.filter((t) => t.status !== 'done').length
    const byDay: Record<string, { total: number; done: number }> = {}
    for (const t of monthTasks) {
      const day = (t.dueDate || t.startDate || '').slice(0, 10)
      if (!day) continue
      if (!byDay[day]) byDay[day] = { total: 0, done: 0 }
      byDay[day].total += 1
      if (t.status === 'done') byDay[day].done += 1
    }
    const days = Object.keys(byDay).sort()
    const max = Math.max(1, ...days.map((d) => byDay[d].total))
    return { done, active, total: monthTasks.length, byDay, days, max }
  }, [monthTasks])

  const openTasks = useMemo(
    () => designerTasks.filter((t) => t.status !== 'done'),
    [designerTasks],
  )

  async function handleCreateTemplate() {
    if (!designerId || !tplTitle.trim()) return
    setTplBusy(true)
    try {
      await createTemplate({
        userId: designerId,
        userName: designerName,
        title: tplTitle.trim(),
        description: tplDesc,
        recurrence: tplRecurrence,
        interval: 1,
        dueOffsetDays: 0,
        weekday: tplRecurrence === 'weekly' ? 1 : null,
        dayOfMonth: tplRecurrence === 'monthly' ? 1 : null,
        priority: 'normal',
        active: true,
      })
      setTplTitle('')
      setTplDesc('')
    } finally {
      setTplBusy(false)
    }
  }

  const canManageTemplates = canCreateTasks || isAdmin || isDesigner
  const canAddTask = canCreateTasks || isAdmin || isDesigner

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Дизайн · задачи</h1>
          <p className="mt-1 text-sm text-muted">
            {isDesigner
              ? 'Ваши задачи и стандартные шаблоны'
              : `Задачи дизайнера${designer ? `: ${designer.name}` : ''}`}
          </p>
        </div>
        {canAddTask && (
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!designerId && !isDesigner}
          >
            <Plus className="h-4 w-4" />
            Задача
          </Button>
        )}
      </div>

      {!designerId && !isDesigner && (
        <Card>
          <p className="text-sm text-muted">
            Нет пользователя с должностью «Дизайнер». Добавьте в команде (design@bahmal.uz).
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Открыто" value={openTasks.length} />
        <Stat label="За месяц" value={monthStats.total} />
        <Stat label="Сделано" value={monthStats.done} tone="success" />
        <Stat label="В работе" value={monthStats.active} tone="info" />
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-text">Отчёт за месяц</h2>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-gray-200 bg-surface px-3 py-1.5 text-sm outline-none focus:border-secondary"
          />
        </div>
        {monthStats.days.length === 0 ? (
          <p className="text-sm text-muted">Нет задач с датами в этом месяце</p>
        ) : (
          <div className="flex items-end gap-1 overflow-x-auto pb-1" style={{ minHeight: 120 }}>
            {monthStats.days.map((day) => {
              const row = monthStats.byDay[day]
              const h = Math.round((row.total / monthStats.max) * 80)
              const doneH = row.total ? Math.round((row.done / row.total) * h) : 0
              return (
                <div key={day} className="flex w-8 shrink-0 flex-col items-center gap-1">
                  <div
                    className="relative flex w-5 flex-col justify-end rounded-t bg-gray-100"
                    style={{ height: Math.max(h, 4) }}
                    title={`${day}: ${row.done}/${row.total}`}
                  >
                    <div
                      className="w-full rounded-t bg-emerald-500"
                      style={{ height: Math.max(doneH, row.done ? 2 : 0) }}
                    />
                  </div>
                  <span className="text-[9px] text-muted">{day.slice(8)}</span>
                </div>
              )
            })}
          </div>
        )}
        <p className="text-xs text-muted">
          Зелёный — выполненные. Высота столбца — всего задач на день.
        </p>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold text-text">Текущие задачи</h2>
        {loading ? (
          <p className="text-sm text-muted">Загрузка...</p>
        ) : openTasks.length === 0 ? (
          <p className="text-sm text-muted">Открытых задач нет</p>
        ) : (
          <TaskList
            tasks={openTasks}
            showAssignee={false}
            viewerId={user?.id}
            canConfirmTasks={canCreateTasks || isAdmin}
            onOpen={setSelected}
            onStatusChange={(id, status) => {
              void setStatus(id, status).catch((err) => {
                console.error(err)
                alert(err instanceof Error ? err.message : 'Не удалось обновить статус')
              })
            }}
          />
        )}
      </Card>

      {canManageTemplates && designerId && (
        <Card className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-text">Стандартные задачи</h2>
            <p className="mt-0.5 text-xs text-muted">
              Ежедневные / ежемесячные — создаются автоматически при входе в CRM
            </p>
          </div>

          {templatesLoading ? (
            <p className="text-sm text-muted">Загрузка...</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {templates.length === 0 ? (
                <li className="py-2 text-sm text-muted">Шаблонов пока нет</li>
              ) : (
                templates.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium text-text">{t.title}</p>
                      <p className="text-xs text-muted">
                        {RECURRENCE_LABELS[t.recurrence]}
                        {!t.active ? ' · выкл' : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void updateTemplate(t.id, { active: !t.active })}
                      >
                        {t.active ? 'Выкл' : 'Вкл'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('Удалить шаблон?')) void deleteTemplate(t.id)
                        }}
                      >
                        Удалить
                      </Button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}

          <div className="space-y-2 border-t border-gray-100 pt-3">
            <Input
              label="Новый шаблон"
              value={tplTitle}
              onChange={(e) => setTplTitle(e.target.value)}
              placeholder="Название задачи"
            />
            <Textarea
              value={tplDesc}
              onChange={(e) => setTplDesc(e.target.value)}
              placeholder="Описание (необязательно)"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">Периодичность</label>
              <select
                value={tplRecurrence}
                onChange={(e) => setTplRecurrence(e.target.value as TaskRecurrence)}
                className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-secondary"
              >
                {(Object.keys(RECURRENCE_LABELS) as TaskRecurrence[]).map((key) => (
                  <option key={key} value={key}>
                    {RECURRENCE_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={tplBusy || !tplTitle.trim()}
              onClick={() => void handleCreateTemplate()}
            >
              Добавить шаблон
            </Button>
          </div>
        </Card>
      )}

      <CreateTaskModal
        open={createOpen}
        users={
          isDesigner && user
            ? [user]
            : designer
              ? [designer]
              : users.filter((u) => u.position === 'designer')
        }
        onClose={() => setCreateOpen(false)}
        onSubmit={async (input, assignees) => {
          const list =
            assignees.length > 0
              ? assignees
              : designerId
                ? [{ id: designerId, name: designerName }]
                : []
          await createTasks(input, list)
        }}
      />

      <TaskDetail
        task={selected}
        canDelete={isAdmin || canCreateTasks || selected?.createdBy === user?.id}
        onClose={() => setSelected(null)}
        onSave={async (id, data) => {
          await updateTask(id, data)
        }}
        onDelete={async (id) => {
          await deleteTask(id)
          setSelected(null)
        }}
      />
    </div>
  )
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'success' | 'info'
}) {
  const tones = {
    default: 'bg-surface text-text',
    success: 'bg-emerald-50 text-emerald-800',
    info: 'bg-secondary/10 text-secondary',
  }
  return (
    <div className={`rounded-xl px-3 py-2.5 shadow-sm ${tones[tone]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-xl font-bold">{value}</p>
    </div>
  )
}
