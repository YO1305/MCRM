import type { TaskTemplate } from '@/types/taskTemplate.types'
import type { User } from '@/types/user.types'
import { addDaysISO, daysBetween, monthsBetween, parseISODate, todayISO } from '@/utils/dates'

type PauseFields = Pick<User, 'recurringTasksPausedFrom' | 'recurringTasksPausedUntil'>

/** Employee is on vacation / pause: no recurring tasks for `dateISO`. */
export function isRecurringTasksPaused(
  user: PauseFields | null | undefined,
  dateISO: string = todayISO(),
): boolean {
  const until = user?.recurringTasksPausedUntil
  if (!until) return false
  const from = user?.recurringTasksPausedFrom || until
  return dateISO >= from && dateISO <= until
}

/** Whether a template should generate a task for `dateISO` (default today). */
export function shouldGenerateTemplate(
  template: TaskTemplate,
  dateISO: string = todayISO(),
): boolean {
  if (!template.active) return false
  if (template.lastGeneratedDate === dateISO) return false

  const date = parseISODate(dateISO)

  switch (template.recurrence) {
    case 'daily':
      return true
    case 'weekly': {
      const weekday = template.weekday ?? 1 // Mon
      // JS: 0=Sun … 6=Sat → convert to Mon=1 … Sun=7 style if needed
      // Store weekday as JS getDay(): 0 Sun … 6 Sat
      return date.getDay() === weekday
    }
    case 'monthly': {
      const day = template.dayOfMonth ?? 1
      return date.getDate() === day
    }
    case 'every_n_days': {
      const interval = Math.max(1, template.interval || 1)
      if (!template.lastGeneratedDate) return true
      return daysBetween(template.lastGeneratedDate, dateISO) >= interval
    }
    case 'every_n_months': {
      const interval = Math.max(1, template.interval || 1)
      if (!template.lastGeneratedDate) return true
      return monthsBetween(template.lastGeneratedDate, dateISO) >= interval
    }
    default:
      return false
  }
}

export function dueDateForTemplate(template: TaskTemplate, startISO: string = todayISO()): string {
  return addDaysISO(startISO, Math.max(0, template.dueOffsetDays || 0))
}

export const RECURRENCE_LABELS: Record<TaskTemplate['recurrence'], string> = {
  daily: 'Каждый день',
  weekly: 'Каждую неделю',
  monthly: 'Каждый месяц',
  every_n_days: 'Раз в N дней',
  every_n_months: 'Раз в N месяцев',
}
