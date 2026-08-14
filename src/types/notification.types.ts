export type NotificationType =
  | 'task_assigned'
  | 'task_overdue'
  | 'task_awaiting_confirm'
  | 'task_confirmed'
  | 'deletion_request'
  | 'deletion_approved'
  | 'deletion_rejected'
  | 'showroom_done'
  | 'dev_confirm'
  | 'dev_confirmed'
  | 'dev_rejected'
  | 'dev_overdue'
  | 'smm_payment_reminder'
  | 'client_visit'

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  taskId?: string | null
  clientId?: string | null
  dedupeKey?: string | null
  link?: string | null
  read: boolean
  createdAt?: unknown
}
