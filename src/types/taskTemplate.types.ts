import type { TaskPriority } from '@/types/task.types'

export type TaskRecurrence =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'every_n_days'
  | 'every_n_months'

export interface TaskTemplate {
  id: string
  userId: string
  userName: string
  title: string
  description: string
  priority: TaskPriority
  recurrence: TaskRecurrence
  interval: number
  dueOffsetDays: number
  weekday?: number | null
  dayOfMonth?: number | null
  active: boolean
  lastGeneratedDate: string | null
  createdBy: string
  createdAt?: unknown
  updatedAt?: unknown
}

export interface TaskTemplateInput {
  userId: string
  userName: string
  title: string
  description?: string
  priority?: TaskPriority
  recurrence: TaskRecurrence
  interval?: number
  dueOffsetDays?: number
  weekday?: number | null
  dayOfMonth?: number | null
  active?: boolean
}
