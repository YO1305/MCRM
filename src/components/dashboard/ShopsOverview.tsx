import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAllShopSales, useShops } from '@/hooks/useShops'
import { getCurrentMonth } from '@/utils/dates'
import { formatShopMoney, marginPct } from '@/utils/shopSales'

export function ShopsOverview() {
  const { shops, loading: shopsLoading } = useShops()
  const { days, loading: daysLoading } = useAllShopSales()
  const [month, setMonth] = useState(getCurrentMonth())

  const rows = useMemo(() => {
    return shops.map((shop) => {
      const shopDays = days.filter((d) => d.shopId === shop.id && d.date.startsWith(month))
      const sales = shopDays.reduce((s, d) => s + (d.sales || 0), 0)
      const margin = shopDays.reduce((s, d) => s + (d.margin || 0), 0)
      const qty = shopDays.reduce((s, d) => s + (d.qty || 0), 0)
      return { shop, sales, margin, qty, days: shopDays.length }
    })
  }, [shops, days, month])

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.sales += row.sales
          acc.margin += row.margin
          acc.qty += row.qty
          return acc
        },
        { sales: 0, margin: 0, qty: 0 },
      ),
    [rows],
  )

  if (shopsLoading) return null

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">Магазины сети</h2>
          <p className="mt-0.5 text-sm text-muted">
            Общий оборот и переход в карточку магазина.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            type="month"
            label="Месяц"
            name="dash-shop-month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <Link to="/shops" className="text-sm font-medium text-secondary hover:underline">
            Все магазины
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-muted">Оборот сети</p>
          <p className="mt-1 text-2xl font-bold text-text">{formatShopMoney(totals.sales)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted">Маржа</p>
          <p className="mt-1 text-2xl font-bold text-text">{formatShopMoney(totals.margin)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted">Рентабельность</p>
          <p className="mt-1 text-2xl font-bold text-text">{marginPct(totals.sales, totals.margin)}%</p>
        </div>
      </div>

      {shops.length === 0 ? (
        <p className="text-sm text-muted">
          Магазинов ещё нет.{' '}
          <Link to="/shops" className="text-secondary hover:underline">
            Создать
          </Link>
        </p>
      ) : daysLoading && !days.length ? (
        <p className="text-sm text-muted">Загрузка продаж...</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((row) => (
            <li key={row.shop.id}>
              <Link
                to={`/shops/${row.shop.id}`}
                className="flex items-center justify-between gap-3 py-2.5 hover:bg-background"
              >
                <div>
                  <p className="text-sm font-medium text-text">{row.shop.name}</p>
                  <p className="text-xs text-muted">
                    {row.days} дн. с отчётом · {formatShopMoney(row.qty)} шт
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-text">{formatShopMoney(row.sales)}</p>
                  <p className="text-xs text-muted">маржа {formatShopMoney(row.margin)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
