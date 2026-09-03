import { Badge } from '@/components/ui/Badge'

interface KpiBadgeProps {
  qualified?: boolean | null
  moments?: number | null
  reason?: string | null
  current?: boolean
}

/** Admin-only: whether this lead counts in KPI this month. */
export function KpiBadge({ qualified, moments, reason, current }: KpiBadgeProps) {
  if (!current || qualified == null) return null
  const n = typeof moments === 'number' ? moments : 0
  const momentsLabel = n >= 900 ? 'сделка' : `${n} момента`
  return (
    <span title={reason || undefined}>
      <Badge variant={qualified ? 'success' : 'default'}>
        {qualified ? `KPI лид · ${momentsLabel}` : `Не в KPI · ${n}`}
      </Badge>
    </span>
  )
}

interface KpiMomentsMeterProps {
  moments?: number | null
  minMoments?: number
  current?: boolean
}

/** Managers: progress toward N manager steps on the lead. */
export function KpiMomentsMeter({ moments, minMoments = 3, current }: KpiMomentsMeterProps) {
  if (!current) return null
  const n = typeof moments === 'number' ? moments : 0
  const shown = n >= 900 ? minMoments : n
  return (
    <p className="text-[11px] font-medium text-muted">
      Шагов по лиду: {shown} / {minMoments}
    </p>
  )
}
