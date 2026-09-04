import { formatMoney, formatPct } from '@/utils/analytics'
import type { AnalyticsSharePayload } from '@/utils/analyticsSharePayload'
import { Card } from '@/components/ui/Card'

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="!p-3">
      <p className="text-[11px] font-medium uppercase text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-text">{value}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </Card>
  )
}

function Table({
  title,
  columns,
  rows,
}: {
  title: string
  columns: string[]
  rows: (string | number)[][]
}) {
  return (
    <Card className="space-y-2 overflow-hidden !p-0">
      <h2 className="border-b border-gray-100 px-4 py-3 text-base font-semibold text-text">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">Нет данных</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-background text-xs uppercase text-muted">
                {columns.map((c) => (
                  <th key={c} className="px-4 py-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-50">
                  {row.map((cell, j) => (
                    <td key={j} className={`px-4 py-2 ${j === 0 ? 'font-medium text-text' : 'text-muted'}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function ap(label: string, r: { count: number; active: number; passive: number; paused: number; unlabeled: number; sum: number }) {
  return [label, r.count, r.active, r.passive, r.paused, r.unlabeled, formatMoney(r.sum)]
}

export function AnalyticsShareView({ payload }: { payload: AnalyticsSharePayload }) {
  const crm = payload.crm
  const tasks = payload.tasks

  return (
    <div className="space-y-4">
      {payload.tab === 'crm' && crm ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
            <Stat label="Всего лидов" value={crm.total} />
            <Stat label="Актив" value={crm.activeTotal} />
            <Stat label="Пассив" value={crm.passiveTotal} />
            <Stat label="На паузе" value={crm.pausedTotal} />
            <Stat label="Без метки" value={crm.unlabeledTotal} />
            <Stat label="В продажи" value={crm.transferred} />
            <Stat label="С суммой" value={crm.withAmount} />
            <Stat label="Сумма сделок" value={formatMoney(crm.totalSum)} />
          </div>
          <Table
            title="По этапам"
            columns={['Этап', 'Лидов', 'Актив', 'Пассив', 'Пауза', 'Без метки', 'Сумма']}
            rows={crm.stageRows.map((r) => ap(r.label, r))}
          />
          <Table
            title="По менеджерам лидов"
            columns={['Менеджер', 'Лидов', 'Актив', 'Пассив', 'Пауза', 'Без метки', 'Сумма']}
            rows={crm.leadRows.map((r) => ap(r.label, r))}
          />
          <Table
            title="Менеджеры продаж"
            columns={['Менеджер', 'Лидов', 'Актив', 'Пассив', 'Пауза', 'Без метки', 'Сумма']}
            rows={crm.salesRows.map((r) => ap(r.label, r))}
          />
          <Table
            title="Продукция"
            columns={['Тип', 'Лидов', 'Актив', 'Пассив', 'Пауза', 'Без метки', 'Сумма']}
            rows={crm.productRows.map((r) => ap(r.label, r))}
          />
          {crm.categoryRows.length > 0 && (
            <Table
              title="Полки KPI"
              columns={['Полка', 'Лидов', 'Актив', 'Пассив', 'Пауза', 'Без метки', 'Сумма']}
              rows={crm.categoryRows.map((r) => ap(r.label, r))}
            />
          )}
          <Table
            title="Лиды"
            columns={['Клиент', 'Активность', 'Этап', 'Менеджер', 'Продажи', 'Продукция', 'Сумма']}
            rows={crm.clients.map((c) => [
              c.name,
              c.activity,
              c.stage,
              c.manager,
              c.sales,
              c.products,
              formatMoney(c.amount),
            ])}
          />
        </>
      ) : null}

      {payload.tab === 'tasks' && tasks ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Всего задач" value={tasks.totals.total} />
            <Stat label="Сделано" value={tasks.totals.done} />
            <Stat label="Открыто" value={tasks.totals.open} />
            <Stat label="Просрочено" value={tasks.totals.overdue} />
          </div>
          <Table
            title="По сотрудникам"
            columns={['Сотрудник', 'Всего', 'Сделано', '%', 'Открыто', 'Просрочено', 'День', 'Нед', 'Мес']}
            rows={tasks.employees.map((e) => [
              e.name,
              e.total,
              e.done,
              formatPct(e.done, e.total),
              e.open,
              e.overdue,
              e.daily,
              e.weekly,
              e.monthly,
            ])}
          />
        </>
      ) : null}
    </div>
  )
}
