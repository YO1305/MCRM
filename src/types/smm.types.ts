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

export type SmmContentFormat = 'video' | 'post' | 'stories' | 'other'

export const SMM_CONTENT_FORMATS: { id: SmmContentFormat; label: string }[] = [
  { id: 'video', label: 'Видео' },
  { id: 'post', label: 'Пост' },
  { id: 'stories', label: 'Сторис' },
  { id: 'other', label: 'Иное' },
]

export function smmFormatLabel(format?: string | null, otherLabel?: string | null): string {
  if (format === 'other' && otherLabel?.trim()) return otherLabel.trim()
  return SMM_CONTENT_FORMATS.find((f) => f.id === format)?.label || format || 'Контент'
}

/** One planned publication for a team in a given month. */
export interface SmmContentItem {
  id: string
  teamId: string
  teamName: string
  /** YYYY-MM */
  monthKey: string
  format: SmmContentFormat
  /** If format is other */
  formatOther?: string
  title: string
  description: string
  /** Planned publish date YYYY-MM-DD */
  plannedDate: string
  /** Actual publish date YYYY-MM-DD — empty until done */
  publishedAt: string | null
  createdBy: string
  createdAt?: unknown
  updatedAt?: unknown
  /** @deprecated old “N pieces / month” rows */
  planCount?: number
}

/** @deprecated kept for old rows that used “план шт + факты”. */
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

export function inferSmmFormat(title: string): { format: SmmContentFormat; formatOther?: string } {
  const t = title.toLowerCase()
  if (t.includes('сторис') || t.includes('истори')) return { format: 'stories' }
  if (t.includes('рилс') || t.includes('видео') || t.includes('reels')) return { format: 'video' }
  if (t.includes('пост') || t.includes('карусел')) return { format: 'post' }
  return { format: 'other', formatOther: title.trim() || undefined }
}

export function isSmmItemDone(item: SmmContentItem, factCount = 0): boolean {
  if (item.publishedAt && /^\d{4}-\d{2}-\d{2}$/.test(item.publishedAt)) return true
  return factCount > 0
}
