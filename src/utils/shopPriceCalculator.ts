export type RoundingMode = 'ceil' | 'nearest' | 'none'

export interface PriceCalcInput {
  costPrice: number
  targetMargin: number
  vatRate: number
  roundingStep: number
  roundingMode: RoundingMode
  manualPrice?: number | null
}

export interface PriceCalcOk {
  ok: true
  rawPriceIncVat: number
  recommendedPrice: number
  finalPrice: number
  priceExVat: number
  vatAmount: number
  profit: number
  actualMargin: number
  profitability: number
  belowTarget: boolean
  loss: boolean
  rounded: boolean
}

export interface PriceCalcErr {
  ok: false
  error: string
}

export type PriceCalcResult = PriceCalcOk | PriceCalcErr

export const DEFAULT_VAT_RATE = 12
export const DEFAULT_ROUNDING_STEP = 1000

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function roundPct(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function applyPriceRounding(raw: number, step: number, mode: RoundingMode): number {
  if (mode === 'none' || !(step > 0)) return raw
  const q = raw / step
  if (mode === 'nearest') return Math.round(q) * step
  return Math.ceil(q - 1e-12) * step
}

function breakdown(costPrice: number, vatRate: number, priceIncVat: number) {
  const v = vatRate / 100
  const priceExVat = priceIncVat / (1 + v)
  const vatAmount = priceIncVat - priceExVat
  const profit = priceExVat - costPrice
  const actualMargin = priceExVat > 0 ? (profit / priceExVat) * 100 : 0
  const profitability = costPrice > 0 ? (profit / costPrice) * 100 : 0
  return { priceExVat, vatAmount, profit, actualMargin, profitability }
}

export function validatePriceInputs(input: Partial<PriceCalcInput>): string | null {
  const cost = input.costPrice
  if (cost == null || !Number.isFinite(cost) || cost <= 0) {
    return 'Укажите себестоимость больше 0'
  }
  const margin = input.targetMargin
  if (margin == null || !Number.isFinite(margin)) {
    return 'Укажите желаемую маржинальность'
  }
  if (margin < 0) return 'Маржинальность не может быть отрицательной'
  if (margin >= 100) return 'Маржинальность должна быть меньше 100%'

  const vat = input.vatRate
  if (vat == null || !Number.isFinite(vat) || vat < 0) {
    return 'Ставка НДС не может быть отрицательной'
  }

  const step = input.roundingStep
  const mode = input.roundingMode || 'ceil'
  if (mode !== 'none' && (!(step != null && Number.isFinite(step)) || step <= 0)) {
    return 'Шаг округления должен быть больше 0'
  }

  if (input.manualPrice != null) {
    if (!Number.isFinite(input.manualPrice) || input.manualPrice <= 0) {
      return 'Цена продажи должна быть больше 0'
    }
  }
  return null
}

export function calculateShopPrice(input: PriceCalcInput): PriceCalcResult {
  const error = validatePriceInputs(input)
  if (error) return { ok: false, error }

  const m = input.targetMargin / 100
  const v = input.vatRate / 100
  const rawPriceIncVat = (input.costPrice / (1 - m)) * (1 + v)
  const recommendedPrice = applyPriceRounding(rawPriceIncVat, input.roundingStep, input.roundingMode)
  const rounded = input.roundingMode !== 'none' && recommendedPrice !== rawPriceIncVat
  const finalPrice =
    input.manualPrice != null && Number.isFinite(input.manualPrice) && input.manualPrice > 0
      ? input.manualPrice
      : recommendedPrice

  const parts = breakdown(input.costPrice, input.vatRate, finalPrice)
  const actualMargin = roundPct(parts.actualMargin)
  const belowTarget = actualMargin + 1e-9 < roundPct(input.targetMargin)
  const loss = parts.profit < -0.005

  return {
    ok: true,
    rawPriceIncVat,
    recommendedPrice,
    finalPrice,
    priceExVat: parts.priceExVat,
    vatAmount: parts.vatAmount,
    profit: parts.profit,
    actualMargin,
    profitability: roundPct(parts.profitability),
    belowTarget,
    loss,
    rounded,
  }
}

export function formatCalcMoney(n: number, integers = false): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: integers ? 0 : 2,
    maximumFractionDigits: integers ? 0 : 2,
  }).format(integers ? Math.round(n) : roundMoney(n))
}

export function formatCalcPct(n: number): string {
  return `${roundPct(n).toFixed(2).replace('.', ',')}%`
}
