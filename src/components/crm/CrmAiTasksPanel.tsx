import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Brain } from 'lucide-react'
import { useAiTasks } from '@/hooks/useAiTasks'
import { AiTaskCard } from '@/components/tasks/AiTaskCard'
import type { AiTaskKind } from '@/types/aiTask.types'
import { AI_TASK_KIND_LABELS } from '@/types/aiTask.types'

type KindFilter = 'all' | AiTaskKind

const FILTERS: { key: KindFilter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'reminder', label: AI_TASK_KIND_LABELS.reminder },
  { key: 'tip', label: AI_TASK_KIND_LABELS.tip },
  { key: 'action', label: AI_TASK_KIND_LABELS.action },
]

interface CrmAiTasksPanelProps {
  /** Open lead card inside CRM without leaving the page */
  onOpenClient?: (clientId: string) => void
}

/**
 * Full CRM section: AI tips / reminders / actions by lead.
 */
export function CrmAiTasksPanel({ onOpenClient }: CrmAiTasksPanelProps) {
  const { pending, pendingCount, markDone, snooze, removeTask, loading } = useAiTasks()
  const [kind, setKind] = useState<KindFilter>('all')

  const filtered = useMemo(() => {
    if (kind === 'all') return pending
    return pending.filter((t) => (t.kind || 'action') === kind)
  }, [pending, kind])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text">
            <Brain className="h-5 w-5 text-violet-700" />
            ИИ помощник по лидам
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Напоминания, советы и действия. Воронка при этом отдельным разделом — здесь только ИИ.
          </p>
        </div>
        <Link to="/tasks" className="text-xs font-medium text-secondary hover:underline">
          Обычные задачи
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setKind(f.key)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              kind === f.key
                ? 'bg-violet-700 text-white'
                : 'bg-surface text-muted shadow-sm hover:text-text'
            }`}
          >
            {f.label}
            {f.key === 'all'
              ? ` · ${pendingCount}`
              : ` · ${pending.filter((t) => (t.kind || 'action') === f.key).length}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/30 px-4 py-12 text-center">
          <p className="text-sm font-medium text-text">Пока нет советов от ИИ</p>
          <p className="mt-1 text-xs text-muted">
            Когда появятся задачи по лидам без следующего шага — они отобразятся здесь.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted">В этой категории пока пусто</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((task) => (
            <AiTaskCard
              key={task.id}
              task={task}
              onOpenClient={onOpenClient}
              onDone={(id) => {
                void markDone(id).catch((err) => {
                  console.error(err)
                  alert('Не удалось отметить задачу')
                })
              }}
              onSnooze={(id) => {
                void snooze(id).catch((err) => {
                  console.error(err)
                  alert('Не удалось отложить задачу')
                })
              }}
              onDelete={(id) => {
                void removeTask(id).catch((err) => {
                  console.error(err)
                  alert('Не удалось удалить задачу')
                })
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}
