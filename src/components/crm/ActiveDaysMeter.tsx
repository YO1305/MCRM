import { activeDaysTone, formatMonthNominative } from '@/utils/groqLeadActivity'

interface ActiveDaysMeterProps {
  days?: number | null
  minDays: number
  month: string
  current?: boolean
  carried?: boolean
}

/** Visible to managers: how many active days this month vs the threshold. */
export function ActiveDaysMeter({ days, minDays, month, current, carried }: ActiveDaysMeterProps) {
  if (!current) return null
  if (carried && !(typeof days === 'number' && days > 0)) {
    return (
      <p className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800">
        Работа с прошлого месяца продолжается · в {formatMonthNominative(month)} новых записей пока нет
      </p>
    )
  }
  if (typeof days !== 'number') return null
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
