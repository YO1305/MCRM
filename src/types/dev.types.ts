export type ProjectStatus = 'active' | 'paused' | 'done'

export interface DevProject {
  id: string
  title: string
  description: string
  status: ProjectStatus
  /** Overall project deadline */
  dueDate: string | null
  startDate: string | null
  /** Default assignee — manager by development */
  assigneeId: string | null
  assigneeName: string | null
  createdBy: string
  createdByName: string
  createdAt?: unknown
  updatedAt?: unknown
}

export type SubtaskStatus =
  | 'todo'
  | 'in_progress'
  | 'pending_confirm'
  | 'done'
  | 'rejected'

export interface DevSubtask {
  id: string
  projectId: string
  projectTitle: string
  title: string
  description: string
  status: SubtaskStatus
  /** Bucket month YYYY-MM — shows in that month's work list */
  monthKey: string
  dueDate: string | null
  assignedTo: string
  assignedToName: string
  createdBy: string
  createdByName: string
  /** From monthly template */
  sourceTemplateId?: string | null
  generatedForMonth?: string | null
  /** Carried from previous month when overdue */
  carriedFromMonth?: string | null
  confirmedBy?: string | null
  confirmedByName?: string | null
  confirmNote?: string | null
  completedAt?: unknown | null
  createdAt?: unknown
  updatedAt?: unknown
}

export interface DevSubtaskComment {
  id: string
  text: string
  authorId: string
  authorName: string
  createdAt?: unknown
}

/** Monthly repeating subtask template (and/or tied to a project). */
export interface DevTemplate {
  id: string
  title: string
  description: string
  projectId: string | null
  projectTitle: string | null
  assignedTo: string
  assignedToName: string
  /** Due day of month 1–28 */
  dayOfMonth: number
  active: boolean
  lastGeneratedMonth: string | null
  createdBy: string
  createdAt?: unknown
  updatedAt?: unknown
}

export const SUBTASK_STATUS_LABELS: Record<SubtaskStatus, string> = {
  todo: 'К работе',
  in_progress: 'В работе',
  pending_confirm: 'На подтверждении',
  done: 'Выполнено',
  rejected: 'Отклонено',
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Активен',
  paused: 'Пауза',
  done: 'Завершён',
}
