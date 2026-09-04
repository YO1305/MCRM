import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Expand, X } from 'lucide-react'
import { useClients } from '@/hooks/useClients'
import { useTasks } from '@/hooks/useTasks'
import { useTaskTemplates } from '@/hooks/useTaskTemplates'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { getCrmStages, stageLabel } from '@/constants/clientStages'
import { TASK_STATUSES, type TaskStatus } from '@/constants/taskStatuses'
import { STATUS_BADGE } from '@/constants/taskMeta'
import { getCurrentMonth, todayISO } from '@/utils/dates'
import {
  activityLabelRu,
  buildCrmAnalytics,
  buildTasksAnalytics,
  formatMoney,
  formatPct,
  resolveLeadActivity,
} from '@/utils/analytics'
import type { Client } from '@/types/client.types'
import type { Task } from '@/types/task.types'
import type { EmployeeTaskStats } from '@/utils/analytics'
import { CopyAnalyticsLinkButton } from '@/components/analytics/CopyAnalyticsLinkButton'
import { useAuth } from '@/hooks/useAuth'
import {
  buildCrmSharePayload,
  buildTasksSharePayload,
} from '@/utils/analyticsSharePayload'

type Tab = 'crm' | 'tasks'

function monthOptions(count = 12) {
  const result: { value: string; label: string }[] = [{ value: 'all', label: 'Все время' }]
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    result.push({
      value: `${y}-${m}`,
      label: d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
    })
  }
  return result
}

function FullscreenDetail({
  title,
  subtitle,
  onClose,
  share,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  share?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-background">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 bg-surface px-4 py-3 lg:px-6">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Аналитика · детализация
          </p>
          <h2 className="truncate text-xl font-bold text-text">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {share}
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
            Закрыть
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>
    </div>
  )
}

export function Analytics() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('crm')
  const [taskMonth, setTaskMonth] = useState(getCurrentMonth())
  const [crmMonth, setCrmMonth] = useState(getCurrentMonth())

  const { clients, loading: clientsLoading } = useClients()
  const { tasks, loading: tasksLoading } = useTasks()
  const { templates, loading: tplLoading } = useTaskTemplates()

  const crm = useMemo(() => buildCrmAnalytics(clients, crmMonth), [clients, crmMonth])
  const tasksStats = useMemo(
    () => buildTasksAnalytics(tasks, templates, taskMonth),
    [tasks, templates, taskMonth],
  )

  const loading = tab === 'crm' ? clientsLoading : tasksLoading || tplLoading
  const author = user?.name || 'Bahmal'
  const shareBtn = (
    <CopyAnalyticsLinkButton
      buildPayload={() =>
        tab === 'crm'
          ? buildCrmSharePayload(clients, crmMonth, author)
          : buildTasksSharePayload(tasksStats, taskMonth, author)
      }
    />
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Аналитика</h1>
          <p className="mt-1 text-sm text-muted">
            CRM: актив / пассив / пауза — как бейджи в карточках. «Скопировать ссылку» — одна страница
            без входа, можно отправить в WhatsApp.
          </p>
        </div>
        {!loading ? shareBtn : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={tab === 'crm' ? 'secondary' : 'ghost'}
          onClick={() => setTab('crm')}
        >
          CRM
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === 'tasks' ? 'secondary' : 'ghost'}
          onClick={() => setTab('tasks')}
        >
          Задачи
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Загрузка данных...</p>
      ) : tab === 'crm' ? (
        <CrmSection
          crm={crm}
          clients={clients}
          month={crmMonth}
          onMonthChange={setCrmMonth}
          months={monthOptions()}
          share={shareBtn}
        />
      ) : (
        <TasksSection
          stats={tasksStats}
          tasks={tasks}
          month={taskMonth}
          onMonthChange={setTaskMonth}
          months={monthOptions()}
          share={shareBtn}
        />
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <Card className="!p-3">
      <p className="text-[11px] font-medium uppercase text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-text">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </Card>
  )
}

function ReportTable({
  columns,
  rows,
  dense,
}: {
  columns: string[]
  rows: (string | number)[][]
  dense?: boolean
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">Нет данных</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className={`w-full min-w-[520px] text-left ${dense ? 'text-sm' : 'text-base'}`}>
        <thead>
          <tr className="border-b border-gray-100 bg-background text-xs uppercase text-muted">
            {columns.map((c) => (
              <th key={c} className="px-4 py-2.5 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-50 last:border-0">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-2.5 ${j === 0 ? 'font-medium text-text' : 'text-muted'}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DataTable({
  title,
  hint,
  columns,
  rows,
  detailTitle,
  detailExtra,
  share,
}: {
  title: string
  hint?: string
  columns: string[]
  rows: (string | number)[][]
  detailTitle?: string
  detailExtra?: ReactNode
  share?: ReactNode
}) {
  const [full, setFull] = useState(false)

  return (
    <>
      <Card className="space-y-3 overflow-hidden !p-0">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-text">{title}</h2>
            {hint && <p className="text-xs text-muted">{hint}</p>}
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => setFull(true)}>
            <Expand className="h-3.5 w-3.5" />
            Во весь экран
          </Button>
        </div>
        <div className="px-0 pb-1">
          <ReportTable columns={columns} rows={rows} dense />
        </div>
      </Card>

      {full && (
        <FullscreenDetail
          title={detailTitle || title}
          subtitle={hint}
          onClose={() => setFull(false)}
          share={share}
        >
          <div className="mx-auto max-w-6xl space-y-6">
            <Card className="overflow-hidden !p-0">
              <ReportTable columns={columns} rows={rows} />
            </Card>
            {detailExtra}
          </div>
        </FullscreenDetail>
      )}
    </>
  )
}

function FunnelChart({
  stageRows,
}: {
  stageRows: {
    stage?: string
    label: string
    count: number
    sum: number
    active: number
    passive: number
    paused: number
    unlabeled: number
  }[]
}) {
  const archiveValues = new Set(
    getCrmStages()
      .filter((s) => s.isRejected || s.isFailed || s.isAbandoned)
      .map((s) => s.value),
  )
  const funnel = stageRows.filter((r) => !archiveValues.has(r.stage || ''))
  const max = Math.max(1, ...funnel.map((r) => r.count))

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-text">Воронка по этапам</h2>
        <p className="text-xs text-muted">Ширина полосы = число лидов на этапе</p>
      </div>
      <div className="space-y-2">
        {funnel.map((r, i) => {
          const pct = Math.max(12, Math.round((r.count / max) * 100))
          return (
            <div key={r.stage || r.label} className="space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-text">
                  {i + 1}. {r.label}
                </span>
                <span className="text-muted">
                  {r.count} · актив {r.active} · пассив {r.passive} · пауза {r.paused}
                  {r.unlabeled ? ` · без метки ${r.unlabeled}` : ''} · {formatMoney(r.sum)}
                </span>
              </div>
              <div className="flex justify-center">
                <div
                  className="rounded-md bg-secondary/85 px-3 py-2 text-center text-sm font-semibold text-white transition-all"
                  style={{ width: `${pct}%`, minWidth: r.count ? '4rem' : '2rem' }}
                  title={`${r.label}: ${r.count}`}
                >
                  {r.count}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {stageRows
        .filter((r) => archiveValues.has(r.stage || ''))
        .map((r) => (
          <p key={r.stage || 'arch'} className="text-sm text-muted">
            {r.label}: <span className="font-medium text-danger">{r.count}</span> · сумма{' '}
            {formatMoney(r.sum)}
          </p>
        ))}
    </Card>
  )
}

function ClientsDetailList({
  title,
  clients,
  month,
}: {
  title: string
  clients: Client[]
  month: string
}) {
  if (!clients.length) {
    return (
      <Card>
        <p className="text-sm text-muted">Нет лидов в этой выборке</p>
      </Card>
    )
  }
  return (
    <Card className="space-y-3 overflow-hidden !p-0">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-base font-semibold text-text">{title}</h3>
        <p className="text-xs text-muted">{clients.length} записей</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-background text-xs uppercase text-muted">
              <th className="px-4 py-2 font-medium">Клиент</th>
              <th className="px-4 py-2 font-medium">Активность</th>
              <th className="px-4 py-2 font-medium">Этап</th>
              <th className="px-4 py-2 font-medium">Менеджер лидов</th>
              <th className="px-4 py-2 font-medium">Продажи</th>
              <th className="px-4 py-2 font-medium">Продукция</th>
              <th className="px-4 py-2 font-medium">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const ap = resolveLeadActivity(c, month)
              return (
              <tr key={c.id} className="border-b border-gray-50">
                <td className="px-4 py-2">
                  <p className="font-medium text-text">{c.name}</p>
                  <p className="text-xs text-muted">{c.phone}</p>
                </td>
                <td className="px-4 py-2">
                  <span
                    className={
                      ap === 'active'
                        ? 'font-medium text-emerald-700'
                        : ap === 'paused'
                          ? 'font-medium text-slate-600'
                          : ap === 'passive'
                            ? 'font-medium text-amber-700'
                            : 'text-muted'
                    }
                  >
                    {activityLabelRu(ap)}
                  </span>
                  {c.activityReason ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{c.activityReason}</p>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-muted">
                  {stageLabel(c.stage)}
                </td>
                <td className="px-4 py-2 text-muted">{c.assignedToName || '—'}</td>
                <td className="px-4 py-2 text-muted">{c.salesManagerName || '—'}</td>
                <td className="px-4 py-2 text-muted">
                  {(c.products || [])
                    .map((p) => (p === 'fabric' ? 'Ткань' : 'ГП'))
                    .join(', ') || '—'}
                </td>
                <td className="px-4 py-2 text-muted">{formatMoney(Number(c.dealAmount) || 0)}</td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function CrmSection({
  crm,
  clients,
  month,
  onMonthChange,
  months,
  share,
}: {
  crm: ReturnType<typeof buildCrmAnalytics>
  clients: Client[]
  month: string
  onMonthChange: (v: string) => void
  months: { value: string; label: string }[]
  share?: ReactNode
}) {
  const [funnelFull, setFunnelFull] = useState(false)
  const activityMonth = crm.activityMonth
  const apColumns = ['Этап', 'Лидов', 'Актив', 'Пассив', 'Пауза', 'Без метки', 'Сумма']
  const apRow = (label: string, r: { count: number; active: number; passive: number; paused: number; unlabeled: number; sum: number }) => [
    label,
    r.count,
    r.active,
    r.passive,
    r.paused,
    r.unlabeled,
    formatMoney(r.sum),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text">Месяц активности</label>
        <select
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="max-w-xs rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm"
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
        <StatCard label="Всего лидов" value={crm.total} />
        <StatCard label="Актив" value={crm.activeTotal} hint="работа в CRM / перенос" />
        <StatCard label="Пассив" value={crm.passiveTotal} hint="тишина в журнале" />
        <StatCard label="На паузе" value={crm.pausedTotal} />
        <StatCard label="Без метки" value={crm.unlabeledTotal} hint="анализ ещё не ставил" />
        <StatCard label="В продажи" value={crm.transferred} />
        <StatCard label="С суммой" value={crm.withAmount} />
        <StatCard label="Сумма сделок" value={formatMoney(crm.totalSum)} hint="поле «сумма»" />
      </div>

      <div className="relative">
        <FunnelChart stageRows={crm.stageRows} />
        <div className="absolute right-3 top-3">
          <Button type="button" size="sm" variant="ghost" onClick={() => setFunnelFull(true)}>
            <Expand className="h-3.5 w-3.5" />
            Во весь экран
          </Button>
        </div>
      </div>

      {funnelFull && (
        <FullscreenDetail
          title="Воронка CRM"
          subtitle="Этапы · актив / пассив / пауза · список лидов"
          onClose={() => setFunnelFull(false)}
          share={share}
        >
          <div className="mx-auto max-w-6xl space-y-6">
            <FunnelChart stageRows={crm.stageRows} />
            <ReportTable
              columns={apColumns}
              rows={crm.stageRows.map((r) => apRow(r.label, r))}
            />
            <ClientsDetailList title="Все лиды воронки" clients={clients} month={activityMonth} />
          </div>
        </FullscreenDetail>
      )}

      <DataTable
        share={share}
        title="По этапам воронки"
        hint="Актив = как в карточке CRM за выбранный месяц"
        columns={apColumns}
        rows={crm.stageRows.map((r) => apRow(r.label, r))}
        detailExtra={<ClientsDetailList title="Все лиды" clients={clients} month={activityMonth} />}
      />

      <DataTable
        share={share}
        title="По менеджерам лидов"
        hint="У кого сколько лидов и какая активность"
        columns={['Менеджер', 'Лидов', 'Актив', 'Пассив', 'Пауза', 'Без метки', 'Сумма']}
        rows={crm.leadRows.map((r) => apRow(r.name, r))}
        detailExtra={
          <ClientsDetailList
            title="Лиды по менеджерам"
            month={activityMonth}
            clients={[...clients].sort((a, b) =>
              (a.assignedToName || '').localeCompare(b.assignedToName || '', 'ru'),
            )}
          />
        }
      />

      <DataTable
        share={share}
        title="Передано менеджерам продаж"
        hint="Кому переданы лиды из CRM"
        columns={['Менеджер продаж', 'Лидов', 'Актив', 'Пассив', 'Пауза', 'Без метки', 'Сумма']}
        rows={crm.salesRows.map((r) => apRow(r.name, r))}
        detailExtra={
          <ClientsDetailList
            title="Переданные в продажи"
            month={activityMonth}
            clients={clients.filter((c) => c.salesManagerId || c.salesManagerName)}
          />
        }
      />

      <DataTable
        share={share}
        title="По продукции"
        columns={['Тип', 'Лидов', 'Актив', 'Пассив', 'Пауза', 'Без метки', 'Сумма']}
        rows={crm.productRows.map((r) => apRow(r.label, r))}
        detailExtra={
          <ClientsDetailList title="Все лиды с продукцией" clients={clients} month={activityMonth} />
        }
      />

      {crm.categoryRows.length > 0 && (
        <DataTable
          share={share}
          title="Полки KPI (ткань / ГП / Европа)"
          hint="Один лид может быть на двух полках"
          columns={['Полка', 'Лидов', 'Актив', 'Пассив', 'Пауза', 'Без метки', 'Сумма']}
          rows={crm.categoryRows.map((r) => apRow(r.label, r))}
          detailExtra={<ClientsDetailList title="Все лиды" clients={clients} month={activityMonth} />}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <DataTable
          share={share}
          title="Ткани — детализация"
          columns={['Вид ткани', 'Лидов', 'Актив', 'Пассив', 'Сумма']}
          rows={crm.fabricRows.map((r) => [r.label, r.count, r.active, r.passive, formatMoney(r.sum)])}
          detailExtra={
            <ClientsDetailList
              title="Лиды с тканью"
              month={activityMonth}
              clients={clients.filter((c) => (c.products || []).includes('fabric'))}
            />
          }
        />
        <DataTable
          share={share}
          title="ГП — детализация"
          columns={['Вид ГП', 'Лидов', 'Актив', 'Пассив', 'Сумма']}
          rows={crm.gpRows.map((r) => [r.label, r.count, r.active, r.passive, formatMoney(r.sum)])}
          detailExtra={
            <ClientsDetailList
              title="Лиды с ГП"
              month={activityMonth}
              clients={clients.filter((c) => (c.products || []).includes('finished'))}
            />
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataTable
          share={share}
          title="По источникам"
          columns={['Источник', 'Лидов', 'Актив', 'Пассив', 'Сумма']}
          rows={crm.sourceRows.map((r) => [r.label, r.count, r.active, r.passive, formatMoney(r.sum)])}
          detailExtra={<ClientsDetailList title="Все лиды" clients={clients} month={activityMonth} />}
        />
        <DataTable
          share={share}
          title="По странам"
          columns={['Страна', 'Лидов', 'Актив', 'Пассив', 'Сумма']}
          rows={crm.countryRows.map((r) => [r.label, r.count, r.active, r.passive, formatMoney(r.sum)])}
          detailExtra={<ClientsDetailList title="Все лиды" clients={clients} month={activityMonth} />}
        />
      </div>
    </div>
  )
}

function filterTasksForMonth(tasks: Task[], month: string): Task[] {
  if (month === 'all') return tasks
  return tasks.filter((t) => {
    const d = t.dueDate || t.startDate || t.generatedForDate || ''
    return d.startsWith(month)
  })
}

function TasksSection({
  stats,
  tasks,
  month,
  onMonthChange,
  months,
  share,
}: {
  stats: ReturnType<typeof buildTasksAnalytics>
  tasks: Task[]
  month: string
  onMonthChange: (v: string) => void
  months: { value: string; label: string }[]
  share?: ReactNode
}) {
  const [detail, setDetail] = useState<EmployeeTaskStats | null>(null)
  const [overviewFull, setOverviewFull] = useState(false)
  const today = todayISO()

  const periodTasks = useMemo(() => filterTasksForMonth(tasks, month), [tasks, month])

  const employeeTasks = useMemo(() => {
    if (!detail) return []
    return periodTasks
      .filter((t) => t.assignedTo === detail.userId)
      .sort((a, b) => {
        const ad = a.dueDate || '9999'
        const bd = b.dueDate || '9999'
        return ad.localeCompare(bd)
      })
  }, [detail, periodTasks])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Период</label>
          <select
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Всего задач" value={stats.totals.total} />
        <StatCard label="Сделано" value={stats.totals.done} />
        <StatCard label="Открыто" value={stats.totals.open} />
        <StatCard label="Просрочено" value={stats.totals.overdue} />
      </div>

      <Card className="space-y-3 overflow-hidden !p-0">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-text">По сотрудникам</h2>
            <p className="text-xs text-muted">
              Нажмите строку — полный список задач и статусы во весь экран
            </p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOverviewFull(true)}>
            <Expand className="h-3.5 w-3.5" />
            Во весь экран
          </Button>
        </div>

        {stats.employees.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">Нет задач за период</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-background text-xs uppercase text-muted">
                  <th className="px-4 py-2 font-medium">Сотрудник</th>
                  <th className="px-4 py-2 font-medium">Всего</th>
                  <th className="px-4 py-2 font-medium">Сделано</th>
                  <th className="px-4 py-2 font-medium">%</th>
                  <th className="px-4 py-2 font-medium">Просрочено</th>
                  <th className="px-4 py-2 font-medium">День / Нед</th>
                </tr>
              </thead>
              <tbody>
                {stats.employees.map((e) => (
                  <tr
                    key={e.userId}
                    className="cursor-pointer border-b border-gray-50 hover:bg-background/80"
                    onClick={() => setDetail(e)}
                  >
                    <td className="px-4 py-2.5 font-medium text-text">{e.name}</td>
                    <td className="px-4 py-2.5 text-muted">{e.total}</td>
                    <td className="px-4 py-2.5 text-muted">{e.done}</td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={e.pct >= 80 ? 'success' : e.pct >= 50 ? 'warning' : 'default'}
                      >
                        {formatPct(e.done, e.total)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {e.overdue > 0 ? (
                        <span className="font-medium text-danger">{e.overdue}</span>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      {e.daily.total > 0 && (
                        <span className="mr-2">
                          Д: {e.daily.done}/{e.daily.total}
                        </span>
                      )}
                      {e.weekly.total > 0 && (
                        <span>
                          Н: {e.weekly.done}/{e.weekly.total}
                        </span>
                      )}
                      {!e.daily.total && !e.weekly.total && '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {overviewFull && (
        <FullscreenDetail
          title="Задачи по сотрудникам"
          subtitle="Сводка за выбранный период"
          onClose={() => setOverviewFull(false)}
          share={share}
        >
          <div className="mx-auto max-w-6xl space-y-4">
            <ReportTable
              columns={['Сотрудник', 'Всего', 'Сделано', '%', 'Открыто', 'Просрочено', 'День', 'Нед', 'Мес']}
              rows={stats.employees.map((e) => [
                e.name,
                e.total,
                e.done,
                formatPct(e.done, e.total),
                e.open,
                e.overdue,
                e.daily.total ? `${e.daily.done}/${e.daily.total}` : '—',
                e.weekly.total ? `${e.weekly.done}/${e.weekly.total}` : '—',
                e.monthly.total ? `${e.monthly.done}/${e.monthly.total}` : '—',
              ])}
            />
            <p className="text-sm text-muted">
              Чтобы увидеть список задач — закройте окно и нажмите на сотрудника в таблице.
            </p>
          </div>
        </FullscreenDetail>
      )}

      {detail && (
        <FullscreenDetail
          title={detail.name}
          subtitle={`Задачи · сделано ${detail.done}/${detail.total} (${formatPct(detail.done, detail.total)}) · просрочено ${detail.overdue}`}
          onClose={() => setDetail(null)}
          share={share}
        >
          <div className="mx-auto max-w-6xl space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Всего" value={detail.total} />
              <StatCard label="Сделано" value={detail.done} />
              <StatCard label="Открыто" value={detail.open} />
              <StatCard label="Просрочено" value={detail.overdue} />
            </div>

            {detail.byTemplate.length > 0 && (
              <Card className="space-y-2">
                <h3 className="text-sm font-semibold text-text">Шаблоны (шоурум, блогеры…)</h3>
                <ul className="space-y-1">
                  {detail.byTemplate.map((t) => (
                    <li
                      key={t.title + t.recurrence}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-text">
                        {t.title}
                        <span className="ml-2 text-xs font-normal text-muted">{t.recurrence}</span>
                      </span>
                      <span className="text-xs text-muted">
                        {t.done}/{t.total} · {formatPct(t.done, t.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card className="overflow-hidden !p-0">
              <div className="border-b border-gray-100 px-4 py-3">
                <h3 className="text-base font-semibold text-text">Список задач</h3>
                <p className="text-xs text-muted">{employeeTasks.length} шт. за период</p>
              </div>
              {employeeTasks.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">Нет задач</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-background text-xs uppercase text-muted">
                        <th className="px-4 py-2 font-medium">Задача</th>
                        <th className="px-4 py-2 font-medium">Статус</th>
                        <th className="px-4 py-2 font-medium">Срок</th>
                        <th className="px-4 py-2 font-medium">Приоритет</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeTasks.map((t) => {
                        const overdue =
                          t.status !== 'done' && !!t.dueDate && t.dueDate < today
                        const st = t.status as TaskStatus
                        return (
                          <tr
                            key={t.id}
                            className={`border-b border-gray-50 ${overdue ? 'bg-red-50/50' : ''}`}
                          >
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-text">{t.title}</p>
                              {t.description && (
                                <p className="line-clamp-2 text-xs text-muted">{t.description}</p>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                <Badge variant={STATUS_BADGE[st] || 'default'}>
                                  {TASK_STATUSES[st] || t.status}
                                </Badge>
                                {overdue && <Badge variant="danger">Просрочено</Badge>}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-muted">{t.dueDate || '—'}</td>
                            <td className="px-4 py-2.5 text-muted">{t.priority}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </FullscreenDetail>
      )}
    </div>
  )
}
