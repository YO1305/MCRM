import { useMemo, useState, type FormEvent } from 'react'
import { Check, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card } from '@/components/ui/Card'
import { useTaskTemplates } from '@/hooks/useTaskTemplates'
import { POSITION_LABELS } from '@/constants/positions'
import { TASK_PRIORITIES } from '@/constants/taskMeta'
import { RECURRENCE_LABELS } from '@/utils/taskTemplates'
import type { User } from '@/types/user.types'
import type { TaskRecurrence } from '@/types/taskTemplate.types'
import type { TaskPriority } from '@/types/task.types'

const WEEKDAYS = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Вс' },
]

interface MassTemplateFormProps {
  users: User[]
}

export function MassTemplateForm({ users }: MassTemplateFormProps) {
  const { createTemplatesForUsers } = useTaskTemplates()
  const team = useMemo(
    () => users.filter((u) => u.isActive !== false),
    [users],
  )

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('daily')
  const [interval, setInterval] = useState(1)
  const [dueOffsetDays, setDueOffsetDays] = useState(0)
  const [weekday, setWeekday] = useState(1)
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function selectAll() {
    setSelectedIds(team.map((u) => u.id))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Введите название шаблона')
      return
    }
    if (!selectedIds.length) {
      setError('Отметьте хотя бы одного сотрудника')
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const assignees = team
        .filter((u) => selectedIds.includes(u.id))
        .map((u) => ({ id: u.id, name: u.name }))
      await createTemplatesForUsers(
        {
          title: title.trim(),
          description,
          priority,
          recurrence,
          interval:
            recurrence === 'every_n_days' || recurrence === 'every_n_months' ? interval : 1,
          dueOffsetDays,
          weekday: recurrence === 'weekly' ? weekday : null,
          dayOfMonth: recurrence === 'monthly' ? dayOfMonth : null,
        },
        assignees,
      )
      setMessage(`Шаблон поставлен ${assignees.length} сотрудникам`)
      setTitle('')
      setDescription('')
      setSelectedIds([])
      setRecurrence('daily')
      setInterval(1)
      setDueOffsetDays(0)
    } catch (err) {
      console.error(err)
      setError('Не удалось создать шаблоны')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Массовый шаблон задач</h2>
        <p className="mt-1 text-xs text-muted">
          Один шаблон сразу нескольким сотрудникам (ежедневно, раз в N месяцев и т.д.)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-text">Кому поставить шаблон</p>
            <button
              type="button"
              onClick={selectAll}
              className="text-xs font-medium text-secondary hover:underline"
            >
              Всем
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {team.map((u) => {
              const active = selectedIds.includes(u.id)
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggle(u.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm ${
                    active
                      ? 'border-secondary bg-secondary/10'
                      : 'border-gray-200 bg-background hover:border-gray-300'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      active
                        ? 'border-secondary bg-secondary text-white'
                        : 'border-gray-300'
                    }`}
                  >
                    {active && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-text">{u.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {POSITION_LABELS[u.position]}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <Input
          label="Название шаблона"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например: Ежедневный отчёт"
          required
        />
        <Textarea
          label="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Необязательно"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Расписание</label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as TaskRecurrence)}
              className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
            >
              {(Object.keys(RECURRENCE_LABELS) as TaskRecurrence[]).map((key) => (
                <option key={key} value={key}>
                  {RECURRENCE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Срок (дней от даты)"
            type="number"
            min={0}
            value={String(dueOffsetDays)}
            onChange={(e) => setDueOffsetDays(Number(e.target.value) || 0)}
          />
        </div>

        {(recurrence === 'every_n_days' || recurrence === 'every_n_months') && (
          <Input
            label={recurrence === 'every_n_days' ? 'Каждые N дней' : 'Каждые N месяцев'}
            type="number"
            min={1}
            value={String(interval)}
            onChange={(e) => setInterval(Math.max(1, Number(e.target.value) || 1))}
          />
        )}

        {recurrence === 'weekly' && (
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setWeekday(d.value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                  weekday === d.value ? 'bg-secondary text-white' : 'bg-background text-muted'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}

        {recurrence === 'monthly' && (
          <Input
            label="День месяца"
            type="number"
            min={1}
            max={28}
            value={String(dayOfMonth)}
            onChange={(e) =>
              setDayOfMonth(Math.min(28, Math.max(1, Number(e.target.value) || 1)))
            }
          />
        )}

        <div className="flex flex-wrap gap-2">
          {(Object.keys(TASK_PRIORITIES) as TaskPriority[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPriority(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                priority === key ? 'bg-primary text-white' : 'bg-background text-muted'
              }`}
            >
              {TASK_PRIORITIES[key]}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {message && <p className="text-sm text-secondary">{message}</p>}

        <Button type="submit" disabled={submitting} fullWidth>
          <Plus className="h-4 w-4" />
          {submitting
            ? 'Создаём...'
            : selectedIds.length > 1
              ? `Поставить шаблон · ${selectedIds.length}`
              : 'Поставить шаблон'}
        </Button>
      </form>
    </Card>
  )
}
