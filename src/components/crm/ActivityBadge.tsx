import { Badge } from '@/components/ui/Badge'
import type { ActivityStatus } from '@/types/client.types'

const VARIANT: Record<ActivityStatus, 'info' | 'success' | 'warning' | 'default'> = {
  new: 'info',
  active: 'success',
  critical: 'warning',
  frozen: 'default',
}

function label(status: ActivityStatus, months: number): string {
  const monthLabel = status === 'frozen' && months >= 4 ? '4+' : String(months || 1)
  if (status === 'new') return `Новый · мес. ${monthLabel}`
  if (status === 'active') return `Активный · мес. ${monthLabel}`
  if (status === 'critical') return `Требует внимания · мес. ${monthLabel}`
  return `Заморожен · мес. ${monthLabel}`
}

interface ActivityBadgeProps {
  status?: ActivityStatus | null
  months?: number | null
}

export function ActivityBadge({ status, months }: ActivityBadgeProps) {
  if (!status) return null
  return <Badge variant={VARIANT[status]}>{label(status, months || 1)}</Badge>
}
