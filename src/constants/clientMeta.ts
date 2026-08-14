import type { ClientStage } from '@/constants/clientStages'
import { stageCloseKind } from '@/constants/clientStages'
import type { LeadCategory } from '@/types/kpiLead.types'

export const CLIENT_SOURCES: Record<string, string> = {
  instagram: 'Instagram',
  telegram: 'Telegram',
  textile_finds: 'Платформа Textile Finds',
  exhibition: 'Выставка',
  call: 'Звонок',
  referral: 'Рекомендация',
  website: 'Сайт',
  showroom: 'Шоурум',
  other: 'Другое',
}

export const STAGE_BADGE: Record<
  string,
  'default' | 'success' | 'warning' | 'danger' | 'info'
> = {
  contact: 'default',
  negotiation: 'info',
  proposal: 'warning',
  brief: 'info',
  contract: 'warning',
  deal: 'success',
  rejected: 'danger',
  failed: 'danger',
  abandoned: 'warning',
}

export function stageBadge(
  stage: string,
): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  if (STAGE_BADGE[stage]) return STAGE_BADGE[stage]
  const close = stageCloseKind(stage)
  if (close === 'rejected' || close === 'failed') return 'danger'
  if (close === 'abandoned') return 'warning'
  return 'default'
}

/** @deprecated use funnelStages() from clientStages — kept for gradual migration */
export const FUNNEL_STAGES: ClientStage[] = [
  'contact',
  'negotiation',
  'proposal',
  'brief',
  'contract',
  'deal',
]

export const ALL_PIPELINE_STAGES: ClientStage[] = [...FUNNEL_STAGES, 'rejected']

export const LEAD_CATEGORIES: Record<LeadCategory, string> = {
  fabric: 'Ткань',
  finished: 'ГП',
  europe: 'Европа',
}

/**
 * @deprecated Use stageCountsAsKpiLead() — admin can mark any stage as KPI lead.
 * Kept as fallback default (ТЗ получено).
 */
export const KPI_LEAD_TRIGGER_STAGE: ClientStage = 'brief'
