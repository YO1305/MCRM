import { KPI_COEFFICIENT_ROWS, KPI_EXPLAIN_GENERAL, KPI_ROLE_TEMPLATES } from '@/constants/kpiPayroll'
import type { KpiPayrollRole } from '@/types/kpiPayroll.types'
import { Card } from '@/components/ui/Card'

export function KpiExplanation({ role }: { role: KpiPayrollRole }) {
  const tpl = KPI_ROLE_TEMPLATES[role]
  return (
    <Card className="space-y-4 bg-slate-50/80">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Разъяснение / свод</p>
        <h2 className="mt-1 text-base font-semibold text-text">{KPI_EXPLAIN_GENERAL.title}</h2>
        <p className="mt-1 text-sm font-medium text-secondary">{KPI_EXPLAIN_GENERAL.formula}</p>
        <p className="mt-1 text-xs text-muted">
          {tpl.shortName}: оклад {tpl.salary.toLocaleString('ru-RU')} тыс сум · фонд KPI{' '}
          {tpl.kpiFund.toLocaleString('ru-RU')} тыс сум. Все суммы в тысячах сум, как в Excel.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {KPI_EXPLAIN_GENERAL.blocks.map((b) => (
          <div key={b.title} className="rounded-lg bg-white p-3 shadow-sm">
            <p className="text-sm font-semibold text-text">{b.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{b.text}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-sm font-semibold text-text">Коэффициенты блока 2</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-muted">
                <th className="py-1.5 pr-2 font-medium">% выполнения</th>
                <th className="py-1.5 pr-2 font-medium">Коэфф.</th>
                <th className="py-1.5 font-medium">Смысл</th>
              </tr>
            </thead>
            <tbody>
              {KPI_COEFFICIENT_ROWS.map((r) => (
                <tr key={r.range} className="border-b border-gray-50">
                  <td className="py-1.5 pr-2 text-text">{r.range}</td>
                  <td className="py-1.5 pr-2 font-semibold">{r.coef}</td>
                  <td className="py-1.5 text-muted">{r.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {role === 'aygul' ? (
        <p className="text-xs leading-relaxed text-muted">
          У Айгуль четвёртый показатель — контроль SMM, плюс бонусы: оборот магазина (филиал /
          Instagram, одна ступень), доля от чистых онлайн-продаж через Direct (4–7 %) и фикса Direct
          500 тыс. Шоурум в её KPI-фонд не входит.
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-muted">
          У Кундуз четвёртый показатель — шоурум в норме (2 точки). Бонуса Instagram нет — канал за
          Айгуль. Обход шоурума также в чек-листе фикса (в окладе), KPI платит за итоговое состояние
          за месяц.
        </p>
      )}

      <p className="text-xs leading-relaxed text-muted">
        Лид в блок 2 попадает, если за месяц Groq признал клиента активным и насчитал достаточно
        весомых шагов клиента (ТЗ, образцы, объём, договор). Сделка в 1-м месяце работы засчитывается
        сразу. С 4-го месяца работы лид в KPI не идёт. Ниже — какие клиенты засчитались и почему.
      </p>
    </Card>
  )
}
