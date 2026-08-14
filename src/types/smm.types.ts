/** SMM control module for senior leads manager. */

export interface SmmTeam {
  id: string
  name: string
  /** Agency name for payments module */
  agency?: string
  instagram: string
  telegram: string
  facebook: string
  youtube: string
  contactName: string
  contactPhone: string
  contactNote: string
  sortOrder: number
  isActive?: boolean
  createdBy: string
  createdAt?: unknown
  updatedAt?: unknown
}

/** Content plan line for a team in a given month. */
export interface SmmContentItem {
  id: string
  teamId: string
  teamName: string
  /** YYYY-MM */
  monthKey: string
  /** e.g. Рилс, Пост, История, Рилс с брендфейсом */
  title: string
  planCount: number
  createdBy: string
  createdAt?: unknown
  updatedAt?: unknown
}

/** One publication / fact entry (can add several times until plan is met). */
export interface SmmContentFact {
  id: string
  contentItemId: string
  teamId: string
  monthKey: string
  publishedAt: string
  count: number
  note: string
  createdBy: string
  createdByName: string
  createdAt?: unknown
  updatedAt?: unknown
}

export const CONTENT_TYPE_PRESETS = [
  'Рилс',
  'Пост',
  'История',
  'Рилс с брендфейсом',
  'Карусель',
  'Сторис + репост',
] as const
