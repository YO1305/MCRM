import { useMemo, useState } from 'react'
import type { Task } from '@/types/task.types'
import { TASK_STATUSES } from '@/constants/taskStatuses'
import { STATUS_BADGE } from '@/constants/taskMeta'
import { Badge } from '@/components/ui/Badge'
import { toISODate, parseISODate } from '@/utils/dates'

interface TaskCalendarProps {
  tasks: Task[]
  onOpen: (task: Task) => void
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function TaskCalendar({ tasks, onOpen }: TaskCalendarProps) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Monday-first: convert Sun=0 → 6
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      const key = task.dueDate || task.startDate
      if (!key) continue
      const list = map.get(key) || []
      list.push(task)
      map.set(key, list)
    }
    return map
  }, [tasks])

  const cells: (number | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const selectedTasks = selectedDay ? byDay.get(selectedDay) || [] : []
  const monthLabel = cursor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-surface hover:text-text"
        >
          ←
        </button>
        <p className="text-sm font-semibold capitalize text-text">{monthLabel}</p>
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-surface hover:text-text"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-medium text-muted">
            {d}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day == null) return <div key={`e-${idx}`} />
          const iso = toISODate(new Date(year, month, day))
          const count = byDay.get(iso)?.length || 0
          const active = selectedDay === iso
          const isToday = iso === toISODate(new Date())
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelectedDay(iso)}
              className={`flex min-h-14 flex-col items-center rounded-lg border p-1 text-xs transition-colors ${
                active
                  ? 'border-secondary bg-secondary/10'
                  : isToday
                    ? 'border-primary/40 bg-surface'
                    : 'border-transparent bg-surface hover:border-gray-200'
              }`}
            >
              <span className="font-medium text-text">{day}</span>
              {count > 0 && (
                <span className="mt-auto rounded-full bg-secondary px-1.5 text-[10px] font-semibold text-white">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {selectedDay && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-text">
            {parseISODate(selectedDay).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
            })}
            {' · '}
            {selectedTasks.length} задач
          </p>
          {selectedTasks.length === 0 ? (
            <p className="text-sm text-muted">На этот день задач нет</p>
          ) : (
            <ul className="space-y-2">
              {selectedTasks.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(task)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-100 bg-surface px-3 py-2.5 text-left hover:border-gray-200"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-text">
                        {task.title}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {task.assignedToName}
                      </span>
                    </span>
                    <Badge variant={STATUS_BADGE[task.status]}>{TASK_STATUSES[task.status]}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
