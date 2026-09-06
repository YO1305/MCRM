import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, MapPin, Trash2, Upload } from 'lucide-react'
import { ShopForm } from '@/components/shops/ShopForm'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useShopSales, useShops } from '@/hooks/useShops'
import type { ShopInput } from '@/types/shop.types'
import { getCurrentMonth, todayISO } from '@/utils/dates'
import { monthLabel } from '@/utils/devDates'
import { downloadShopPeriodReport, downloadShopSalesTemplate, parseShopSalesExcel } from '@/utils/shopExcel'
import { abcAnalysis, aggregateLines, formatShopMoney, marginPct, totalsOf } from '@/utils/shopSales'

function abcBadge(abc: 'A' | 'B' | 'C') {
  if (abc === 'A') return <Badge variant="success">A</Badge>
  if (abc === 'B') return <Badge variant="warning">B</Badge>
  return <Badge>C</Badge>
}

export function ShopDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { shops, loading: shopsLoading, updateShop, removeShop } = useShops()
  const { days, loading: daysLoading, upsertDay, deleteDay } = useShopSales(id)
  const shop = shops.find((s) => s.id === id)

  const [month, setMonth] = useState(getCurrentMonth())
  const [reportDate, setReportDate] = useState(todayISO())
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const monthDays = useMemo(() => days.filter((d) => d.date.startsWith(month)), [days, month])
  const lines = useMemo(() => aggregateLines(monthDays), [monthDays])
  const totals = useMemo(() => totalsOf(lines), [lines])
  const abc = useMemo(() => abcAnalysis(lines), [lines])
  const profitability = marginPct(totals.sales, totals.margin)

  async function handleUpdate(input: ShopInput) {
    if (!shop) return
    setBusy(true)
    setFormError('')
    try {
      await updateShop(shop.id, input)
      setEditing(false)
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
    } finally {
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
      if (
        exists &&
        !confirm(`Отчёт за ${reportDate} уже есть. Заменить данными из файла?`)
      ) {
        return
      }
      const result = await upsertDay({
        date: reportDate,
        lines: parsed,
        fileName: file.name,
      })
      const t = totalsOf(parsed)
      setMessage(
        `${result.replaced ? 'Обновлён' : 'Загружен'} отчёт за ${reportDate}: ${parsed.length} позиций, оборот ${formatShopMoney(t.sales)}, маржа ${formatShopMoney(t.margin)}.`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось обработать файл')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleExportPeriod() {
    if (!shop) return
    setBusy(true)
    try {
      await downloadShopPeriodReport({
        shopName: shop.name,
        month,
        days: monthDays,
        abc,
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
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? 'К дашборду' : 'Карточка магазина'}
          </Button>
          <Button type="button" variant="danger" size="sm" disabled={busy} onClick={handleDeleteShop}>
            <Trash2 size={14} />
            Удалить
          </Button>
        </div>
      </div>

      {editing ? (
        <Card>
          <h2 className="mb-4 text-base font-semibold text-text">Карточка магазина</h2>
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
            onCancel={() => {
              setEditing(false)
              setFormError('')
            }}
          />
        </Card>
      ) : (
        <Card>
          <p className="text-xs font-medium uppercase text-muted">Менеджеры</p>
          {(shop.managers || []).length === 0 ? (
            <p className="mt-1 text-sm text-muted">Не отмечены. Откройте карточку магазина.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {shop.managers.map((m, i) => (
                <li key={`${m.name}-${i}`} className="text-sm text-text">
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
        </Card>
      )}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text">Загрузка отчёта</h2>
            <p className="mt-0.5 text-xs text-muted">
              Excel за день: артикул, количество, себестоимость, сумма продажи. Повтор за ту же дату
              заменяет отчёт.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => downloadShopSalesTemplate()}
          >
            <Download size={14} />
            Скачать шаблон
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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Input
          type="month"
          label="Период дашборда"
          name="shop-month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <Button type="button" variant="secondary" size="sm" disabled={busy || !monthDays.length} onClick={handleExportPeriod}>
          <Download size={14} />
          Excel за {monthLabel(month)}
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
          <p className="mt-1 text-xs text-muted">{formatShopMoney(totals.qty)} шт · {abc.length} арт.</p>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <h2 className="mb-3 text-base font-semibold text-text">ABC анализ · {monthLabel(month)}</h2>
        {daysLoading ? (
          <p className="text-sm text-muted">Загрузка отчётов...</p>
        ) : abc.length === 0 ? (
          <p className="text-sm text-muted">За этот месяц ещё нет загруженных дней.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-muted">
                <th className="px-2 py-2">ABC</th>
                <th className="px-2 py-2">Артикул</th>
                <th className="px-2 py-2">Товар</th>
                <th className="px-2 py-2 text-right">Шт</th>
                <th className="px-2 py-2 text-right">Продажи</th>
                <th className="px-2 py-2 text-right">Себест.</th>
                <th className="px-2 py-2 text-right">Маржа</th>
                <th className="px-2 py-2 text-right">Доля</th>
              </tr>
            </thead>
            <tbody>
              {abc.map((row) => (
                <tr key={`${row.article}-${row.name}`} className="border-b border-gray-50">
                  <td className="px-2 py-2">{abcBadge(row.abc)}</td>
                  <td className="px-2 py-2 font-medium text-text">{row.article}</td>
                  <td className="px-2 py-2 text-muted">{row.name || '—'}</td>
                  <td className="px-2 py-2 text-right">{formatShopMoney(row.qty)}</td>
                  <td className="px-2 py-2 text-right">{formatShopMoney(row.sales)}</td>
                  <td className="px-2 py-2 text-right">{formatShopMoney(row.cost)}</td>
                  <td className="px-2 py-2 text-right">{formatShopMoney(row.margin)}</td>
                  <td className="px-2 py-2 text-right">{Math.round(row.share * 1000) / 10}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <h2 className="mb-3 text-base font-semibold text-text">Загруженные дни</h2>
        {monthDays.length === 0 ? (
          <p className="text-sm text-muted">Нет отчётов за {monthLabel(month)}.</p>
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
              {monthDays.map((day) => (
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
  )
}
