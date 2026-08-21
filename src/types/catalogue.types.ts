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
}

export const BAHMAL_PUBLIC_PHONE = '+998 62 224-44-44'
