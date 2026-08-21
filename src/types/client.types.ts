import type { ClientStage } from '@/constants/clientStages'
import type { LeadCategory } from '@/types/kpiLead.types'

/** Free-form; options live in app_option_lists/client_source */
export type ClientSource = string

/** Интерес к продукции: ткань и/или ГП */
export type ProductKind = 'fabric' | 'finished'

export type ActivityStatus = 'new' | 'active' | 'critical' | 'frozen'

export type ClientHistoryType =
  | 'created'
  | 'stage_change'
  | 'note'
  | 'call'
  | 'sales_note'
  | 'sales_assigned'
  | 'wait_status'
  | 'next_step'
  | 'samples_sent'
  | 'visit'

/** One sample / product line in a shipment */
export interface SampleItem {
  name: string
  params: string
}

export interface SamplesShipmentInput {
  sentDate: string
  items: SampleItem[]
  note?: string
}

export interface Client {
  id: string
  name: string
  phone: string
  company: string
  email: string
  stage: ClientStage
  source: ClientSource
  exhibitionName?: string
  exhibitionDate?: string | null
  notes: string
  assignedTo: string
  assignedToName: string
  createdBy: string
  createdByName: string
  nextContactDate: string | null
  dealAmount: number | null
  country: string | null
  products: ProductKind[]
  fabricTypes: string[]
  gpTypes: string[]
  category: LeadCategory | null
  categories: LeadCategory[]
  /** @deprecated No new writes. Old documents may still have this. */
  kpiLeadCounted?: boolean
  kpiLeadMonth?: string | null
  /** Отдел продаж: fabric | finished | export | dept id / type */
  salesDepartment: string | null
  salesManagerId: string | null
  salesManagerName: string | null
  waitStatus: string | null
  /** When manager plans to write the client again while waiting for a reply */
  waitFollowUpDate: string | null
  nextStep: string | null
  nextStepDeadline: string | null
  /** Planned factory / office visit */
  visitDate?: string | null
  visitNote?: string | null
  /** Link to contacts base */
  contactId?: string | null
  /** Last samples shipment (for managers) */
  lastSamplesSentAt?: string | null
  lastSamplesCount?: number | null
  lastTouchDate?: string | null
  lastStageChangeDate?: string | null
  /** Real start of work with lead YYYY-MM-DD (calendar). Preferred over openedMonth. */
  openedDate?: string | null
  /** YYYY-MM — derived from openedDate when set */
  openedMonth?: string | null
  activityStatus?: ActivityStatus
  activeMonthsCount?: number
  /** Groq monthly activity (active/passive/paused) */
  activityScore?: number | null
  activityLabel?: 'active' | 'passive' | 'paused' | null
  activityMonth?: string | null
  activityAnalyzedAt?: unknown
  activityReason?: string | null
  activeDaysThisMonth?: number | null
  /** Groq KPI qualification for the current month */
  kpiQualified?: boolean | null
  kpiQualifiedMonth?: string | null
  kpiSignificantMoments?: number | null
  kpiQualificationReason?: string | null
  kpiQualifiedAt?: unknown
  createdAt: unknown
  updatedAt: unknown
}

export interface ClientInput {
  name: string
  phone: string
  company?: string
  email?: string
  stage?: ClientStage
  source?: ClientSource
  exhibitionName?: string
  exhibitionDate?: string | null
  notes?: string
  nextContactDate?: string | null
  dealAmount?: number | null
  country: string
  products: ProductKind[]
  fabricTypes?: string[]
  gpTypes?: string[]
}

export interface ClientHistoryEntry {
  id: string
  clientId: string
  type: ClientHistoryType
  text: string
  fromStage?: ClientStage | null
  toStage?: ClientStage | null
  authorId: string
  authorName: string
  /** For type samples_sent */
  sentDate?: string | null
  sampleItems?: SampleItem[]
  createdAt?: unknown
}
