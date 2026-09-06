import { Badge } from '@/components/ui/Badge'
import type { ShopAbcRow } from '@/types/shop.types'
import { formatShopMoney } from '@/utils/shopSales'

function abcBadge(abc: ShopAbcRow['abc']) {
  if (abc === 'A') return <Badge variant="success">A</Badge>
  if (abc === 'B') return <Badge variant="warning">B</Badge>
  return <Badge>C</Badge>
}

export function ShopAbcTable({
  title,
  rows,
  empty,
}: {
  title: string
  rows: ShopAbcRow[]
  empty: string
}) {
  return (
    <div className="overflow-x-auto">
      <h3 className="mb-2 text-sm font-semibold text-text">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs uppercase text-muted">
              <th className="px-2 py-2">ABC</th>
              <th className="px-2 py-2">Артикул</th>
              <th className="px-2 py-2">Товар</th>
              <th className="px-2 py-2 text-right">Шт</th>
              <th className="px-2 py-2 text-right">Продажи</th>
              <th className="px-2 py-2 text-right">Маржа</th>
              <th className="px-2 py-2 text-right">Доля</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.article}-${row.name}-${row.abc}`} className="border-b border-gray-50">
                <td className="px-2 py-2">{abcBadge(row.abc)}</td>
                <td className="px-2 py-2 font-medium text-text">{row.article}</td>
                <td className="px-2 py-2 text-muted">{row.name || '—'}</td>
                <td className="px-2 py-2 text-right">{formatShopMoney(row.qty)}</td>
                <td className="px-2 py-2 text-right">{formatShopMoney(row.sales)}</td>
                <td className="px-2 py-2 text-right">{formatShopMoney(row.margin)}</td>
                <td className="px-2 py-2 text-right">{Math.round(row.share * 1000) / 10}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
