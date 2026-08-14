export const TASK_STATUSES = {
  todo: 'Не начата',
  in_progress: 'В работе',
  awaiting_confirm: 'На проверке',
  done: 'Выполнена',
  postponed: 'Отложена',
  blocked: 'Блокер',
} as const

export type TaskStatus = keyof typeof TASK_STATUSES
