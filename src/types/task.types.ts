import type { TaskStatus } from '@/constants/taskStatuses'

export type TaskPriority = 'low' | 'normal' | 'high'

export interface TaskAttachment {
  name: string
  url: string
  size: number
  contentType: string
  path: string
}

export interface TaskLink {
  label: string
  url: string
}

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignedTo: string
  assignedToName: string
  createdBy: string
  createdByName: string
  startDate: string | null
  dueDate: string | null
  attachments: TaskAttachment[]
  links: TaskLink[]
  sourceTemplateId?: string | null
  generatedForDate?: string | null
  /** When assignee submitted for creator confirmation */
  submittedAt?: unknown | null
  confirmedBy?: string | null
  confirmedAt?: unknown | null
  createdAt: unknown
  updatedAt: unknown
  completedAt: unknown | null
}

export interface TaskInput {
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assignedTo: string
  assignedToName: string
  startDate?: string | null
  dueDate?: string | null
  attachments?: TaskAttachment[]
  links?: TaskLink[]
}
