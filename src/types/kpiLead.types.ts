export type LeadCategory = 'fabric' | 'finished' | 'europe'

export interface KpiLeadLog {
  id: string
  clientId: string
  clientName: string
  assignedTo: string
  assignedToName: string
  /** Основная категория (для старых записей и отображения) */
  category: LeadCategory
  /** Все категории лида (europe ИЛИ fabric/finished) */
  categories?: LeadCategory[]
  country?: string | null
  month: string
  significantMoments?: number
  qualifiedAt?: unknown
  activeMonthsCount?: number
  source?: string
  fixedAt: unknown
  stage: string
}

export interface KpiLeadCounts {
  fabric: number
  finished: number
  europe: number
  total: number
}
