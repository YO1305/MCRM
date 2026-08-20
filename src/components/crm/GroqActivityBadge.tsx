import { Badge } from '@/components/ui/Badge'
import type { GroqActivityLabel } from '@/types/aiActivity.types'
import { GROQ_ACTIVITY_LABELS } from '@/types/aiActivity.types'

const VARIANT: Record<GroqActivityLabel, 'success' | 'warning' | 'default'> = {
  active: 'success',
  passive: 'warning',
  paused: 'default',
}

interface GroqActivityBadgeProps {
  label?: GroqActivityLabel | null
  days?: number | null
  reason?: string | null
  current?: boolean
}

/** Admin-only Groq monthly activity (active / passive / paused). */
export function GroqActivityBadge({ label, days, reason, current }: GroqActivityBadgeProps) {
  if (!label || !current) return null
  const daysPart = typeof days === 'number' ? ` · ${days} дн.` : ''
  return (
    <span title={reason || undefined}>
      <Badge variant={VARIANT[label]}>
        {GROQ_ACTIVITY_LABELS[label]}
        {daysPart}
      </Badge>
    </span>
  )
}
