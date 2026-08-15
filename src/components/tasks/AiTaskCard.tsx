import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { AiTask } from '@/types/aiTask.types'
import { AI_TASK_KIND_LABELS, AI_TASK_TYPE_LABELS } from '@/types/aiTask.types'
import { formatISODateShort, todayISO, toISODate } from '@/utils/dates'

interface AiTaskCardProps {
  task: AiTask
  onDone: (taskId: string) => void
  onSnooze: (taskId: string) => void
}

function generatedLabel(value: unknown): string {
  if (!value) return ''
  let d: Date | null = null
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      d = (value as { toDate: () => Date }).toDate()
    } catch {
      d = null
    }
  } else if (typeof value === 'object' && value !== null && 'seconds' in value) {
    d = new Date((value as { seconds: number }).seconds * 1000)
  }
  if (!d) return ''
  const iso = toISODate(d)
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  if (iso === todayISO()) return `Сегодня в ${time}`
  return `${formatISODateShort(iso)} · ${time}`
}

export function AiTaskCard({ task, onDone, onSnooze }: AiTaskCardProps) {
  return (
    <article className="rounded-xl border border-violet-100 bg-violet-50/40 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">ИИ</Badge>
        {task.kind && (
          <Badge variant="info">{AI_TASK_KIND_LABELS[task.kind] || task.kind}</Badge>
        )}
        <Badge variant="default">{AI_TASK_TYPE_LABELS[task.taskType] || task.taskType}</Badge>
        {task.generatedAt ? (
          <span className="text-xs text-muted">{generatedLabel(task.generatedAt)}</span>
        ) : null}
      </div>

      <Link
        to={`/crm?client=${task.clientId}`}
        className="mt-2 block text-sm font-semibold text-secondary hover:underline"
      >
        {task.clientName}
      </Link>

      <p className="mt-2 text-sm text-text">{task.taskText}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => void onDone(task.id)}>
          Выполнено
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => void onSnooze(task.id)}>
          Отложить на завтра
        </Button>
      </div>
    </article>
  )
}
