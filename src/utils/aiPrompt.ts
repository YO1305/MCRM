import type { AiConfig } from '@/types/aiConfig.types'
import { AI_HARD_RULES_APPENDIX } from '@/types/aiConfig.types'
import type { AiTaskKind, AiTaskType } from '@/types/aiTask.types'

export interface LeadPromptSnapshot {
  clientName: string
  company: string
  category: string
  stage: string
  waitStatus: string | null
  nextStep: string | null
  nextStepDeadline: string | null
  daysSinceTouch: number
  daysSinceMovement: number
  activeMonthsCount: number
  recentHistory: { type: string; text: string; authorName: string; date: string }[]
}

export function buildPromptFromTemplate(
  template: string,
  lead: LeadPromptSnapshot,
  config: Pick<AiConfig, 'maxActiveMonths'>,
): string {
  const historyText =
    lead.recentHistory.length > 0
      ? lead.recentHistory
          .map((h) => `- ${h.date} [${h.type}] ${h.authorName}: ${h.text}`)
          .join('\n')
      : '- История пуста'

  const filled = template
    .replaceAll('{clientName}', lead.clientName)
    .replaceAll('{company}', lead.company || 'не указана')
    .replaceAll('{category}', lead.category || 'не указана')
    .replaceAll('{stage}', lead.stage)
    .replaceAll('{waitStatus}', lead.waitStatus || 'не указан')
    .replaceAll('{nextStep}', lead.nextStep || 'не указан')
    .replaceAll('{nextStepDeadline}', lead.nextStepDeadline || 'не указан')
    .replaceAll('{daysSinceTouch}', String(lead.daysSinceTouch))
    .replaceAll('{daysSinceMovement}', String(lead.daysSinceMovement))
    .replaceAll('{activeMonthsCount}', String(lead.activeMonthsCount))
    .replaceAll('{maxActiveMonths}', String(config.maxActiveMonths))
    .replaceAll('{recentHistory}', historyText)

  return `${filled}${AI_HARD_RULES_APPENDIX}`
}

export function detectAiTaskType(
  taskText: string,
  lead: Pick<LeadPromptSnapshot, 'activeMonthsCount' | 'daysSinceTouch' | 'nextStep' | 'nextStepDeadline' | 'waitStatus'>,
): AiTaskType {
  const text = String(taskText || '').toLowerCase()
  if (lead.waitStatus) return 'wait_advice'
  if (text.includes('трек') || text.includes('посылк') || text.includes('почт')) {
    return 'check_delivery'
  }
  if (text.includes('коммерческ') || text.includes('кп') || text.includes('прайс')) {
    return 'send_reminder'
  }
  if (text.includes('решени') || text.includes('готов') || text.includes('подтверд')) {
    return 'get_decision'
  }
  if (lead.activeMonthsCount >= 3) return 'close_or_drop'
  if (lead.daysSinceTouch > 20) return 'reactivate'
  if (!lead.nextStep || !lead.nextStepDeadline) return 'update_next_step'
  return 'follow_up'
}

export function detectAiTaskKind(
  taskText: string,
  taskType: AiTaskType,
  lead: Pick<LeadPromptSnapshot, 'waitStatus'>,
): AiTaskKind {
  const text = String(taskText || '').toLowerCase()
  if (
    text.includes('напиши клиенту') ||
    text.includes('текст сообщения') ||
    text.includes('черновик') ||
    text.includes('ответ клиенту')
  ) {
    return 'draft_reply'
  }
  if (lead.waitStatus || taskType === 'wait_advice' || text.includes('совет')) {
    return 'tip'
  }
  if (
    taskType === 'send_reminder' ||
    taskType === 'reactivate' ||
    text.includes('напомн')
  ) {
    return 'reminder'
  }
  return 'action'
}
