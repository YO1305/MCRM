import * as XLSX from 'xlsx'
import type { PriceRow } from '@/types/catalogue.types'

function cell(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return String(value).trim()
}

export function parseExcelPrices(file: File): Promise<PriceRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const rows: PriceRow[] = []

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
          const headers = (json[0] || []).map((h) => cell(h).toLowerCase())

          for (let i = 1; i < json.length; i++) {
            const raw = json[i]
            if (!raw || !raw.some((c) => cell(c))) continue

            const priceRow: PriceRow = { name: '' }
            headers.forEach((h, idx) => {
              const val = cell(raw[idx])
              if (!val) return
              if (h.includes('наим') || h.includes('name') || h.includes('товар') || h.includes('продук')) {
                priceRow.name = val
              } else if (h.includes('артик') || h.includes('код') || h === 'арт' || h.includes('арт.')) {
                priceRow.article = val
              } else if (h.includes('состав') || h.includes('composition')) {
                priceRow.composition = val
              } else if (h.includes('ширин') || h.includes('width')) {
                priceRow.width = val
              } else if (h.includes('плотн') || h.includes('density') || h.includes('г/м')) {
                priceRow.density = val
              } else if (h.includes('мин') || h.includes('min') || h.includes('объём') || h.includes('объем')) {
                priceRow.minVolume = val
              } else if (h.includes('ед') || h.includes('unit')) {
                priceRow.unit = val
              } else if (h.includes('цена') || h.includes('price') || h.includes('стоим')) {
                priceRow.price = val
              } else if (h.includes('валют') || h.includes('currency')) {
                priceRow.currency = val
              } else if (h.includes('прим') || h.includes('note')) {
                priceRow.notes = val
              }
            })

            if (!priceRow.name) priceRow.name = cell(raw[0])
            if (priceRow.name) rows.push(priceRow)
          }
        }

        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Не удалось прочитать Excel'))
    reader.readAsArrayBuffer(file)
  })
}
