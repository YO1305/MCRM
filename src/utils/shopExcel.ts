import { buildSaleLine, buildStockLine, marginPct, parseShopNumber } from '@/utils/shopSales'
import type { ShopAbcRow, ShopSaleLine, ShopSalesDay, ShopStockLine } from '@/types/shop.types'

function cell(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return String(value).trim()
}

function headerKey(h: string): 'article' | 'name' | 'qty' | 'cost' | 'sales' | 'price' | '' {
  const t = h.toLowerCase()
  if (t.includes('артик') || t.includes('артикул') || t === 'арт' || t.includes('sku') || t.includes('код')) {
    return 'article'
  }
  if (t.includes('наим') || t.includes('товар') || t.includes('назван') || t.includes('name')) {
    return 'name'
  }
  if (t.includes('колич') || t.includes('qty') || t === 'кол' || t.includes('шт')) {
    return 'qty'
  }
  if (t.includes('себест') || t.includes('закуп') || t.includes('cost')) {
    return 'cost'
  }
  if (t.includes('сумма продаж') || t.includes('выруч') || (t.includes('сумма') && t.includes('продаж'))) {
    return 'sales'
  }
  if (
    t.includes('стоимость продаж') ||
    t.includes('цена продаж') ||
    t.includes('рознич') ||
    (t.includes('цена') && !t.includes('себест'))
  ) {
    return 'price'
  }
  if (
    t.includes('продажа') ||
    (t.includes('сумма') && !t.includes('общ') && !t.includes('себест'))
  ) {
    return 'sales'
  }
  return ''
}

export async function parseShopSalesExcel(file: File): Promise<ShopSaleLine[]> {
  const XLSX = await import('xlsx')
  const data = new Uint8Array(await file.arrayBuffer())
  const workbook = XLSX.read(data, { type: 'array' })
  const lines: ShopSaleLine[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
    if (!json.length) continue
    const headers = (json[0] || []).map((h) => headerKey(cell(h)))
    const hasArticle = headers.includes('article')
    const hasQty = headers.includes('qty')
    const hasSales = headers.includes('sales')
    if (!hasArticle && !hasQty && !hasSales) continue

    for (let i = 1; i < json.length; i += 1) {
      const raw = json[i]
      if (!raw || !raw.some((c) => cell(c))) continue
      const row: { article: string; name: string; qty: number; unitCost: number; sales: number } = {
        article: '',
        name: '',
        qty: 0,
        unitCost: 0,
        sales: 0,
      }
      headers.forEach((key, idx) => {
        if (!key) return
        const val = raw[idx]
        if (key === 'article') row.article = cell(val)
        else if (key === 'name') row.name = cell(val)
        else if (key === 'qty') row.qty = parseShopNumber(val)
        else if (key === 'cost') row.unitCost = parseShopNumber(val)
        else if (key === 'sales' || key === 'price') row.sales = parseShopNumber(val)
      })
      if (!row.article && !row.name) continue
      if (!row.article) row.article = row.name
      if (row.qty <= 0 && row.sales <= 0) continue
      lines.push(buildSaleLine(row))
    }
  }

  return lines
}

export async function downloadShopSalesTemplate(): Promise<void> {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([
    ['Артикул', 'Название', 'Количество', 'Себестоимость', 'Сумма продажи'],
    ['BH-1001', 'Пододеяльник 200', 3, 120000, 450000],
    ['BH-2040', 'Полотно сатин', 12, 85000, 1680000],
  ])
  ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Продажи')
  XLSX.writeFile(wb, 'Шаблон_продажи_магазина.xlsx')
}

export async function downloadShopPeriodReport(opts: {
  shopName: string
  month: string
  days: ShopSalesDay[]
  abc: ShopAbcRow[]
  totals: { qty: number; cost: number; sales: number; margin: number }
}): Promise<void> {
  const XLSX = await import('xlsx')
  const pct = marginPct(opts.totals.sales, opts.totals.margin)
  const summary = XLSX.utils.aoa_to_sheet([
    ['Магазин', opts.shopName],
    ['Месяц', opts.month],
    [],
    ['Показатель', 'Значение'],
    ['Оборот (сумма продаж)', opts.totals.sales],
    ['Себестоимость', opts.totals.cost],
    ['Маржа', opts.totals.margin],
    ['Рентабельность, %', pct],
    ['Количество, шт', opts.totals.qty],
    ['Дней с отчётом', opts.days.length],
  ])
  summary['!cols'] = [{ wch: 28 }, { wch: 22 }]

  const daysSheet = XLSX.utils.aoa_to_sheet([
    ['Дата', 'Файл', 'Шт', 'Себестоимость', 'Продажи', 'Маржа', 'Кто загрузил'],
    ...opts.days.map((d) => [
      d.date,
      d.fileName,
      d.qty,
      d.cost,
      d.sales,
      d.margin,
      d.uploadedByName,
    ]),
  ])
  daysSheet['!cols'] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 10 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 20 },
  ]

  const abcSheet = XLSX.utils.aoa_to_sheet([
    ['ABC', 'Артикул', 'Название', 'Шт', 'Продажи', 'Себестоимость', 'Маржа', 'Доля, %'],
    ...opts.abc.map((row) => [
      row.abc,
      row.article,
      row.name,
      row.qty,
      row.sales,
      row.cost,
      row.margin,
      Math.round(row.share * 1000) / 10,
    ]),
  ])
  abcSheet['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 28 },
    { wch: 10 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
    { wch: 10 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, summary, 'Сводка')
  XLSX.utils.book_append_sheet(wb, daysSheet, 'Дни')
  XLSX.utils.book_append_sheet(wb, abcSheet, 'ABC')
  const safe = opts.shopName.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 40)
  XLSX.writeFile(wb, `Магазин_${safe}_${opts.month}.xlsx`)
}

export async function parseShopStockExcel(file: File): Promise<ShopStockLine[]> {
  const XLSX = await import('xlsx')
  const data = new Uint8Array(await file.arrayBuffer())
  const workbook = XLSX.read(data, { type: 'array' })
  const lines: ShopStockLine[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
    if (!json.length) continue
    const headers = (json[0] || []).map((h) => headerKey(cell(h)))
    if (!headers.includes('article') && !headers.includes('name')) continue

    for (let i = 1; i < json.length; i += 1) {
      const raw = json[i]
      if (!raw || !raw.some((c) => cell(c))) continue
      const row = { article: '', name: '', qty: 0, unitCost: 0, salePrice: 0 }
      headers.forEach((key, idx) => {
        if (!key) return
        const val = raw[idx]
        if (key === 'article') row.article = cell(val)
        else if (key === 'name') row.name = cell(val)
        else if (key === 'qty') row.qty = parseShopNumber(val)
        else if (key === 'cost') row.unitCost = parseShopNumber(val)
        else if (key === 'price' || key === 'sales') row.salePrice = parseShopNumber(val)
      })
      if (!row.article && !row.name) continue
      if (!row.article) row.article = row.name
      if (row.qty <= 0 && row.unitCost <= 0 && row.salePrice <= 0) continue
      lines.push(buildStockLine(row))
    }
  }

  return lines
}

export async function downloadShopStockTemplate(): Promise<void> {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([
    ['Артикул', 'Название', 'Количество', 'Себестоимость', 'Стоимость продажи'],
    ['BH-1001', 'Пододеяльник 200', 8, 120000, 150000],
    ['BH-2040', 'Полотно сатин', 20, 85000, 140000],
  ])
  ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 20 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Остатки')
  XLSX.writeFile(wb, 'Шаблон_остатки_магазина.xlsx')
}
