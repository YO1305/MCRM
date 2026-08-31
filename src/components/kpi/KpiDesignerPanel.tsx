import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Money, NumField } from '@/components/kpi/KpiFields'
import { DESIGNER_SALARY, calcDesigner, formatPct } from '@/constants/kpiDeptPayroll'
import { useKpiDeptPayroll } from '@/hooks/useKpiDeptPayroll'
import type { DesignerPayrollInput } from '@/types/kpiDeptPayroll.types'

export function KpiDesignerPanel({ month }: { month: string }) {
  const { designer, setDesigner, loading, saving, error, save } = useKpiDeptPayroll('designer', month)
  const r = calcDesigner(designer)

  function patch(partial: Partial<DesignerPayrollInput>) {
    setDesigner((prev) => ({ ...prev, ...partial }))
  }

  if (loading) return <p className="text-sm text-muted">Загрузка…</p>

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="text-base font-semibold">Графический дизайнер</h2>
        <p className="text-sm text-muted">
          Нет фонда KPI и ступеней. Оклад {DESIGNER_SALARY} + сдельные доплаты. Ролики и каталог — за
          штуку без потолка. Маркетплейс и сайт — тариф × % выполнения плана.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumField
            label="Рабочих дней, план"
            value={designer.daysPlan}
            onChange={(e) => patch({ daysPlan: Number(e.target.value) })}
          />
          <NumField
            label="Рабочих дней, факт"
            value={designer.daysFact}
            onChange={(e) => patch({ daysFact: Number(e.target.value) })}
          />
        </div>
        <p>
          Оклад: <Money value={r.fixa} />
        </p>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">Ролики для монитора · 100 / шт · план 10</h3>
        <NumField
          label="Факт, шт"
          value={designer.videos}
          onChange={(e) => patch({ videos: Number(e.target.value) })}
        />
        <p>
          <Money value={r.videosPay} />
        </p>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">Каталог · 1 000 / шт · план 1</h3>
        <NumField
          label="Факт, шт"
          value={designer.catalogs}
          onChange={(e) => patch({ catalogs: Number(e.target.value) })}
        />
        <p>
          <Money value={r.catalogPay} />
        </p>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">Маркетплейс · 1 000 × % плана · план 15 карточек</h3>
        <NumField
          label="Факт, карточек"
          value={designer.mpCards}
          onChange={(e) => patch({ mpCards: Number(e.target.value) })}
        />
        <p>
          {formatPct(r.mpRatio)} · <Money value={r.mpPay} />
        </p>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">Сайт bahmal.uz · 1 000 × средний % двух разделов</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumField
            label="Новости (план 4)"
            value={designer.siteNews}
            onChange={(e) => patch({ siteNews: Number(e.target.value) })}
          />
          <NumField
            label="Продукты (план 2)"
            value={designer.siteProducts}
            onChange={(e) => patch({ siteProducts: Number(e.target.value) })}
          />
        </div>
        <p>
          Новости {formatPct(r.newsRatio)} · продукты {formatPct(r.productsRatio)} · среднее{' '}
          {formatPct(r.siteRatio)} · <Money value={r.sitePay} />
        </p>
      </Card>

      <Card>
        <p>
          Доп. касса: <Money value={r.extra} />
        </p>
        <p className="mt-2 text-lg">
          На руки: <Money value={r.total} />
        </p>
        <p className="mt-2 text-xs text-muted">
          В оклад входят: 3D и индивидуальные проекты, подготовка к выставкам, бирки/баннеры/флаеры,
          инфографика МП, актуальность каталога.
        </p>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <Button className="mt-3" type="button" disabled={saving} onClick={() => void save()}>
          {saving ? 'Сохранение…' : 'Сохранить месяц'}
        </Button>
      </Card>
    </div>
  )
}
