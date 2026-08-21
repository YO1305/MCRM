export type CatalogueType = 'general' | 'personal'
export type CatalogueCategory = 'fabric' | 'finished' | 'export' | 'other'

export const CATALOGUE_CATEGORY_LABELS: Record<CatalogueCategory, string> = {
  fabric: 'Ткань',
  finished: 'ГП',
  export: 'Экспорт',
  other: 'Другое',
}

export interface PriceRow {
  name: string
  article?: string
  composition?: string
  width?: string
  density?: string
  minVolume?: string
  unit?: string
  price?: string
  currency?: string
  notes?: string
}

export interface Catalogue {
  id: string
  type: CatalogueType
  title: string
  category: CatalogueCategory
  description?: string
  pdfUrl: string
  pdfFileName: string
  pdfUploadedAt?: unknown
  pdfUploadedBy: string
  excelUrl: string | null
  excelFileName: string | null
  excelUploadedAt?: unknown | null
  excelUploadedBy: string | null
  priceData: PriceRow[] | null
  slug: string
  publicUrl: string
  isActive: boolean
  viewCount: number
  clientId?: string | null
  clientName?: string | null
  createdBy: string
  createdByName?: string
  createdAt?: unknown
  updatedAt?: unknown
}

export interface CatalogueInput {
  type: CatalogueType
  title: string
  category: CatalogueCategory
  description?: string
  clientId?: string
  clientName?: string
  pdf: File
  excel?: File | null
  priceData?: PriceRow[] | null
}

export const CATALOGUE_MAX_FILE_BYTES = 80 * 1024 * 1024

export const CATALOGUE_SETTINGS_COLLECTION = 'catalogue_settings'
export const CATALOGUE_CONTACTS_DOC = 'contacts'

export interface CataloguePublicContacts {
  companyName: string
  phone: string
  whatsapp: string
  telegram: string
  instagram: string
  email: string
  website: string
  address: string
}

export const DEFAULT_CATALOGUE_CONTACTS: CataloguePublicContacts = {
  companyName: 'Bahmal Home',
  phone: '+998 62 224-44-44',
  whatsapp: '',
  telegram: '',
  instagram: '',
  email: '',
  website: 'https://bahmal.uz',
  address: '',
}

export const BAHMAL_PUBLIC_PHONE = DEFAULT_CATALOGUE_CONTACTS.phone
