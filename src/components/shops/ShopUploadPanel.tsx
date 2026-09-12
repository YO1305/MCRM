import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ShopReportKind } from '@/types/shop.types'
import { getCurrentMonth, todayISO } from '@/utils/dates'
import { lastDayOfMonthKey } from '@/utils/shopSales'

const KINDS: { id: ShopReportKind; title: string; hint: string }[] = [
  { id: 'day', title: 'За один день', hint: 'Отчёт за выбранную дату' },
  { id: 'month', title: 'За месяц', hint: 'Выберите месяц и год' },
  { id: 'range', title: 'За период', hint: 'Своя дата «с» и «по»' },
]

export function ShopUploadPanel({
  busy,
  onUpload,
}: {
  busy: boolean
  onUpload: (file: File, kind: ShopReportKind, from: string, to: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ShopReportKind | null>(null)
  const [day, setDay] = useState(todayISO())
  const [month, setMonth] = useState(getCurrentMonth())
  const [from, setFrom] = useState(`${getCurrentMonth()}-01`)
  const [to, setTo] = useState(todayISO())
  const fileRef = useRef<HTMLInputElement>(null)

  function span(): { from: string; to: string } | null {
    if (kind === 'day') {
      if (!day) return null
      return { from: day, to: day }
    }
    if (kind === 'month') {
      if (!month) return null
      return { from: `${month}-01`, to: lastDayOfMonthKey(month) }
    }
    if (!from || !to) return null
    return { from, to }
  }

  function pickFile() {
    const next = span()
    if (!kind || !next) return
    fileRef.current?.click()
  }

  return (
    <div className="space-y-4">
      {!open ? (
        <Button type="button" onClick={() => setOpen(true)}>
          <Upload size={16} />
          Загрузить отчёт
        </Button>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            {KINDS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setKind(item.id)}
                className={`rounded-xl border px-3 py-3 text-left ${
                  kind === item.id
                    ? 'border-secondary bg-secondary/10'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-semibold text-text">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted">{item.hint}</p>
              </button>
            ))}
          </div>

          {kind === 'day' && (
            <Input
              type="date"
              label="Дата"
              name="upload-day"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          )}
          {kind === 'month' && (
            <Input
              type="month"
              label="Месяц и год"
              name="upload-month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          )}
          {kind === 'range' && (
            <div className="flex flex-wrap gap-3">
              <Input
                type="date"
                label="С"
                name="upload-from"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <Input
                type="date"
                label="По"
                name="upload-to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              const next = span()
              if (file && kind && next) void onUpload(file, kind, next.from, next.to)
              if (fileRef.current) fileRef.current.value = ''
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy || !kind || !span()} onClick={pickFile}>
              <Upload size={16} />
              {busy ? 'Обработка...' : 'Выбрать Excel'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setOpen(false)
                setKind(null)
              }}
            >
              Отмена
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
