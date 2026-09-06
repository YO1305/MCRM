import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, MapPin, Trash2, Upload } from 'lucide-react'
import { ShopAbcTable } from '@/components/shops/ShopAbcTable'
import { ShopAbcDonut, ShopSalesBars } from '@/components/shops/ShopCharts'
import { ShopForm } from '@/components/shops/ShopForm'
import { ShopPeriodBar } from '@/components/shops/ShopPeriodBar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useShopSales, useShopStock, useShops } from '@/hooks/useShops'
import type { ShopInput, ShopPeriod } from '@/types/shop.types'
import { todayISO } from '@/utils/dates'
import {
  downloadShopPeriodReport,
  downloadShopSalesTemplate,
  downloadShopStockTemplate,
  parseShopSalesExcel,
  parseShopStockExcel,
} from '@/utils/shopExcel'
import {
  abcAnalysis,
  abcTotals,
  aggregateLines,
  dailySeries,
  defaultShopPeriod,
  filterDaysByPeriod,
  formatShopMoney,
  marginPct,
  periodLabel,
  totalsOf,
} from '@/utils/shopSales'

type ShopTab = 'dashboard' | 'reports' | 'stock' | 'card'

const TABS: { id: ShopTab; label: string }[] = [
  { id: 'dashboard', label: 'Дашборд' },
  { id: 'reports', label: 'Загрузить отчёт' },
  { id: 'stock', label: 'Остатки' },
  { id: 'card', label: 'Карточка' },
]

export function ShopDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { shops, loading: shopsLoading, updateShop, removeShop } = useShops()
  const { days, loading: daysLoading, upsertDay, deleteDay } = useShopSales(id)
  const { stock, loading: stockLoading, saveStock } = useShopStock(id)
  const shop = shops.find((s) => s.id === id)

  const [tab, setTab] = useState<ShopTab>('dashboard')
  const [period, setPeriod] = useState<ShopPeriod>(() => defaultShopPeriod(todayISO()))
  const [reportDate, setReportDate] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const stockRef = useRef<HTMLInputElement>(null)

  const periodDays = useMemo(() => filterDaysByPeriod(days, period), [days, period])
  const lines = useMemo(() => aggregateLines(periodDays), [periodDays])
  const totals = useMemo(() => totalsOf(lines), [lines])
  const abcSales = useMemo(() => abcAnalysis(lines, 'sales'), [lines])
  const abcMargin = useMemo(() => abcAnalysis(lines, 'margin'), [lines])
  const abcSum = useMemo(() => abcTotals(abcSales), [abcSales])
  const series = useMemo(() => dailySeries(periodDays), [periodDays])
  const profitability = marginPct(totals.sales, totals.margin)
  const label = periodLabel(period)

  async function handleUpdate(input: ShopInput) {
    if (!shop) return
    setBusy(true)
    setFormError('')
    try {
      await updateShop(shop.id, input)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteShop() {
    if (!shop) return
    if (!confirm(`Удалить магазин «${shop.name}» и все его отчёты?`)) return
    setBusy(true)
    try {
      await removeShop(shop.id)
      navigate('/shops')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось удалить магазин')
      setBusy(false)
    }
  }

  async function handleUpload(file: File | undefined) {
    if (!file || !shop) return
    setBusy(true)
    setMessage('')
    try {
      const parsed = await parseShopSalesExcel(file)
      if (!parsed.length) {
        throw new Error('В файле нет строк. Нужны колонки: артикул, количество, себестоимость, сумма продажи.')
      }
      const exists = days.some((d) => d.date === reportDate)
      if (exists && !confirm(`Отчёт за ${reportDate} уже есть. Заменить данными из файла?`)) return
      const result = await upsertDay({ date: reportDate, lines: parsed, fileName: file.name })
      const t = totalsOf(parsed)
      setMessage(
        `${result.replaced ? 'Обновлён' : 'Загружен'} отчёт за ${reportDate}: ${parsed.length} позиций, оборот ${formatShopMoney(t.sales)}.`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось обработать файл')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleStock(file: File | undefined) {
    if (!file || !shop) return
    setBusy(true)
    setMessage('')
    try {
      const parsed = await parseShopStockExcel(file)
      if (!parsed.length) {
        throw new Error('В файле нет остатков. Колонки: артикул, название, количество, себестоимость, стоимость продажи.')
      }
      if (stock && !confirm('Заменить текущие остатки этим файлом?')) return
      await saveStock({ lines: parsed, fileName: file.name })
      setMessage(`Остатки обновлены: ${parsed.length} позиций.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось обработать остатки')
    } finally {
      setBusy(false)
      if (stockRef.current) stockRef.current.value = ''
    }
  }

  async function handleExportPeriod() {
    if (!shop) return
    setBusy(true)
    try {
      await downloadShopPeriodReport({
        shopName: shop.name,
        month: label,
        days: periodDays,
        abc: abcSales,
        totals,
      })
    } finally {
      setBusy(false)
    }
  }

  if (shopsLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="space-y-3">
        <Link to="/shops" className="inline-flex items-center gap-1 text-sm text-secondary">
          <ArrowLeft size={16} />
          К магазинам
        </Link>
        <p className="text-sm text-muted">Магазин не найден или нет доступа.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/shops" className="inline-flex items-center gap-1 text-sm text-secondary">
            <ArrowLeft size={16} />
            Все магазины
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-text">{shop.name}</h1>
          {shop.locationUrl ? (
            <a
              href={shop.locationUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-secondary hover:underline"
            >
              <MapPin size={14} />
              Открыть локацию
            </a>
          ) : (
            <p className="mt-1 text-sm text-muted">Локация не указана</p>
          )}
        </div>
        <Button type="button" variant="danger" size="sm" disabled={busy} onClick={handleDeleteShop}>
          <Trash2 size={14} />
          Удалить
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-gray-100 bg-surface p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id)
              setMessage('')
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === item.id ? 'bg-primary text-white' : 'text-muted hover:bg-background'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ShopPeriodBar period={period} onChange={setPeriod} />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy || !periodDays.length}
              onClick={handleExportPeriod}
            >
              <Download size={14} />
              Excel · {label}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <p className="text-xs font-medium uppercase text-muted">Оборот</p>
              <p className="mt-1 text-xl font-bold text-text">{formatShopMoney(totals.sales)}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-muted">Себестоимость</p>
              <p className="mt-1 text-xl font-bold text-text">{formatShopMoney(totals.cost)}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-muted">Маржа</p>
              <p className="mt-1 text-xl font-bold text-text">{formatShopMoney(totals.margin)}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-muted">Рентабельность</p>
              <p className="mt-1 text-xl font-bold text-text">{profitability}%</p>
              <p className="mt-1 text-xs text-muted">
                {formatShopMoney(totals.qty)} шт · {periodDays.length} дн.
              </p>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-base font-semibold text-text">Продажи по дням · {label}</h2>
              {daysLoading ? (
                <p className="text-sm text-muted">Загрузка...</p>
              ) : (
                <ShopSalesBars points={series} />
              )}
            </Card>
            <Card>
              <h2 className="mb-3 text-base font-semibold text-text">ABC график · продажи</h2>
              <ShopAbcDonut sales={abcSum.sales} />
            </Card>
          </div>

          <Card>
            <ShopAbcTable
              title={`ABC по продажам · ${label}`}
              rows={abcSales}
              empty="За этот период нет загруженных отчётов."
            />
          </Card>
          <Card>
            <ShopAbcTable
              title={`ABC по рентабельности (маржа) · ${label}`}
              rows={abcMargin}
              empty="Нет маржи за период."
            />
          </Card>
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-text">Загрузить отчёт за день</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Excel: артикул, количество, себестоимость, сумма продажи. Повтор за ту же дату заменяет отчёт.
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => downloadShopSalesTemplate()}>
                <Download size={14} />
                Шаблон
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Input
                type="date"
                label="Дата отчёта"
                name="report-date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => void handleUpload(e.target.files?.[0])}
              />
              <Button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Upload size={16} />
                {busy ? 'Обработка...' : 'Загрузить Excel'}
              </Button>
            </div>
            {message && <p className="text-sm text-text">{message}</p>}
          </Card>

          <Card className="overflow-x-auto">
            <h2 className="mb-3 text-base font-semibold text-text">Загруженные отчёты</h2>
            {days.length === 0 ? (
              <p className="text-sm text-muted">Отчётов ещё нет.</p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase text-muted">
                    <th className="px-2 py-2">Дата</th>
                    <th className="px-2 py-2">Файл</th>
                    <th className="px-2 py-2 text-right">Шт</th>
                    <th className="px-2 py-2 text-right">Продажи</th>
                    <th className="px-2 py-2 text-right">Маржа</th>
                    <th className="px-2 py-2">Кто</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day.id} className="border-b border-gray-50">
                      <td className="px-2 py-2 font-medium text-text">{day.date}</td>
                      <td className="px-2 py-2 text-muted">{day.fileName || '—'}</td>
                      <td className="px-2 py-2 text-right">{formatShopMoney(day.qty)}</td>
                      <td className="px-2 py-2 text-right">{formatShopMoney(day.sales)}</td>
                      <td className="px-2 py-2 text-right">{formatShopMoney(day.margin)}</td>
                      <td className="px-2 py-2 text-muted">{day.uploadedByName || '—'}</td>
                      <td className="px-2 py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            if (confirm(`Удалить отчёт за ${day.date}?`)) void deleteDay(day.id)
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {tab === 'stock' && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-text">Остатки товара</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Тот же Excel-шаблон: артикул, название, количество, себестоимость, стоимость продажи.
                  Новый файл заменяет текущие остатки.
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => downloadShopStockTemplate()}>
                <Download size={14} />
                Шаблон остатков
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <input
                ref={stockRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => void handleStock(e.target.files?.[0])}
              />
              <Button type="button" disabled={busy} onClick={() => stockRef.current?.click()}>
                <Upload size={16} />
                {busy ? 'Обработка...' : 'Загрузить остатки'}
              </Button>
            </div>
            {message && <p className="text-sm text-text">{message}</p>}
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <p className="text-xs uppercase text-muted">На складе</p>
              <p className="mt-1 text-xl font-bold">{formatShopMoney(stock?.qty || 0)} шт</p>
            </Card>
            <Card>
              <p className="text-xs uppercase text-muted">Себестоимость остатка</p>
              <p className="mt-1 text-xl font-bold">{formatShopMoney(stock?.cost || 0)}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase text-muted">По цене продажи</p>
              <p className="mt-1 text-xl font-bold">{formatShopMoney(stock?.saleValue || 0)}</p>
            </Card>
          </div>

          <Card className="overflow-x-auto">
            {stockLoading ? (
              <p className="text-sm text-muted">Загрузка остатков...</p>
            ) : !stock?.lines?.length ? (
              <p className="text-sm text-muted">Остатки ещё не загружены.</p>
            ) : (
              <>
                <p className="mb-3 text-xs text-muted">
                  Файл {stock.fileName || '—'}
                  {stock.uploadedByName ? ` · ${stock.uploadedByName}` : ''}
                </p>
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs uppercase text-muted">
                      <th className="px-2 py-2">Артикул</th>
                      <th className="px-2 py-2">Товар</th>
                      <th className="px-2 py-2 text-right">Шт</th>
                      <th className="px-2 py-2 text-right">Себест.</th>
                      <th className="px-2 py-2 text-right">Цена</th>
                      <th className="px-2 py-2 text-right">Сумма себест.</th>
                      <th className="px-2 py-2 text-right">Сумма продаж</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.lines.map((row) => (
                      <tr key={`${row.article}-${row.name}`} className="border-b border-gray-50">
                        <td className="px-2 py-2 font-medium">{row.article}</td>
                        <td className="px-2 py-2 text-muted">{row.name || '—'}</td>
                        <td className="px-2 py-2 text-right">{formatShopMoney(row.qty)}</td>
                        <td className="px-2 py-2 text-right">{formatShopMoney(row.unitCost)}</td>
                        <td className="px-2 py-2 text-right">{formatShopMoney(row.salePrice)}</td>
                        <td className="px-2 py-2 text-right">{formatShopMoney(row.cost)}</td>
                        <td className="px-2 py-2 text-right">{formatShopMoney(row.saleValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Card>
        </div>
      )}

      {tab === 'card' && (
        <Card>
          <h2 className="mb-4 text-base font-semibold text-text">Карточка магазина</h2>
          {(shop.managers || []).length > 0 && (
            <ul className="mb-4 space-y-1">
              {shop.managers.map((m, i) => (
                <li key={`${m.name}-${i}`} className="text-sm">
                  {m.name}
                  {m.phone ? (
                    <>
                      {' · '}
                      <a href={`tel:${m.phone}`} className="text-secondary hover:underline">
                        {m.phone}
                      </a>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <ShopForm
            key={shop.id}
            initial={{
              name: shop.name,
              locationUrl: shop.locationUrl,
              managers: shop.managers || [],
            }}
            busy={busy}
            error={formError}
            submitLabel="Сохранить"
            onSubmit={handleUpdate}
          />
        </Card>
      )}
    </div>
  )
}
