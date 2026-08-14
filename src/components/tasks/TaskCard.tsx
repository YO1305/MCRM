import { Check, Pause, Play, AlertTriangle, RotateCcw, Link2, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { Task } from '@/types/task.types'
import { TASK_STATUSES, type TaskStatus } from '@/constants/taskStatuses'
import { PRIORITY_BADGE, STATUS_BADGE, TASK_PRIORITIES } from '@/constants/taskMeta'

interface TaskCardProps {
  task: Task
  showAssignee?: boolean
  viewerId?: string | null
  canConfirmTasks?: boolean
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onOpen: (task: Task) => void
}

function formatDue(dueDate: string | null) {
  if (!dueDate) return null
  const today = new Date().toISOString().slice(0, 10)
  if (dueDate === today) return { label: 'Сегодня', overdue: false }
  if (dueDate < today) return { label: `Просрок · ${dueDate}`, overdue: true }
  return { label: dueDate, overdue: false }
}

export function TaskCard({
  task,
  viewerId,
  canConfirmTasks,
  onStatusChange,
  onOpen,
}: TaskCardProps) {
  const due = formatDue(task.dueDate)
  const canConfirm =
    Boolean(canConfirmTasks) || (viewerId != null && viewerId === task.createdBy)

  const actions: {
    status: TaskStatus
    label: string
    icon: typeof Play
    variant: 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger'
  }[] = []

  if (task.status === 'awaiting_confirm') {
    if (canConfirm) {
      actions.push({
        status: 'done',
        label: 'Подтвердить',
        icon: ShieldCheck,
        variant: 'primary',
      })
      actions.push({
        status: 'in_progress',
        label: 'Вернуть',
        icon: RotateCcw,
        variant: 'ghost',
      })
    }
  } else {
    if (task.status === 'todo' || task.status === 'postponed' || task.status === 'blocked') {
      actions.push({ status: 'in_progress', label: 'В работу', icon: Play, variant: 'secondary' })
    }
    if (task.status !== 'done') {
      actions.push({ status: 'done', label: 'Готово', icon: Check, variant: 'primary' })
    }
    if (task.status === 'todo' || task.status === 'in_progress') {
      actions.push({ status: 'postponed', label: 'Отложить', icon: Pause, variant: 'ghost' })
    }
    if (task.status === 'in_progress') {
      actions.push({ status: 'blocked', label: 'Блокер', icon: AlertTriangle, variant: 'danger' })
    }
    if (task.status === 'done') {
      actions.push({ status: 'todo', label: 'Вернуть', icon: RotateCcw, variant: 'ghost' })
    }
  }

  return (
    <article
      className={`rounded-xl border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md ${
        due?.overdue && task.status !== 'done' && task.status !== 'awaiting_confirm'
          ? 'border-danger/40'
          : task.status === 'awaiting_confirm'
            ? 'border-amber-300'
            : 'border-gray-100'
      }`}
    >
      <button type="button" onClick={() => onOpen(task)} className="w-full text-left">
        <div className="flex flex-wrap items-start gap-2">
          <h3 className="flex-1 text-sm font-semibold text-text">{task.title}</h3>
          <Badge variant={STATUS_BADGE[task.status]}>{TASK_STATUSES[task.status]}</Badge>
        </div>

        {task.description && (
          <p className="mt-2 line-clamp-2 text-xs text-muted">{task.description}</p>
        )}

        {task.status === 'awaiting_confirm' && (
          <p className="mt-2 text-xs font-medium text-amber-700">
            {canConfirm
              ? 'Сотрудник отметил готово — подтвердите выполнение'
              : 'Отправлено на проверку постановщику'}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">
            {task.assignedToName}
          </span>
          <Badge variant={PRIORITY_BADGE[task.priority]}>
            {TASK_PRIORITIES[task.priority]}
          </Badge>
          {task.startDate && <span>с {task.startDate}</span>}
          {due && (
            <span className={due.overdue ? 'font-medium text-danger' : ''}>
              до {due.label}
            </span>
          )}
          {task.sourceTemplateId && <Badge variant="info">По шаблону</Badge>}
          {(task.links?.length ?? 0) + (task.attachments?.length ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              {(task.links?.length ?? 0) + (task.attachments?.length ?? 0)}
            </span>
          )}
        </div>
      </button>

      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Button
              key={action.status + action.label}
              type="button"
              size="sm"
              variant={action.variant}
              onClick={() => onStatusChange(task.id, action.status)}
            >
              <Icon className="h-3.5 w-3.5" />
              {action.label}
            </Button>
          )
        })}
      </div>
    </article>
  )
}
