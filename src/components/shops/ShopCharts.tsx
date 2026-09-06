import { formatShopMoney } from '@/utils/shopSales'
import type { AbcClass } from '@/types/shop.types'

const ABC_COLOR: Record<AbcClass, string> = {
  A: '#16a34a',
  B: '#d97706',
  C: '#94a3b8',
}

export function ShopSalesBars({
  points,
}: {
  points: { date: string; sales: number; margin: number }[]
}) {
  if (!points.length) {
    return <p className="text-sm text-muted">Нет данных за выбранный период.</p>
  }
  const max = Math.max(...points.map((p) => p.sales), 1)
  const w = Math.max(320, points.length * 28)
  const h = 180
  const barW = Math.max(6, Math.min(18, (w - 40) / points.length - 4))

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 min-w-full" role="img" aria-label="Продажи по дням">
        {points.map((p, i) => {
          const x = 28 + i * ((w - 40) / points.length)
          const salesH = (p.sales / max) * 130
          const marginH = (Math.max(0, p.margin) / max) * 130
          return (
            <g key={p.date}>
              <rect x={x} y={150 - salesH} width={barW} height={salesH} rx="2" fill="#1d4ed8" opacity="0.85" />
              <rect x={x} y={150 - marginH} width={Math.max(3, barW / 2)} height={marginH} rx="2" fill="#16a34a" />
              {points.length <= 16 && (
                <text x={x + barW / 2} y={168} textAnchor="middle" className="fill-muted" fontSize="8">
                  {p.date.slice(8)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="flex gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-blue-700" /> Оборот
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-green-600" /> Маржа
        </span>
        <span>макс. {formatShopMoney(max)}</span>
      </div>
    </div>
  )
}

export function ShopAbcDonut({
  sales,
}: {
  sales: Record<AbcClass, number>
}) {
  const total = sales.A + sales.B + sales.C
  if (total <= 0) return <p className="text-sm text-muted">Нет ABC за период.</p>
  const parts: AbcClass[] = ['A', 'B', 'C']
  let angle = -Math.PI / 2
  const r = 46
  const cx = 60
  const cy = 60
  const arcs = parts.map((cls) => {
    const share = sales[cls] / total
    const next = angle + share * Math.PI * 2
    const large = share > 0.5 ? 1 : 0
    const x1 = cx + r * Math.cos(angle)
    const y1 = cy + r * Math.sin(angle)
    const x2 = cx + r * Math.cos(next)
    const y2 = cy + r * Math.sin(next)
    const d = share === 0 ? '' : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
    angle = next
    return { cls, d, share }
  })

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 120" className="h-28 w-28" role="img" aria-label="ABC по продажам">
        {arcs.map((a) =>
          a.d ? <path key={a.cls} d={a.d} fill={ABC_COLOR[a.cls]} /> : null,
        )}
        <circle cx={cx} cy={cy} r="24" fill="white" />
      </svg>
      <ul className="space-y-1 text-sm">
        {parts.map((cls) => (
          <li key={cls} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ABC_COLOR[cls] }} />
            <span className="font-medium">{cls}</span>
            <span className="text-muted">
              {total ? Math.round((sales[cls] / total) * 1000) / 10 : 0}% · {formatShopMoney(sales[cls])}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
