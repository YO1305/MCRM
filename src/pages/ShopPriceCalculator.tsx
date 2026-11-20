import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { useShopCalculatorSettings } from '@/hooks/useShopCalculatorSettings'
import { parseShopNumber } from '@/utils/shopSales'
import {
  calculateShopPrice,
  formatCalcMoney,
  formatCalcPct,
  type RoundingMode,
} from '@/utils/shopPriceCalculator'

const ROUNDING_OPTIONS: { id: RoundingMode; label: string }[] = [
  { id: 'ceil', label: 'Вверх до шага' },
  { id: 'nearest', label: 'Как в Excel (ближайшая)' },
  { id: 'none', label: 'Без округления' },
]

export function ShopPriceCalculator() {
  const { isRealAdmin } = useAuth()
  const { settings, loading, saving, canEdit, saveSettings } = useShopCalculatorSettings()
  const [costText, setCostText] = useState('')
  const [marginText, setMarginText] = useState('20')
  const [vatText, setVatText] = useState('')
  const [stepText, setStepText] = useState('')
  const [roundingMode, setRoundingMode] = useState<RoundingMode>('ceil')
  const [manualText, setManualText] = useState('')
  const [manualOn, setManualOn] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const vatRate = canEdit && vatText !== '' ? parseShopNumber(vatText) : settings.vatRate
  const roundingStep = stepText === '' ? settings.roundingStep : parseShopNumber(stepText)
  const costPrice = costText === '' ? NaN : parseShopNumber(costText)
  const targetMargin = marginText === '' ? NaN : parseShopNumber(marginText)
  const manualPrice = manualOn && manualText !== '' ? parseShopNumber(manualText) : null

  const result = useMemo(
    () =>
      calculateShopPrice({
        costPrice,
        targetMargin,
        vatRate,
        roundingStep,
        roundingMode,
        manualPrice,
      }),
    [costPrice, targetMargin, vatRate, roundingStep, roundingMode, manualPrice],
  )

  async function handleSaveRates() {
    setSaveMsg('')
    try {
      await saveSettings({ vatRate, roundingStep })
      setSaveMsg('Ставка НДС и шаг округления сохранены')
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Не удалось сохранить')
    }
  }

  function resetManual() {
    setManualOn(false)
    setManualText('')
  }

  const showIntegerPrice = roundingMode !== 'none' && !manualOn

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/shops" className="text-sm text-secondary hover:underline">
            ← К магазинам
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-text">
            <Calculator size={24} />
            Калькулятор цен
          </h1>
          <p className="mt-1 text-sm text-muted">
            Себестоимость уже итоговая. Цена считается от заданной маржи, НДС выделяется из цены
            продажи. Калькулятор сам цены в каталоге не меняет.
          </p>
        </div>
      </div>

      <Card className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Себестоимость, сум"
            name="calc-cost"
            inputMode="decimal"
            placeholder="180 902,28"
            value={costText}
            onChange={(e) => setCostText(e.target.value)}
          />
          <Input
            label="Желаемая маржинальность, %"
            name="calc-margin"
            inputMode="decimal"
            placeholder="20"
            value={marginText}
            onChange={(e) => setMarginText(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="НДС, %"
            name="calc-vat"
            inputMode="decimal"
            disabled={!canEdit}
            value={vatText === '' ? String(settings.vatRate) : vatText}
            onChange={(e) => setVatText(e.target.value)}
          />
          <Input
            label="Шаг округления, сум"
            name="calc-step"
            inputMode="decimal"
            value={stepText === '' ? String(settings.roundingStep) : stepText}
            onChange={(e) => setStepText(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">Округление</span>
            <select
              className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm"
              value={roundingMode}
              onChange={(e) => setRoundingMode(e.target.value as RoundingMode)}
            >
              {ROUNDING_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {isRealAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={saving || loading} onClick={handleSaveRates}>
              {saving ? 'Сохранение...' : 'Сохранить НДС и шаг'}
            </Button>
            {saveMsg && <p className="text-sm text-muted">{saveMsg}</p>}
          </div>
        )}
        {!isRealAdmin && (
          <p className="text-xs text-muted">НДС {settings.vatRate}% задаёт администратор.</p>
        )}
      </Card>

      {!result.ok ? (
        <Card>
          <p className="text-sm text-muted">{result.error}</p>
        </Card>
      ) : (
        <>
          {result.belowTarget && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Маржинальность ниже заданной
            </p>
          )}
          {result.loss && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">Продажа в убыток</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <p className="text-xs uppercase text-muted">Цена продажи с НДС</p>
              <p className="mt-1 text-2xl font-bold text-text">
                {formatCalcMoney(result.finalPrice, showIntegerPrice)}
              </p>
            </Card>
            <Card>
              <p className="text-xs uppercase text-muted">Прибыль с 1 шт</p>
              <p className="mt-1 text-2xl font-bold text-text">{formatCalcMoney(result.profit)}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase text-muted">Факт. маржа</p>
              <p className="mt-1 text-2xl font-bold text-text">{formatCalcPct(result.actualMargin)}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase text-muted">Рентабельность</p>
              <p className="mt-1 text-2xl font-bold text-text">{formatCalcPct(result.profitability)}</p>
            </Card>
          </div>

          <Card className="space-y-3">
            <h2 className="text-base font-semibold text-text">Разбивка</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Себестоимость</dt>
                <dd>{formatCalcMoney(costPrice)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Цена без НДС</dt>
                <dd>{formatCalcMoney(result.priceExVat)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">НДС в сумах</dt>
                <dd>{formatCalcMoney(result.vatAmount)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Цена с НДС до округления</dt>
                <dd>{formatCalcMoney(result.rawPriceIncVat)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Рекомендуемая цена</dt>
                <dd className="font-medium">{formatCalcMoney(result.recommendedPrice, roundingMode !== 'none')}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Окончательная цена</dt>
                <dd className="font-medium">{formatCalcMoney(result.finalPrice, showIntegerPrice)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Прибыль</dt>
                <dd>{formatCalcMoney(result.profit)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-base font-semibold text-text">Своя цена продажи с НДС</h2>
            <p className="text-xs text-muted">
              Целевая маржа {formatCalcPct(targetMargin)} остаётся ориентиром. Показатели
              пересчитаются по введённой цене.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <Input
                label="Цена с НДС, сум"
                name="calc-manual"
                inputMode="decimal"
                placeholder={formatCalcMoney(result.recommendedPrice, roundingMode !== 'none')}
                value={manualOn ? manualText : ''}
                onChange={(e) => {
                  setManualOn(true)
                  setManualText(e.target.value)
                }}
              />
              <Button type="button" variant="ghost" size="sm" disabled={!manualOn} onClick={resetManual}>
                <RotateCcw size={14} />
                Вернуть рекомендуемую цену
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
