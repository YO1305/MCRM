import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Expand, X } from 'lucide-react'
import { useClients } from '@/hooks/useClients'
import { useContacts } from '@/hooks/useContacts'
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
  buildCrmAnalytics,
  buildTasksAnalytics,
  formatMoney,
  formatPct,
} from '@/utils/analytics'
import type { Client } from '@/types/client.types'
import type { Task } from '@/types/task.types'
import type { EmployeeTaskStats } from '@/utils/analytics'

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
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
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
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
          Закрыть
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>
    </div>
  )
}

export function Analytics() {
  const [tab, setTab] = useState<Tab>('crm')
  const [taskMonth, setTaskMonth] = useState(getCurrentMonth())

  const { clients, loading: clientsLoading } = useClients()
  const { contacts, loading: contactsLoading } = useContacts(true)
  const { tasks, loading: tasksLoading } = useTasks()
  const { templates, loading: tplLoading } = useTaskTemplates()

  const crm = useMemo(() => buildCrmAnalytics(clients, contacts), [clients, contacts])
  const tasksStats = useMemo(
    () => buildTasksAnalytics(tasks, templates, taskMonth),
    [tasks, templates, taskMonth],
  )

  const loading =
    tab === 'crm' ? clientsLoading || contactsLoading : tasksLoading || tplLoading

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Аналитика</h1>
        <p className="mt-1 text-sm text-muted">
          CRM · задачи. Нажмите «Во весь экран» у отчёта или строку сотрудника — откроется
          подробная детализация.
        </p>
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
        <CrmSection crm={crm} clients={clients} />
      ) : (
        <TasksSection
          stats={tasksStats}
          tasks={tasks}
          month={taskMonth}
          onMonthChange={setTaskMonth}
          months={monthOptions()}
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
}: {
  title: string
  hint?: string
  columns: string[]
  rows: (string | number)[][]
  detailTitle?: string
  detailExtra?: ReactNode
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
                  {r.count} · актив {r.active} · пассив {r.passive} · {formatMoney(r.sum)}
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
}: {
  title: string
  clients: Client[]
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
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-background text-xs uppercase text-muted">
              <th className="px-4 py-2 font-medium">Клиент</th>
              <th className="px-4 py-2 font-medium">Этап</th>
              <th className="px-4 py-2 font-medium">Менеджер лидов</th>
              <th className="px-4 py-2 font-medium">Продажи</th>
              <th className="px-4 py-2 font-medium">Продукция</th>
              <th className="px-4 py-2 font-medium">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-gray-50">
                <td className="px-4 py-2">
                  <p className="font-medium text-text">{c.name}</p>
                  <p className="text-xs text-muted">{c.phone}</p>
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
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function CrmSection({
  crm,
  clients,
}: {
  crm: ReturnType<typeof buildCrmAnalytics>
  clients: Client[]
}) {
  const [funnelFull, setFunnelFull] = useState(false)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Всего лидов" value={crm.total} />
        <StatCard label="Актив" value={crm.activeTotal} />
        <StatCard label="Пассив" value={crm.passiveTotal} />
        <StatCard label="Передано в продажи" value={crm.transferred} />
        <StatCard label="С суммой" value={crm.withAmount} />
        <StatCard label="Сумма сделок" value={formatMoney(crm.totalSum)} hint="по полю «сумма»" />
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
          subtitle="Этапы · количество · суммы · список лидов"
          onClose={() => setFunnelFull(false)}
        >
          <div className="mx-auto max-w-6xl space-y-6">
            <FunnelChart stageRows={crm.stageRows} />
            <ReportTable
              columns={['Этап', 'Лидов', 'Актив', 'Пассив', 'Сумма']}
              rows={crm.stageRows.map((r) => [
                r.label,
                r.count,
                r.active,
                r.passive,
                formatMoney(r.sum),
              ])}
            />
            <ClientsDetailList title="Все лиды воронки" clients={clients} />
          </div>
        </FullscreenDetail>
      )}

      <DataTable
        title="По этапам воронки"
        hint="Количество · актив/пассив · сумма"
        columns={['Этап', 'Лидов', 'Актив', 'Пассив', 'Сумма']}
        rows={crm.stageRows.map((r) => [
          r.label,
          r.count,
          r.active,
          r.passive,
          formatMoney(r.sum),
        ])}
        detailExtra={<ClientsDetailList title="Все лиды" clients={clients} />}
      />

      <DataTable
        title="По менеджерам лидов"
        hint="У кого сколько лидов в работе"
        columns={['Менеджер', 'Лидов', 'Актив', 'Пассив', 'Сумма']}
        rows={crm.leadRows.map((r) => [
          r.name,
          r.count,
          r.active,
          r.passive,
          formatMoney(r.sum),
        ])}
        detailExtra={
          <ClientsDetailList
            title="Лиды по менеджерам"
            clients={[...clients].sort((a, b) =>
              (a.assignedToName || '').localeCompare(b.assignedToName || '', 'ru'),
            )}
          />
        }
      />

      <DataTable
        title="Передано менеджерам продаж"
        hint="Кому переданы лиды из CRM"
        columns={['Менеджер продаж', 'Лидов', 'Актив', 'Пассив', 'Сумма']}
        rows={crm.salesRows.map((r) => [
          r.name,
          r.count,
          r.active,
          r.passive,
          formatMoney(r.sum),
        ])}
        detailExtra={
          <ClientsDetailList
            title="Переданные в продажи"
            clients={clients.filter((c) => c.salesManagerId || c.salesManagerName)}
          />
        }
      />

      <DataTable
        title="По продукции"
        columns={['Тип', 'Лидов', 'Актив', 'Пассив', 'Сумма']}
        rows={crm.productRows.map((r) => [
          r.label,
          r.count,
          r.active,
          r.passive,
          formatMoney(r.sum),
        ])}
        detailExtra={<ClientsDetailList title="Все лиды с продукцией" clients={clients} />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <DataTable
          title="Ткани — детализация"
          columns={['Вид ткани', 'Лидов', 'Сумма']}
          rows={crm.fabricRows.map((r) => [r.label, r.count, formatMoney(r.sum)])}
          detailExtra={
            <ClientsDetailList
              title="Лиды с тканью"
              clients={clients.filter((c) => (c.products || []).includes('fabric'))}
            />
          }
        />
        <DataTable
          title="ГП — детализация"
          columns={['Вид ГП', 'Лидов', 'Сумма']}
          rows={crm.gpRows.map((r) => [r.label, r.count, formatMoney(r.sum)])}
          detailExtra={
            <ClientsDetailList
              title="Лиды с ГП"
              clients={clients.filter((c) => (c.products || []).includes('finished'))}
            />
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataTable
          title="По источникам"
          columns={['Источник', 'Лидов', 'Сумма']}
          rows={crm.sourceRows.map((r) => [r.label, r.count, formatMoney(r.sum)])}
          detailExtra={<ClientsDetailList title="Все лиды" clients={clients} />}
        />
        <DataTable
          title="По странам"
          columns={['Страна', 'Лидов', 'Сумма']}
          rows={crm.countryRows.map((r) => [r.label, r.count, formatMoney(r.sum)])}
          detailExtra={<ClientsDetailList title="Все лиды" clients={clients} />}
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
}: {
  stats: ReturnType<typeof buildTasksAnalytics>
  tasks: Task[]
  month: string
  onMonthChange: (v: string) => void
  months: { value: string; label: string }[]
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
