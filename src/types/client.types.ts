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
  kpiLeadCounted: boolean
  kpiLeadMonth: string | null
  /** Отдел продаж: fabric | finished | export | dept id / type */
  salesDepartment: string | null
  salesManagerId: string | null
  salesManagerName: string | null
  waitStatus: string | null
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
  openedMonth?: string | null
  activityStatus?: ActivityStatus
  activeMonthsCount?: number
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
