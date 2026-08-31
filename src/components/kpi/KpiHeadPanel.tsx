import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CertChecks, Money, NumField } from '@/components/kpi/KpiFields'
import { HEAD_KPI_FUND, HEAD_SALARY, calcHead, formatPct } from '@/constants/kpiDeptPayroll'
import { useKpiDeptPayroll } from '@/hooks/useKpiDeptPayroll'
import { useHeadKpiLinks } from '@/hooks/useHeadKpiLinks'
import type { DutyStatus, HeadPayrollInput, TeamLeadPcts } from '@/types/kpiDeptPayroll.types'

export function KpiHeadPanel({ month }: { month: string }) {
  const { head, setHead, loading, saving, error, save } = useKpiDeptPayroll('head', month)
  const links = useHeadKpiLinks(month)

  const teamLeads: TeamLeadPcts = {
    ...head.teamLeads,
    ...(head.teamLeadsManual ? {} : links.linkedLeads),
  }
  const certificates = head.certificatesManual || !links.assistantSaved ? head.certificates : links.linkedCerts
  const r = calcHead({ ...head, teamLeads, certificates })

  function patch(partial: Partial<HeadPayrollInput>) {
    setHead((prev) => ({ ...prev, ...partial }))
  }

  const leadsLocked = !head.teamLeadsManual && (links.aygulSaved || links.kunduzSaved)
  const certsLocked = !head.certificatesManual && links.assistantSaved

  if (loading || links.loading) return <p className="text-sm text-muted">Загрузка…</p>

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="text-base font-semibold">Начальник отдела маркетинга</h2>
        <p className="text-sm text-muted">
          Оклад {HEAD_SALARY} · фонд KPI {HEAD_KPI_FUND} тыс сум. Итог = фикса + KPI + выставки + 30%
          сертификатов.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumField
            label="Рабочих дней, план"
            value={head.daysPlan}
            onChange={(e) => patch({ daysPlan: Number(e.target.value) })}
          />
          <NumField
            label="Рабочих дней, факт"
            value={head.daysFact}
            onChange={(e) => patch({ daysFact: Number(e.target.value) })}
          />
        </div>
        <p>
          Фикса: <Money value={r.fixa} />
        </p>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">1. Вклад в результат компании · вес 35%</h3>
        <p className="text-xs text-muted">
          0,6 × % общего плана + 0,2 × % доли Европы + 0,2 × % доли ГП. Данные коммерческого директора.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumField
            label="Бизнес-план, план"
            value={head.company.bizPlan}
            onChange={(e) =>
              patch({ company: { ...head.company, bizPlan: Number(e.target.value) } })
            }
          />
          <NumField
            label="Бизнес-план, факт"
            value={head.company.bizFact}
            onChange={(e) =>
              patch({ company: { ...head.company, bizFact: Number(e.target.value) } })
            }
          />
          <NumField
            label="Доля Европы, план (0–1)"
            value={head.company.europePlan}
            onChange={(e) =>
              patch({ company: { ...head.company, europePlan: Number(e.target.value) } })
            }
          />
          <NumField
            label="Доля Европы, факт (0–1)"
            value={head.company.europeFact}
            onChange={(e) =>
              patch({ company: { ...head.company, europeFact: Number(e.target.value) } })
            }
          />
          <NumField
            label="Доля ГП, план (0–1)"
            value={head.company.gpPlan}
            onChange={(e) => patch({ company: { ...head.company, gpPlan: Number(e.target.value) } })}
          />
          <NumField
            label="Доля ГП, факт (0–1)"
            value={head.company.gpFact}
            onChange={(e) => patch({ company: { ...head.company, gpFact: Number(e.target.value) } })}
          />
        </div>
        <p className="text-sm">
          Свёртка {formatPct(r.companyScore)} · коэф. {r.companyCoeff} ·{' '}
          <Money value={r.companyPay} />
        </p>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">2. Подзадачи проектов в срок · вес 30%</h3>
        <NumField
          label="% выполнения (0–1, например 1 = 100%)"
          value={head.milestonesPct}
          onChange={(e) => patch({ milestonesPct: Number(e.target.value) })}
        />
        <p className="text-sm">
          Коэф. {r.mileCoeff} · <Money value={r.milePay} />
        </p>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">3. Лиды команды · вес 35%</h3>
        <p className="text-xs text-muted">
          Если на вкладке Айгуль / Кундуз месяц сохранён — проценты подтягиваются сами (факт ÷ план:
          ткань 5, ГП 5, Европа 3). Если не сохранено — вводите вручную.
        </p>
        <p className="text-xs text-muted">
          Айгуль: {links.aygulSaved ? 'сохранено, берём оттуда' : 'нет сохранения — вручную'}. Кундуз:{' '}
          {links.kunduzSaved ? 'сохранено, берём оттуда' : 'нет сохранения — вручную'}.
        </p>
        {(links.aygulSaved || links.kunduzSaved) && (
          <button
            type="button"
            className="text-xs text-secondary underline"
            onClick={() => patch({ teamLeadsManual: !head.teamLeadsManual })}
          >
            {head.teamLeadsManual ? 'Снова брать из команды' : 'Править лиды вручную'}
          </button>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['aygulFabric', 'Айгуль · ткань', links.aygulSaved],
              ['aygulGp', 'Айгуль · ГП', links.aygulSaved],
              ['aygulEurope', 'Айгуль · Европа', links.aygulSaved],
              ['kunduzFabric', 'Кундуз · ткань', links.kunduzSaved],
              ['kunduzGp', 'Кундуз · ГП', links.kunduzSaved],
              ['kunduzEurope', 'Кундуз · Европа', links.kunduzSaved],
            ] as const
          ).map(([key, label, linked]) => (
            <NumField
              key={key}
              label={label}
              disabled={leadsLocked && linked}
              value={teamLeads[key]}
              onChange={(e) =>
                patch({ teamLeads: { ...teamLeads, [key]: Number(e.target.value) } })
              }
            />
          ))}
        </div>
        <p className="text-sm">
          Среднее {formatPct(r.teamAvg)} · коэф. {r.teamCoeff} · <Money value={r.teamPay} />
        </p>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">KPI фонд</h3>
        <p>
          Итого KPI: <Money value={r.kpiTotal} />
        </p>
        <p className="text-xs text-muted">
          Ступени: &lt;60% → 0 · 60% → 0,5 · 70% → 0,8 · 90–100% → 1,0 · &gt;100% → 1,2 · ≥110% → 1,5.
          Ровно 100% = коэффициент 1,0.
        </p>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">Выставки (доплата, не в фонде KPI)</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-1">Выставка</th>
                <th>Тип</th>
                <th>Проведено</th>
                <th>Бонус</th>
              </tr>
            </thead>
            <tbody>
              {head.exhibitions.map((row, i) => (
                <tr key={row.id} className="border-t border-gray-50">
                  <td className="py-2">{row.name}</td>
                  <td>{row.type === 'international' ? 'Международная · 3500' : 'Региональная · 1500'}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.done}
                      onChange={(e) => {
                        const next = head.exhibitions.map((x, idx) =>
                          idx === i ? { ...x, done: e.target.checked } : x,
                        )
                        patch({ exhibitions: next })
                      }}
                    />
                  </td>
                  <td>
                    <Money value={row.done ? (row.type === 'international' ? 3500 : 1500) : 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          За выставки: <Money value={r.expo} />
        </p>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">Сертификаты · доля начальника 30%</h3>
        <p className="text-xs text-muted">
          {certsLocked
            ? 'Взято с вкладки ассистента (у него 70%, у вас 30% тех же сертификатов).'
            : 'Сохраните вкладку ассистента — отметки подтянутся сюда. Пока можно отметить вручную.'}
        </p>
        {links.assistantSaved && (
          <button
            type="button"
            className="text-xs text-secondary underline"
            onClick={() => patch({ certificatesManual: !head.certificatesManual })}
          >
            {head.certificatesManual ? 'Снова брать у ассистента' : 'Править сертификаты вручную'}
          </button>
        )}
        <CertChecks
          value={certificates}
          disabled={certsLocked}
          onChange={(next) => patch({ certificates: next })}
        />
        <p>
          Начислено: <Money value={r.certs} />
        </p>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">Обязанности (в окладе, не премируются)</h3>
        {head.duties.map((d, i) => (
          <div key={d.id} className="rounded-lg border border-gray-100 p-3">
            <p className="text-sm text-text">{d.title}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(['yes', 'partial', 'no'] as DutyStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`rounded-lg px-2 py-1 text-xs ${
                    d.status === s ? 'bg-secondary text-white' : 'bg-background text-muted'
                  }`}
                  onClick={() => {
                    const duties = head.duties.map((x, idx) => (idx === i ? { ...x, status: s } : x))
                    patch({ duties })
                  }}
                >
                  {s === 'yes' ? 'Да' : s === 'partial' ? 'Частично' : 'Нет'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <Card>
        <p className="text-lg">
          На руки: <Money value={r.total} />
        </p>
        <p className="mt-1 text-xs text-muted">
          Пример: фикса {HEAD_SALARY} + KPI до {HEAD_KPI_FUND} × 1,5 + выставки.
        </p>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <Button
          className="mt-3"
          type="button"
          disabled={saving}
          onClick={() => void save({ ...head, teamLeads, certificates })}
        >
          {saving ? 'Сохранение…' : 'Сохранить месяц'}
        </Button>
      </Card>
    </div>
  )
}
