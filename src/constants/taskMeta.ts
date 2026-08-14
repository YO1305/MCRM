import type { TaskPriority } from '@/types/task.types'
import type { TaskStatus } from '@/constants/taskStatuses'

export const TASK_PRIORITIES: Record<TaskPriority, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Важно',
}

export const STATUS_BADGE: Record<
  TaskStatus,
  'default' | 'success' | 'warning' | 'danger' | 'info'
> = {
  todo: 'default',
  in_progress: 'info',
  awaiting_confirm: 'warning',
  done: 'success',
  postponed: 'warning',
  blocked: 'danger',
}

export const PRIORITY_BADGE: Record<
  TaskPriority,
  'default' | 'success' | 'warning' | 'danger' | 'info'
> = {
  low: 'default',
  normal: 'info',
  high: 'danger',
}

export const KANBAN_COLUMNS: TaskStatus[] = [
  'todo',
  'in_progress',
  'awaiting_confirm',
  'postponed',
  'blocked',
  'done',
]
