import type {
  AbcClass,
  ShopAbcRow,
  ShopPeriod,
  ShopSaleLine,
  ShopSalesDay,
  ShopStockLine,
} from '@/types/shop.types'

export function parseShopNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = String(value ?? '')
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '')
    .replace(',', '.')
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

export function buildSaleLine(input: {
  article: string
  name?: string
  qty: number
  unitCost: number
  sales: number
}): ShopSaleLine {
  const qty = Math.max(0, input.qty)
  const unitCost = Math.max(0, input.unitCost)
  const sales = Math.max(0, input.sales)
  const cost = Math.round(qty * unitCost * 100) / 100
  return {
    article: input.article.trim(),
    name: (input.name || '').trim(),
    qty,
    unitCost,
    sales,
    cost,
    margin: Math.round((sales - cost) * 100) / 100,
  }
}

export function totalsOf(lines: ShopSaleLine[]) {
  return lines.reduce(
    (acc, line) => {
      acc.qty += line.qty
      acc.cost += line.cost
      acc.sales += line.sales
      acc.margin += line.margin
      return acc
    },
    { qty: 0, cost: 0, sales: 0, margin: 0 },
  )
}

export function marginPct(sales: number, margin: number): number {
  if (sales <= 0) return 0
  return Math.round((margin / sales) * 1000) / 10
}

export function formatShopMoney(n: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n || 0))
}

export function aggregateLines(days: ShopSalesDay[]): ShopSaleLine[] {
  const map = new Map<string, ShopSaleLine>()
  for (const day of days) {
    for (const line of day.lines || []) {
      const key = `${line.article}||${line.name}`.toLowerCase()
      const prev = map.get(key)
      if (!prev) {
        map.set(key, { ...line })
        continue
      }
      prev.qty += line.qty
      prev.cost += line.cost
      prev.sales += line.sales
      prev.margin += line.margin
      if (!prev.name && line.name) prev.name = line.name
    }
  }
  return [...map.values()]
}

export function abcAnalysis(
  lines: ShopSaleLine[],
  metric: 'sales' | 'margin' = 'sales',
): ShopAbcRow[] {
  const total = lines.reduce((s, l) => s + Math.max(0, l[metric]), 0)
  const sorted = [...lines].sort((a, b) => b[metric] - a[metric])
  let cum = 0
  return sorted.map((line) => {
    const value = Math.max(0, line[metric])
    cum += value
    const share = total > 0 ? value / total : 0
    const cumShare = total > 0 ? cum / total : 0
    let abc: AbcClass = 'C'
    if (cumShare <= 0.8 || share >= 0.8) abc = 'A'
    else if (cumShare <= 0.95) abc = 'B'
    return {
      article: line.article,
      name: line.name,
      qty: line.qty,
      sales: line.sales,
      cost: line.cost,
      margin: line.margin,
      share,
      abc,
    }
  })
}

export function abcTotals(rows: ShopAbcRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc[row.abc] += 1
      acc.sales[row.abc] += row.sales
      acc.margin[row.abc] += row.margin
      return acc
    },
    {
      A: 0,
      B: 0,
      C: 0,
      sales: { A: 0, B: 0, C: 0 },
      margin: { A: 0, B: 0, C: 0 },
    },
  )
}

export function filterDaysByPeriod(days: ShopSalesDay[], period: ShopPeriod): ShopSalesDay[] {
  if (period.mode === 'day') return days.filter((d) => d.date === period.day)
  if (period.mode === 'month') return days.filter((d) => d.date.startsWith(period.month))
  const from = period.from || period.to
  const to = period.to || period.from
  if (!from) return days
  return days.filter((d) => d.date >= from && d.date <= (to || from))
}

export function dailySeries(days: ShopSalesDay[]) {
  return [...days]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((d) => ({
      date: d.date,
      sales: d.sales,
      cost: d.cost,
      margin: d.margin,
      qty: d.qty,
    }))
}

export function periodLabel(period: ShopPeriod): string {
  if (period.mode === 'day') return period.day
  if (period.mode === 'month') {
    const [y, m] = period.month.split('-').map(Number)
    return new Date(y, (m || 1) - 1, 1).toLocaleDateString('ru-RU', {
      month: 'long',
      year: 'numeric',
    })
  }
  if (period.from && period.to && period.from !== period.to) return `${period.from} — ${period.to}`
  return period.from || period.to || 'период'
}

export function buildStockLine(input: {
  article: string
  name?: string
  qty: number
  unitCost: number
  salePrice: number
}): ShopStockLine {
  const qty = Math.max(0, input.qty)
  const unitCost = Math.max(0, input.unitCost)
  const salePrice = Math.max(0, input.salePrice)
  const cost = Math.round(qty * unitCost * 100) / 100
  const saleValue = Math.round(qty * salePrice * 100) / 100
  return {
    article: input.article.trim(),
    name: (input.name || '').trim(),
    qty,
    unitCost,
    salePrice,
    cost,
    saleValue,
    margin: Math.round((saleValue - cost) * 100) / 100,
  }
}

export function stockTotals(lines: ShopStockLine[]) {
  return lines.reduce(
    (acc, line) => {
      acc.qty += line.qty
      acc.cost += line.cost
      acc.saleValue += line.saleValue
      acc.margin += line.margin
      return acc
    },
    { qty: 0, cost: 0, saleValue: 0, margin: 0 },
  )
}

export function salesDayId(shopId: string, date: string): string {
  return `${shopId}_${date}`
}

export function defaultShopPeriod(today = ''): ShopPeriod {
  const day = today
  const month = day.slice(0, 7)
  return { mode: 'month', day, month, from: `${month}-01`, to: day }
}
