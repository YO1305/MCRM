/** Monthly SMM account metrics (Instagram and other networks). */

export type SmmPlatform = 'instagram' | 'telegram' | 'facebook' | 'youtube'

export const SMM_PLATFORM_LABELS: Record<SmmPlatform, string> = {
  instagram: 'Instagram',
  telegram: 'Telegram',
  facebook: 'Facebook',
  youtube: 'YouTube',
}

export type SmmMetricKey =
  | 'views'
  | 'reach'
  | 'subscribers'
  | 'newSubscribers'
  | 'interactions'

export const SMM_METRIC_LABELS: Record<SmmMetricKey, string> = {
  views: 'Просмотры',
  reach: 'Охват',
  subscribers: 'Подписчики',
  newSubscribers: 'Новые подписчики',
  interactions: 'Взаимодействия',
}

export const SMM_METRIC_KEYS: SmmMetricKey[] = [
  'views',
  'reach',
  'subscribers',
  'newSubscribers',
  'interactions',
]

export interface SmmMetricsReport {
  id: string
  teamId: string
  teamName: string
  platform: SmmPlatform
  /** YYYY-MM */
  monthKey: string
  views: number
  reach: number
  subscribers: number
  newSubscribers: number
  interactions: number
  note: string
  createdBy: string
  createdByName: string
  createdAt?: unknown
  updatedAt?: unknown
}

export function emptyMetricsValues(): Record<SmmMetricKey, number> {
  return {
    views: 0,
    reach: 0,
    subscribers: 0,
    newSubscribers: 0,
    interactions: 0,
  }
}

export function metricsDocId(teamId: string, platform: SmmPlatform, monthKey: string) {
  return `${teamId}_${platform}_${monthKey}`.replace(/[^a-zA-Z0-9:_-]/g, '_')
}
