import type { AbcClass, ShopAbcRow, ShopSaleLine, ShopSalesDay } from '@/types/shop.types'

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

export function abcAnalysis(lines: ShopSaleLine[]): ShopAbcRow[] {
  const totalSales = lines.reduce((s, l) => s + l.sales, 0)
  const sorted = [...lines].sort((a, b) => b.sales - a.sales)
  let cum = 0
  return sorted.map((line) => {
    cum += line.sales
    const share = totalSales > 0 ? line.sales / totalSales : 0
    const cumShare = totalSales > 0 ? cum / totalSales : 0
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

export function salesDayId(shopId: string, date: string): string {
  return `${shopId}_${date}`
}
