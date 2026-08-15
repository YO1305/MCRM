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
  { key: 'draft_reply', label: AI_TASK_KIND_LABELS.draft_reply },
  { key: 'action', label: AI_TASK_KIND_LABELS.action },
]

/**
 * AI lead tasks block for CRM — reminders, tips, draft replies, actions.
 */
export function CrmAiTasksPanel() {
  const { pending, markDone, snooze, loading } = useAiTasks()
  const [kind, setKind] = useState<KindFilter>('all')

  const filtered = useMemo(() => {
    if (kind === 'all') return pending
    return pending.filter((t) => (t.kind || 'action') === kind)
  }, [pending, kind])

  if (loading || pending.length === 0) return null

  return (
    <section className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-text">
            <Brain className="h-4 w-4 text-violet-700" />
            Задачи по лидам · ИИ
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Напоминания, советы и действия по клиентам без запланированного следующего шага
          </p>
        </div>
        <Link to="/tasks" className="text-xs font-medium text-secondary hover:underline">
          Все задачи
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
                : 'bg-white text-muted shadow-sm hover:text-text'
            }`}
          >
            {f.label}
            {f.key === 'all'
              ? ` · ${pending.length}`
              : ` · ${pending.filter((t) => (t.kind || 'action') === f.key).length}`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">В этой категории пока пусто</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((task) => (
            <AiTaskCard
              key={task.id}
              task={task}
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
            />
          ))}
        </div>
      )}
    </section>
  )
}
