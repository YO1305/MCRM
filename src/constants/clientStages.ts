/** KPI bucket for a CRM funnel stage (admin-configurable). */
export type StageKpiBucket = 'lead' | 'deal' | 'none'

/** How a closed/archive stage is classified */
export type StageCloseKind = 'none' | 'rejected' | 'failed' | 'abandoned'

export interface CrmStageOption {
  value: string
  label: string
  order: number
  active: boolean
  /** When client first reaches this stage → count as KPI lead */
  countsAsKpiLead: boolean
  /** Which KPI section this stage feeds (lead now; deal later) */
  kpiBucket: StageKpiBucket
  /**
   * Legacy: terminal refusal. Prefer closeKind / isFailed / isAbandoned.
   * Still treated as archived.
   */
  isRejected?: boolean
  /** Deal failed / lost */
  isFailed?: boolean
  /** Work stopped / abandoned */
  isAbandoned?: boolean
  builtin?: boolean
}

/** Fallback labels / order if Firestore empty. */
export const DEFAULT_CRM_STAGES: CrmStageOption[] = [
  {
    value: 'contact',
    label: 'Контакт',
    order: 10,
    active: true,
    countsAsKpiLead: false,
    kpiBucket: 'none',
    builtin: true,
  },
  {
    value: 'negotiation',
    label: 'Переговоры',
    order: 20,
    active: true,
    countsAsKpiLead: false,
    kpiBucket: 'none',
    builtin: true,
  },
  {
    value: 'proposal',
    label: 'КП отправлено',
    order: 30,
    active: true,
    countsAsKpiLead: false,
    kpiBucket: 'none',
    builtin: true,
  },
  {
    value: 'brief',
    label: 'ТЗ получено',
    order: 40,
    active: true,
    countsAsKpiLead: true,
    kpiBucket: 'lead',
    builtin: true,
  },
  {
    value: 'contract',
    label: 'Договор',
    order: 50,
    active: true,
    countsAsKpiLead: false,
    kpiBucket: 'none',
    builtin: true,
  },
  {
    value: 'deal',
    label: 'Сделка',
    order: 60,
    active: true,
    countsAsKpiLead: false,
    kpiBucket: 'deal',
    builtin: true,
  },
  {
    value: 'rejected',
    label: 'Отказ',
    order: 90,
    active: true,
    countsAsKpiLead: false,
    kpiBucket: 'none',
    isRejected: true,
    builtin: true,
  },
  {
    value: 'failed',
    label: 'Провалено',
    order: 91,
    active: true,
    countsAsKpiLead: false,
    kpiBucket: 'none',
    isFailed: true,
    builtin: true,
  },
  {
    value: 'abandoned',
    label: 'Заброшено',
    order: 92,
    active: true,
    countsAsKpiLead: false,
    kpiBucket: 'none',
    isAbandoned: true,
    builtin: true,
  },
]

/** @deprecated use useClientStages / getCrmStages — kept for fallbacks */
export const CLIENT_STAGES: Record<string, string> = Object.fromEntries(
  DEFAULT_CRM_STAGES.map((s) => [s.value, s.label]),
)

export type ClientStage = string

let liveStages: CrmStageOption[] | null = null

export function setLiveCrmStages(list: CrmStageOption[] | null) {
  liveStages = list
}

export function getCrmStages(): CrmStageOption[] {
  return liveStages && liveStages.length > 0 ? liveStages : DEFAULT_CRM_STAGES
}

export function stageLabel(value: string | null | undefined): string {
  if (!value) return '—'
  return getCrmStages().find((s) => s.value === value)?.label || CLIENT_STAGES[value] || value
}

export function stageCountsAsKpiLead(value: string | null | undefined): boolean {
  if (!value) return false
  return Boolean(getCrmStages().find((s) => s.value === value)?.countsAsKpiLead)
}

/** At least one active stage is marked as KPI lead trigger. */
export function leadKpiTrackingEnabled(): boolean {
  return getCrmStages().some((s) => s.active && s.countsAsKpiLead)
}

export function stageKpiBucket(value: string | null | undefined): StageKpiBucket {
  if (!value) return 'none'
  return getCrmStages().find((s) => s.value === value)?.kpiBucket || 'none'
}

/** Closed / archive outcomes — out of active funnel, kept in history. */
export function stageOptionIsClosed(s: CrmStageOption): boolean {
  return Boolean(s.isRejected || s.isFailed || s.isAbandoned)
}

export function stageIsClosed(value: string | null | undefined): boolean {
  if (!value) return false
  const s = getCrmStages().find((x) => x.value === value)
  if (s) return stageOptionIsClosed(s)
  return value === 'rejected' || value === 'failed' || value === 'abandoned'
}

export function stageCloseKind(value: string | null | undefined): StageCloseKind {
  if (!value) return 'none'
  const s = getCrmStages().find((x) => x.value === value)
  if (!s) {
    if (value === 'rejected') return 'rejected'
    if (value === 'failed') return 'failed'
    if (value === 'abandoned') return 'abandoned'
    return 'none'
  }
  if (s.isRejected) return 'rejected'
  if (s.isFailed) return 'failed'
  if (s.isAbandoned) return 'abandoned'
  return 'none'
}

/** Successful deal stage (won) — not “in work”, not archive. */
export function stageIsWon(value: string | null | undefined): boolean {
  if (!value) return false
  if (value === 'deal') return true
  return stageKpiBucket(value) === 'deal' && !stageIsClosed(value)
}

export function funnelStages(): CrmStageOption[] {
  return getCrmStages()
    .filter((s) => s.active && !stageOptionIsClosed(s))
    .sort((a, b) => a.order - b.order)
}

export function closedStages(): CrmStageOption[] {
  return getCrmStages()
    .filter((s) => s.active && stageOptionIsClosed(s))
    .sort((a, b) => a.order - b.order)
}

export function allPipelineStages(): CrmStageOption[] {
  return getCrmStages()
    .filter((s) => s.active)
    .sort((a, b) => a.order - b.order)
}

/** Ensure builtin archive stages exist even if Firestore list was saved earlier. */
export function mergeBuiltinClosedStages(stages: CrmStageOption[]): CrmStageOption[] {
  const builtins = DEFAULT_CRM_STAGES.filter(stageOptionIsClosed)
  const next = [...stages]
  for (const b of builtins) {
    if (!next.some((s) => s.value === b.value)) next.push({ ...b })
  }
  return next
}
