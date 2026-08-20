export type AiTaskType =
  | 'follow_up'
  | 'check_delivery'
  | 'send_reminder'
  | 'get_decision'
  | 'update_next_step'
  | 'reactivate'
  | 'close_or_drop'
  | 'wait_advice'

/** How the task is shown in CRM «Задачи по лидам» */
export type AiTaskKind = 'reminder' | 'tip' | 'draft_reply' | 'action'

export type AiTaskStatus = 'pending' | 'done' | 'snoozed'

export interface AiTask {
  id: string
  clientId: string
  clientName: string
  assignedTo: string
  assignedToName: string
  taskText: string
  taskType: AiTaskType
  kind?: AiTaskKind
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
  wait_advice: 'На паузе',
}

export const AI_TASK_KIND_LABELS: Record<AiTaskKind, string> = {
  reminder: 'Напоминание',
  tip: 'Совет',
  draft_reply: 'Черновик ответа',
  action: 'Действие',
}

import { resolveLastTouchDate } from '@/utils/dateUtils'

/** Manager already planned work — do not generate AI tasks for this lead. */
export function clientHasPlannedNextStep(client: {
  nextStep?: string | null
}): boolean {
  return Boolean(client.nextStep?.trim())
}

/**
 * Skip AI while waiting for the client until the manager's follow-up day
 * (or a grace period if the date was not set).
 */
export function clientShouldSkipAiWhileWaiting(
  client: {
    waitStatus?: string | null
    waitFollowUpDate?: string | null
    lastTouchDate?: string | null
  },
  today: string,
  graceDays = 5,
): boolean {
  if (!client.waitStatus?.trim()) return false
  if (client.waitFollowUpDate) {
    return client.waitFollowUpDate > today
  }
  if (!client.lastTouchDate) {
    const resolved = resolveLastTouchDate(client)
    if (!resolved) return true
    const from = new Date(`${resolved}T00:00:00`)
    const to = new Date(`${today}T00:00:00`)
    const days = Math.round((to.getTime() - from.getTime()) / 86400000)
    return days < graceDays
  }
  const from = new Date(`${client.lastTouchDate}T00:00:00`)
  const to = new Date(`${today}T00:00:00`)
  const days = Math.round((to.getTime() - from.getTime()) / 86400000)
  return days < graceDays
}
