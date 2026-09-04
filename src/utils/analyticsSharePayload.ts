import type { Client } from '@/types/client.types'
import {
  activityLabelRu,
  buildCrmAnalytics,
  resolveLeadActivity,
  type EmployeeTaskStats,
} from '@/utils/analytics'
import { stageLabel } from '@/constants/clientStages'

export type AnalyticsShareTab = 'crm' | 'tasks'

export interface SlimShareClient {
  name: string
  activity: string
  stage: string
  manager: string
  sales: string
  products: string
  amount: number
}

export interface AnalyticsSharePayload {
  tab: AnalyticsShareTab
  month: string
  monthLabel: string
  createdByName: string
  crm?: {
    total: number
    activeTotal: number
    passiveTotal: number
    pausedTotal: number
    unlabeledTotal: number
    transferred: number
    withAmount: number
    totalSum: number
    stageRows: { label: string; count: number; active: number; passive: number; paused: number; unlabeled: number; sum: number }[]
    leadRows: { label: string; count: number; active: number; passive: number; paused: number; unlabeled: number; sum: number }[]
    salesRows: { label: string; count: number; active: number; passive: number; paused: number; unlabeled: number; sum: number }[]
    productRows: { label: string; count: number; active: number; passive: number; paused: number; unlabeled: number; sum: number }[]
    categoryRows: { label: string; count: number; active: number; passive: number; paused: number; unlabeled: number; sum: number }[]
    fabricRows: { label: string; count: number; active: number; passive: number; sum: number }[]
    gpRows: { label: string; count: number; active: number; passive: number; sum: number }[]
    sourceRows: { label: string; count: number; active: number; passive: number; sum: number }[]
    countryRows: { label: string; count: number; active: number; passive: number; sum: number }[]
    clients: SlimShareClient[]
  }
  tasks?: {
    totals: { total: number; done: number; open: number; overdue: number }
    employees: {
      name: string
      total: number
      done: number
      pct: number
      open: number
      overdue: number
      daily: string
      weekly: string
      monthly: string
    }[]
  }
}

function pickCs(r: {
  label?: string
  name?: string
  count: number
  active: number
  passive: number
  paused: number
  unlabeled: number
  sum: number
}) {
  return {
    label: r.label || r.name || '',
    count: r.count,
    active: r.active,
    passive: r.passive,
    paused: r.paused,
    unlabeled: r.unlabeled,
    sum: r.sum,
  }
}

export function monthTitle(month: string): string {
  if (month === 'all') return 'Все время'
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  return new Date(y, m - 1, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

export function buildCrmSharePayload(
  clients: Client[],
  month: string,
  createdByName: string,
): AnalyticsSharePayload {
  const crm = buildCrmAnalytics(clients, month)
  const activityMonth = crm.activityMonth
  const slim: SlimShareClient[] = clients.slice(0, 800).map((c) => ({
    name: c.name || '—',
    activity: activityLabelRu(resolveLeadActivity(c, activityMonth)),
    stage: stageLabel(c.stage),
    manager: c.assignedToName || '—',
    sales: c.salesManagerName || '—',
    products:
      (c.products || []).map((p) => (p === 'fabric' ? 'Ткань' : 'ГП')).join(', ') || '—',
    amount: Number(c.dealAmount) || 0,
  }))
  return {
    tab: 'crm',
    month,
    monthLabel: monthTitle(month === 'all' ? 'all' : activityMonth),
    createdByName,
    crm: {
      total: crm.total,
      activeTotal: crm.activeTotal,
      passiveTotal: crm.passiveTotal,
      pausedTotal: crm.pausedTotal,
      unlabeledTotal: crm.unlabeledTotal,
      transferred: crm.transferred,
      withAmount: crm.withAmount,
      totalSum: crm.totalSum,
      stageRows: crm.stageRows.map(pickCs),
      leadRows: crm.leadRows.map((r) => pickCs({ ...r, label: r.name })),
      salesRows: crm.salesRows.map((r) => pickCs({ ...r, label: r.name })),
      productRows: crm.productRows.map(pickCs),
      categoryRows: crm.categoryRows.map(pickCs),
      fabricRows: crm.fabricRows.map((r) => ({
        label: r.label,
        count: r.count,
        active: r.active,
        passive: r.passive,
        sum: r.sum,
      })),
      gpRows: crm.gpRows.map((r) => ({
        label: r.label,
        count: r.count,
        active: r.active,
        passive: r.passive,
        sum: r.sum,
      })),
      sourceRows: crm.sourceRows.map((r) => ({
        label: r.label,
        count: r.count,
        active: r.active,
        passive: r.passive,
        sum: r.sum,
      })),
      countryRows: crm.countryRows.map((r) => ({
        label: r.label,
        count: r.count,
        active: r.active,
        passive: r.passive,
        sum: r.sum,
      })),
      clients: slim,
    },
  }
}

export function buildTasksSharePayload(
  stats: ReturnType<typeof import('@/utils/analytics').buildTasksAnalytics>,
  month: string,
  createdByName: string,
): AnalyticsSharePayload {
  return {
    tab: 'tasks',
    month,
    monthLabel: monthTitle(month),
    createdByName,
    tasks: {
      totals: stats.totals,
      employees: stats.employees.map((e: EmployeeTaskStats) => ({
        name: e.name,
        total: e.total,
        done: e.done,
        pct: e.pct,
        open: e.open,
        overdue: e.overdue,
        daily: e.daily.total ? `${e.daily.done}/${e.daily.total}` : '—',
        weekly: e.weekly.total ? `${e.weekly.done}/${e.weekly.total}` : '—',
        monthly: e.monthly.total ? `${e.monthly.done}/${e.monthly.total}` : '—',
      })),
    },
  }
}
