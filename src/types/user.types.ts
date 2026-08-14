import type { AppSection } from '@/constants/access'

export type Role = 'admin' | 'employee'

export type Position =
  | 'head'
  | 'leads_manager_1'
  | 'leads_manager_2'
  | 'designer'
  | 'dev_manager'
  | 'assistant'
  | 'operator'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  position: Position
  avatar?: string
  isActive: boolean
  /** false = в команде без входа в CRM; true/undefined = есть логин */
  hasLogin?: boolean
  /** null/undefined = default by position; array = custom menu */
  enabledSections?: AppSection[] | null
  /** Inclusive YYYY-MM-DD: do not generate recurring tasks in this range (vacation etc.) */
  recurringTasksPausedFrom?: string | null
  recurringTasksPausedUntil?: string | null
  createdAt?: unknown
}
