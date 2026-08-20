import { activeDaysTone, formatMonthNominative } from '@/utils/groqLeadActivity'

interface ActiveDaysMeterProps {
  days?: number | null
  minDays: number
  month: string
  current?: boolean
}

/** Visible to managers: how many active days this month vs the threshold. */
export function ActiveDaysMeter({ days, minDays, month, current }: ActiveDaysMeterProps) {
  if (!current || typeof days !== 'number') return null
  const tone = activeDaysTone(days, minDays)
  const color =
    tone === 'green' ? 'text-emerald-700 bg-emerald-50' : tone === 'amber' ? 'text-amber-800 bg-amber-50' : 'text-red-700 bg-red-50'
  const mark = tone === 'green' ? '🟢' : tone === 'amber' ? '🟡' : '🔴'
  return (
    <p className={`rounded-md px-2 py-1 text-[11px] font-medium ${color}`}>
      Активность · {formatMonthNominative(month)}: {days} из {minDays} дн. {mark}
    </p>
  )
}
