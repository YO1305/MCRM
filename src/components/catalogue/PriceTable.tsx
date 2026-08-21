import type { PriceRow } from '@/types/catalogue.types'

const COLS: { key: keyof PriceRow; label: string }[] = [
  { key: 'name', label: 'Наименование' },
  { key: 'article', label: 'Арт.' },
  { key: 'composition', label: 'Состав' },
  { key: 'width', label: 'Ширина' },
  { key: 'density', label: 'Плотность' },
  { key: 'minVolume', label: 'Мин.' },
  { key: 'unit', label: 'Ед.' },
  { key: 'price', label: 'Цена' },
  { key: 'currency', label: 'Валюта' },
  { key: 'notes', label: 'Прим.' },
]

export function PriceTable({ rows }: { rows: PriceRow[] | null | undefined }) {
  if (!rows?.length) {
    return (
      <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-muted">
        Цены по запросу
      </p>
    )
  }

  const used = COLS.filter((col) => col.key === 'name' || rows.some((r) => Boolean(r[col.key])))

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="bg-gray-50 text-xs uppercase tracking-wide text-muted">
            {used.map((c) => (
              <th key={c.key} className="px-3 py-2.5 font-semibold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.name}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/80'}>
              {used.map((c) => (
                <td key={c.key} className="px-3 py-2 text-text">
                  {row[c.key] || '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
