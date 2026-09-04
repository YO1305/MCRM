import type { Client } from '@/types/client.types'
import type { Task } from '@/types/task.types'
import type { TaskTemplate, TaskRecurrence } from '@/types/taskTemplate.types'
import type { ClientStage } from '@/constants/clientStages'
import { allPipelineStages, stageIsClosed } from '@/constants/clientStages'
import { CLIENT_SOURCES } from '@/constants/clientMeta'
import { FABRIC_TYPES, GP_TYPES, PRODUCT_KIND_LABELS } from '@/constants/leadProducts'
import { getCurrentMonth, todayISO } from '@/utils/dates'
import { effectiveGroqActivity } from '@/utils/groqLeadActivity'
import { GROQ_ACTIVITY_LABELS, type GroqActivityLabel } from '@/types/aiActivity.types'

export function formatMoney(n: number): string {
  if (!n) return '0'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)
}

export function formatPct(done: number, total: number): string {
  if (!total) return '—'
  return `${Math.round((done / total) * 100)}%`
}

export type LeadActivityKind = GroqActivityLabel | 'unlabeled'

export function activityLabelRu(kind: LeadActivityKind): string {
  if (kind === 'unlabeled') return 'без метки'
  return GROQ_ACTIVITY_LABELS[kind]
}

/** Same active/passive/paused as CRM badges, not the contacts book. */
export function resolveLeadActivity(
  client: Client,
  month: string = getCurrentMonth(),
): LeadActivityKind {
  const { label } = effectiveGroqActivity(client, month)
  if (label) return label
  if (stageIsClosed(client.stage)) return 'passive'
  return 'unlabeled'
}

export interface CountSum {
  count: number
  sum: number
  active: number
  passive: number
  paused: number
  unlabeled: number
}

function emptyCS(): CountSum {
  return { count: 0, sum: 0, active: 0, passive: 0, paused: 0, unlabeled: 0 }
}

function addCS(row: CountSum, amount: number | null | undefined, ap: LeadActivityKind) {
  row.count += 1
  row.sum += Number(amount) || 0
  if (ap === 'active') row.active += 1
  else if (ap === 'passive') row.passive += 1
  else if (ap === 'paused') row.paused += 1
  else row.unlabeled += 1
}

export function buildCrmAnalytics(clients: Client[], month: string | 'all' = getCurrentMonth()) {
  const activityMonth = month === 'all' ? getCurrentMonth() : month
  const byStage = new Map<ClientStage, CountSum>()
  const pipeline = allPipelineStages()
  for (const s of pipeline) byStage.set(s.value, emptyCS())

  const byLeadManager = new Map<string, CountSum & { name: string }>()
  const bySalesManager = new Map<string, CountSum & { name: string }>()
  const byProduct = {
    fabric: emptyCS(),
    finished: emptyCS(),
    both: emptyCS(),
    none: emptyCS(),
  }
  const byFabricType = new Map<string, CountSum>()
  const byGpType = new Map<string, CountSum>()
  const bySource = new Map<string, CountSum>()
  const byCountry = new Map<string, CountSum>()
  const byCategory = {
    fabric: emptyCS(),
    finished: emptyCS(),
    europe: emptyCS(),
  }

  let totalSum = 0
  let transferred = 0
  let withAmount = 0
  let activeTotal = 0
  let passiveTotal = 0
  let pausedTotal = 0
  let unlabeledTotal = 0

  for (const c of clients) {
    const ap = resolveLeadActivity(c, activityMonth)
    if (ap === 'active') activeTotal += 1
    else if (ap === 'passive') passiveTotal += 1
    else if (ap === 'paused') pausedTotal += 1
    else unlabeledTotal += 1

    const amount = c.dealAmount
    totalSum += Number(amount) || 0
    if (amount != null && Number(amount) > 0) withAmount += 1

    const stage = (c.stage || 'contact') as ClientStage
    if (!byStage.has(stage)) byStage.set(stage, emptyCS())
    addCS(byStage.get(stage)!, amount, ap)

    const leadKey = c.assignedTo || 'unassigned'
    const leadName = c.assignedToName || 'Без менеджера'
    if (!byLeadManager.has(leadKey)) {
      byLeadManager.set(leadKey, { ...emptyCS(), name: leadName })
    }
    const leadRow = byLeadManager.get(leadKey)!
    leadRow.name = leadName
    addCS(leadRow, amount, ap)

    if (c.salesManagerId || c.salesManagerName) {
      transferred += 1
      const sk = c.salesManagerId || c.salesManagerName || 'unknown'
      const sn = c.salesManagerName || 'Менеджер продаж'
      if (!bySalesManager.has(sk)) {
        bySalesManager.set(sk, { ...emptyCS(), name: sn })
      }
      const sRow = bySalesManager.get(sk)!
      sRow.name = sn
      addCS(sRow, amount, ap)
    }

    const products = c.products || []
    const hasF = products.includes('fabric')
    const hasG = products.includes('finished')
    if (hasF && hasG) addCS(byProduct.both, amount, ap)
    else if (hasF) addCS(byProduct.fabric, amount, ap)
    else if (hasG) addCS(byProduct.finished, amount, ap)
    else addCS(byProduct.none, amount, ap)

    const cats = Array.isArray(c.categories) && c.categories.length
      ? c.categories
      : c.category
        ? [c.category]
        : []
    if (cats.includes('fabric')) addCS(byCategory.fabric, amount, ap)
    if (cats.includes('finished')) addCS(byCategory.finished, amount, ap)
    if (cats.includes('europe')) addCS(byCategory.europe, amount, ap)

    for (const ft of c.fabricTypes || []) {
      if (!byFabricType.has(ft)) byFabricType.set(ft, emptyCS())
      addCS(byFabricType.get(ft)!, amount, ap)
    }
    for (const gt of c.gpTypes || []) {
      if (!byGpType.has(gt)) byGpType.set(gt, emptyCS())
      addCS(byGpType.get(gt)!, amount, ap)
    }

    const src = c.source || 'other'
    if (!bySource.has(src)) bySource.set(src, emptyCS())
    addCS(bySource.get(src)!, amount, ap)

    const country = c.country || '—'
    if (!byCountry.has(country)) byCountry.set(country, emptyCS())
    addCS(byCountry.get(country)!, amount, ap)
  }

  return {
    total: clients.length,
    totalSum,
    withAmount,
    transferred,
    activeTotal,
    passiveTotal,
    pausedTotal,
    unlabeledTotal,
    activityMonth,
    stageRows: pipeline.map((s) => ({
      stage: s.value,
      label: s.label,
      ...(byStage.get(s.value) || emptyCS()),
    })),
    leadRows: [...byLeadManager.values()].sort((a, b) => b.count - a.count),
    salesRows: [...bySalesManager.values()].sort((a, b) => b.count - a.count),
    productRows: [
      { key: 'fabric', label: PRODUCT_KIND_LABELS.fabric, ...byProduct.fabric },
      { key: 'finished', label: PRODUCT_KIND_LABELS.finished, ...byProduct.finished },
      { key: 'both', label: 'Ткань + ГП', ...byProduct.both },
      { key: 'none', label: 'Не указано', ...byProduct.none },
    ].filter((r) => r.count > 0),
    categoryRows: [
      { key: 'fabric', label: 'Ткань (KPI-полка)', ...byCategory.fabric },
      { key: 'finished', label: 'ГП (KPI-полка)', ...byCategory.finished },
      { key: 'europe', label: 'Европа', ...byCategory.europe },
    ].filter((r) => r.count > 0),
    fabricRows: [...byFabricType.entries()]
      .map(([key, v]) => ({ key, label: FABRIC_TYPES[key] || key, ...v }))
      .sort((a, b) => b.count - a.count),
    gpRows: [...byGpType.entries()]
      .map(([key, v]) => ({ key, label: GP_TYPES[key] || key, ...v }))
      .sort((a, b) => b.count - a.count),
    sourceRows: [...bySource.entries()]
      .map(([key, v]) => ({
        key,
        label: CLIENT_SOURCES[key as keyof typeof CLIENT_SOURCES] || key,
        ...v,
      }))
      .sort((a, b) => b.count - a.count),
    countryRows: [...byCountry.entries()]
      .map(([key, v]) => ({ key, label: key, ...v }))
      .sort((a, b) => b.count - a.count),
  }
}

export interface EmployeeTaskStats {
  userId: string
  name: string
  total: number
  done: number
  open: number
  overdue: number
  pct: number
  daily: { total: number; done: number }
  weekly: { total: number; done: number }
  monthly: { total: number; done: number }
  otherRecurring: { total: number; done: number }
  byTemplate: { title: string; recurrence: string; total: number; done: number }[]
}

export const RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  daily: 'Ежедневно',
  weekly: 'Еженедельно',
  monthly: 'Ежемесячно',
  every_n_days: 'Раз в N дней',
  every_n_months: 'Раз в N месяцев',
}

export function buildTasksAnalytics(
  tasks: Task[],
  templates: TaskTemplate[],
  monthKey: string | 'all',
) {
  const today = todayISO()
  const tplMap = new Map(templates.map((t) => [t.id, t]))

  const filtered =
    monthKey === 'all'
      ? tasks
      : tasks.filter((t) => {
          const d = t.dueDate || t.startDate || t.generatedForDate || ''
          return d.startsWith(monthKey)
        })

  const byUser = new Map<string, EmployeeTaskStats>()
  const templateBucket = new Map<
    string,
    Map<string, { title: string; recurrence: string; total: number; done: number }>
  >()

  function ensure(userId: string, name: string): EmployeeTaskStats {
    if (!byUser.has(userId)) {
      byUser.set(userId, {
        userId,
        name,
        total: 0,
        done: 0,
        open: 0,
        overdue: 0,
        pct: 0,
        daily: { total: 0, done: 0 },
        weekly: { total: 0, done: 0 },
        monthly: { total: 0, done: 0 },
        otherRecurring: { total: 0, done: 0 },
        byTemplate: [],
      })
    }
    return byUser.get(userId)!
  }

  for (const t of filtered) {
    const row = ensure(t.assignedTo, t.assignedToName || 'Сотрудник')
    row.total += 1
    const isDone = t.status === 'done'
    if (isDone) row.done += 1
    else {
      row.open += 1
      if (t.dueDate && t.dueDate < today) row.overdue += 1
    }

    const tpl = t.sourceTemplateId ? tplMap.get(t.sourceTemplateId) : null
    if (tpl) {
      const bucket =
        tpl.recurrence === 'daily'
          ? row.daily
          : tpl.recurrence === 'weekly'
            ? row.weekly
            : tpl.recurrence === 'monthly'
              ? row.monthly
              : row.otherRecurring
      bucket.total += 1
      if (isDone) bucket.done += 1

      if (!templateBucket.has(t.assignedTo)) templateBucket.set(t.assignedTo, new Map())
      const tm = templateBucket.get(t.assignedTo)!
      if (!tm.has(tpl.id)) {
        tm.set(tpl.id, {
          title: tpl.title,
          recurrence: RECURRENCE_LABELS[tpl.recurrence] || tpl.recurrence,
          total: 0,
          done: 0,
        })
      }
      const tr = tm.get(tpl.id)!
      tr.total += 1
      if (isDone) tr.done += 1
    }
  }

  for (const [uid, row] of byUser) {
    row.pct = row.total ? Math.round((row.done / row.total) * 100) : 0
    const tm = templateBucket.get(uid)
    row.byTemplate = tm ? [...tm.values()].sort((a, b) => b.total - a.total) : []
  }

  return {
    employees: [...byUser.values()].sort((a, b) => b.total - a.total),
    totals: {
      total: filtered.length,
      done: filtered.filter((t) => t.status === 'done').length,
      open: filtered.filter((t) => t.status !== 'done').length,
      overdue: filtered.filter(
        (t) => t.status !== 'done' && t.dueDate && t.dueDate < today,
      ).length,
    },
  }
}
