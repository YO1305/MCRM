import type { Position } from '@/types/user.types'

/** App sections that can be gated by role/position. */
export type AppSection =
  | 'dashboard'
  | 'tasks'
  | 'reports'
  | 'crm'
  | 'contacts'
  | 'kpi'
  | 'design'
  | 'showroom'
  | 'labels'
  | 'smm'
  | 'smm_payments'
  | 'projects'
  | 'milestones'
  | 'analytics'
  | 'requests'
  | 'settings'

/**
 * Who sees what by default (должность).
 * - Admin (role=admin) always sees everything.
 * - If users.enabledSections is set — только отмеченные разделы (полный контроль админа).
 * - Иначе — по должности ниже.
 */
export const SECTION_ACCESS: Record<AppSection, Position[] | 'all' | 'admin'> = {
  dashboard: 'all',
  tasks: 'all',
  reports: 'all',
  settings: 'all',
  crm: ['leads_manager_1', 'leads_manager_2', 'operator', 'head'],
  contacts: ['leads_manager_1', 'leads_manager_2'],
  kpi: ['leads_manager_1', 'leads_manager_2', 'designer', 'dev_manager', 'operator', 'head'],
  design: ['designer', 'head'],
  showroom: ['leads_manager_2', 'head'],
  labels: ['leads_manager_1', 'leads_manager_2'],
  smm: ['leads_manager_1'],
  smm_payments: ['leads_manager_1'],
  projects: ['dev_manager', 'head'],
  milestones: ['dev_manager', 'head'],
  analytics: 'admin',
  requests: 'admin',
}

/** Все пункты меню — админ может включать/выключать каждый. */
export const CONFIGURABLE_SECTIONS: AppSection[] = [
  'dashboard',
  'tasks',
  'reports',
  'crm',
  'contacts',
  'kpi',
  'design',
  'showroom',
  'labels',
  'smm',
  'smm_payments',
  'projects',
  'milestones',
  'analytics',
  'requests',
  'settings',
]

export const SECTION_LABELS: Record<AppSection, string> = {
  dashboard: 'Дашборд',
  tasks: 'Задачи',
  reports: 'Отчёты',
  crm: 'CRM',
  contacts: 'База клиентов',
  kpi: 'KPI',
  design: 'Дизайн',
  showroom: 'Шоурум',
  labels: 'Печать бирок',
  smm: 'Контроль СММ',
  smm_payments: 'SMM оплата',
  projects: 'Проекты',
  milestones: 'Подзадачи',
  analytics: 'Аналитика',
  requests: 'Заявки',
  settings: 'Настройки',
}

export const SECTION_PATHS: Record<AppSection, string> = {
  dashboard: '/',
  tasks: '/tasks',
  reports: '/reports',
  crm: '/crm',
  contacts: '/contacts',
  kpi: '/kpi',
  design: '/design',
  showroom: '/showroom',
  labels: '/labels',
  smm: '/smm',
  smm_payments: '/smm-payments',
  projects: '/projects',
  milestones: '/subtasks',
  analytics: '/analytics',
  requests: '/requests',
  settings: '/settings',
}

/** @deprecated больше нет «всегда открытых» — админ решает сам */
export const ALWAYS_ON_SECTIONS: AppSection[] = []

export function canAccessSection(
  section: AppSection,
  opts: {
    isAdmin: boolean
    position?: Position | null
    enabledSections?: AppSection[] | null
  },
): boolean {
  if (opts.isAdmin) return true

  const custom = opts.enabledSections
  if (custom && Array.isArray(custom)) {
    return custom.includes(section)
  }

  const rule = SECTION_ACCESS[section]
  if (rule === 'admin') return false
  if (rule === 'all') return true
  if (!opts.position) return false
  return rule.includes(opts.position)
}

/** Default menu for a position (constructor / add employee). */
export function defaultConfigurableSections(position: Position): AppSection[] {
  return CONFIGURABLE_SECTIONS.filter((section) => {
    const rule = SECTION_ACCESS[section]
    if (rule === 'admin') return false
    if (rule === 'all') return true
    return rule.includes(position)
  })
}

/** First path the user may open (for redirects). */
export function firstAccessiblePath(opts: {
  isAdmin: boolean
  position?: Position | null
  enabledSections?: AppSection[] | null
}): string {
  if (opts.isAdmin) return '/'
  for (const section of CONFIGURABLE_SECTIONS) {
    if (canAccessSection(section, opts)) {
      return SECTION_PATHS[section]
    }
  }
  return '/login'
}

/** Head/admin can assign tasks to the team. Everyone can create a task for themselves. */
export function canAssignTasks(opts: { isAdmin: boolean; position?: Position | null }): boolean {
  return opts.isAdmin || opts.position === 'head'
}
