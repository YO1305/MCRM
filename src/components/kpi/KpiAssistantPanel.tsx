import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CertChecks, Money, NumField } from '@/components/kpi/KpiFields'
import { ASSISTANT_SALARY, calcAssistant } from '@/constants/kpiDeptPayroll'
import { useKpiDeptPayroll } from '@/hooks/useKpiDeptPayroll'
import type { AssistantPayrollInput } from '@/types/kpiDeptPayroll.types'

const DUTY_GROUPS: { title: string; items: string[] }[] = [
  {
    title: 'Поручения',
    items: [
      'Поручения начальника отдела в срок',
      'Помощь менеджерам по лидам при пиковой нагрузке',
      'Мелкие задачи менеджера развития',
      'Помощь дизайнеру: файлы, печать макетов',
    ],
  },
  {
    title: 'Образцы тканей',
    items: [
      'Подготовка образцов по запросу',
      'Упаковка и маркировка для клиентов',
      'Наборы для выставок',
      'Реестр: кому, когда, какие артикулы',
    ],
  },
  {
    title: 'Почта и документы',
    items: [
      'Отправка и получение посылок',
      'Доставка документов между отделами',
      'Сканирование, архив, пакеты на подпись',
    ],
  },
  {
    title: 'Закупки и полиграфия',
    items: [
      'Канцелярия, упаковка, картриджи',
      'Реестр расходов и отчёт до 3-го числа',
      'Заказы полиграфии, макеты, сроки, доставка тиража',
    ],
  },
  {
    title: 'Выставки',
    items: [
      'Упаковка экспонатов, транспортировка, стенд',
      'Работа на мероприятии, разбор и возврат',
    ],
  },
]

export function KpiAssistantPanel({ month }: { month: string }) {
  const { assistant, setAssistant, loading, saving, error, save } = useKpiDeptPayroll('assistant', month)
  const r = calcAssistant(assistant)

  function patch(partial: Partial<AssistantPayrollInput>) {
    setAssistant((prev) => ({ ...prev, ...partial }))
  }

  if (loading) return <p className="text-sm text-muted">Загрузка…</p>

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="text-base font-semibold">Ассистент отдела маркетинга</h2>
        <p className="text-sm text-muted">
          Нет фонда KPI. Оклад {ASSISTANT_SALARY} + 70% тарифа сертификатов + субсидия (вручную).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumField
            label="Рабочих дней, план"
            value={assistant.daysPlan}
            onChange={(e) => patch({ daysPlan: Number(e.target.value) })}
          />
          <NumField
            label="Рабочих дней, факт"
            value={assistant.daysFact}
            onChange={(e) => patch({ daysFact: Number(e.target.value) })}
          />
        </div>
        <p>
          Фикса: <Money value={r.fixa} />
        </p>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">Сертификаты · доля ассистента 70%</h3>
        <p className="text-xs text-muted">
          ISO 210 · Better Work 1 400 · Oeko Tex 1 400 · BSCI 2 100. Отметьте полученные за месяц.
        </p>
        <CertChecks
          value={assistant.certificates}
          onChange={(certificates) => patch({ certificates })}
        />
        <p>
          <Money value={r.certs} />
        </p>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">Субсидии · 2–5% от суммы, решает руководство</h3>
        <NumField
          label="Доплата, тыс сум"
          value={assistant.subsidy}
          onChange={(e) => patch({ subsidy: Number(e.target.value) })}
        />
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">Входит в оклад, отдельно не платится</h3>
        {DUTY_GROUPS.map((g) => (
          <div key={g.title}>
            <p className="text-sm font-medium text-text">{g.title}</p>
            <ul className="mt-1 list-disc pl-5 text-sm text-muted">
              {g.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </Card>

      <Card>
        <p className="text-lg">
          На руки: <Money value={r.total} />
        </p>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <Button className="mt-3" type="button" disabled={saving} onClick={() => void save()}>
          {saving ? 'Сохранение…' : 'Сохранить месяц'}
        </Button>
      </Card>
    </div>
  )
}
