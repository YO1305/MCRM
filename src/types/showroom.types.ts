export interface ShowroomItem {
  id: string
  title: string
  sortOrder: number
  active: boolean
  createdBy: string
  createdAt?: unknown
  updatedAt?: unknown
}

/** One checklist check for a given day + item */
export interface ShowroomCheck {
  id: string
  date: string
  itemId: string
  itemTitle: string
  done: boolean
  doneBy: string | null
  doneByName: string | null
  note: string
  createdAt?: unknown
  updatedAt?: unknown
}

/**
 * Schedule: which weekdays require a walkthrough.
 * JS getDay(): 0=Sun … 6=Sat
 */
export interface ShowroomSettings {
  id: string
  /** e.g. [1, 3, 5] = Mon Wed Fri */
  weekdays: number[]
  timesPerWeek: number
  updatedBy?: string | null
  updatedAt?: unknown
}

export const WEEKDAY_OPTIONS: { value: number; label: string; short: string }[] = [
  { value: 1, label: 'Понедельник', short: 'Пн' },
  { value: 2, label: 'Вторник', short: 'Вт' },
  { value: 3, label: 'Среда', short: 'Ср' },
  { value: 4, label: 'Четверг', short: 'Чт' },
  { value: 5, label: 'Пятница', short: 'Пт' },
  { value: 6, label: 'Суббота', short: 'Сб' },
  { value: 0, label: 'Воскресенье', short: 'Вс' },
]

export const SCHEDULE_PRESETS: {
  id: string
  label: string
  weekdays: number[]
}[] = [
  { id: '2x', label: '2 раза в неделю (Пн, Чт)', weekdays: [1, 4] },
  { id: '3x', label: '3 раза в неделю (Пн, Ср, Пт)', weekdays: [1, 3, 5] },
  { id: '5x', label: 'Каждый будний день', weekdays: [1, 2, 3, 4, 5] },
  { id: '7x', label: 'Каждый день', weekdays: [0, 1, 2, 3, 4, 5, 6] },
]

export const DEFAULT_SHOWROOM_SETTINGS: Omit<ShowroomSettings, 'id'> = {
  weekdays: [1, 3, 5],
  timesPerWeek: 3,
  updatedBy: null,
}
