export type ContactStatus = string

/** contact = просто в базе; prospect = потенциал; partner = работает с нами */
export type ContactRelation = string

export interface Contact {
  id: string
  name: string
  phone: string
  phoneNormalized: string
  company: string
  email: string
  country: string | null
  notes: string
  source: string | null
  /** If source is exhibition (or custom with requiresExhibition) */
  exhibitionName?: string
  exhibitionDate?: string | null
  status: ContactStatus
  relation: ContactRelation
  /** Что покупает / ассортимент (для партнёров и клиентов) */
  buysWhat: string
  lastLeadId: string | null
  createdBy: string
  createdByName: string
  createdAt?: unknown
  updatedAt?: unknown
}

export interface ContactInput {
  name: string
  phone: string
  company?: string
  email?: string
  country?: string | null
  notes?: string
  source?: string | null
  exhibitionName?: string
  exhibitionDate?: string | null
  status?: ContactStatus
  relation?: ContactRelation
  buysWhat?: string
}

/** Fallback labels if option list not loaded */
export const CONTACT_STATUS_LABELS: Record<string, string> = {
  active: 'Актив',
  passive: 'Пассив',
}

export const CONTACT_RELATION_LABELS: Record<string, string> = {
  contact: 'Контакт',
  prospect: 'Потенциальный',
  partner: 'Партнёр',
}
