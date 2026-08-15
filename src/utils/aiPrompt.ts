import type { AiConfig } from '@/types/aiConfig.types'

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

  return template
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
}
