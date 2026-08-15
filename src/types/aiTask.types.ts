export type AiTaskType =
  | 'follow_up'
  | 'check_delivery'
  | 'send_reminder'
  | 'get_decision'
  | 'update_next_step'
  | 'reactivate'
  | 'close_or_drop'

export type AiTaskStatus = 'pending' | 'done' | 'snoozed'

export interface AiTask {
  id: string
  clientId: string
  clientName: string
  assignedTo: string
  assignedToName: string
  taskText: string
  taskType: AiTaskType
  status: AiTaskStatus
  generatedAt?: unknown
  doneAt?: unknown
  snoozedUntil?: string | null
  createdAt?: unknown
}

export const AI_TASK_TYPE_LABELS: Record<AiTaskType, string> = {
  follow_up: 'Контакт',
  check_delivery: 'Доставка',
  send_reminder: 'Напоминание',
  get_decision: 'Решение',
  update_next_step: 'След. шаг',
  reactivate: 'Реактивация',
  close_or_drop: 'Закрыть / отказать',
}
