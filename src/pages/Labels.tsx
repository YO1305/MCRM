import { useMemo, useState } from 'react'
import { Download, Plus, Trash2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import {
  LABEL_UI,
  emptyLabel,
  isLabelFilled,
  isLabelReady,
  type FabricLabel,
  type LabelLocale,
} from '@/types/label.types'
import { downloadLabelsPdf } from '@/utils/labelPdf'

export function Labels() {
  const [locale, setLocale] = useState<LabelLocale>('ru')
  const [rows, setRows] = useState<FabricLabel[]>([emptyLabel()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const ui = LABEL_UI[locale]
  const readyCount = useMemo(() => rows.filter(isLabelReady).length, [rows])

  function updateRow(id: string, patch: Partial<FabricLabel>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, emptyLabel()])
  }

  function addMany(count: number) {
    setRows((prev) => [
      ...prev,
      ...Array.from({ length: count }, () => emptyLabel()),
    ])
  }

  function duplicateRow(row: FabricLabel) {
    setRows((prev) => [
      ...prev,
      {
        ...row,
        id: crypto.randomUUID(),
      },
    ])
  }

  function removeRow(id: string) {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id)
      return next.length === 0 ? [emptyLabel()] : next
    })
  }

  function clearEmpty() {
    setRows((prev) => {
      const kept = prev.filter(isLabelFilled)
      return kept.length === 0 ? [emptyLabel()] : kept
    })
  }

  function switchLocale(next: LabelLocale) {
    if (next === locale) return
    const hasData = rows.some(isLabelFilled)
    if (
      hasData &&
      !confirm(
        next === 'en'
          ? 'Switch to English? Field names and PDF text will be English — fill values in English.'
          : 'Переключить на русский? Названия полей и PDF будут на русском — заполняйте значения по-русски.',
      )
    ) {
      return
    }
    setLocale(next)
    setError('')
  }

  async function handleDownload() {
    setError('')
    setBusy(true)
    try {
      const date = new Date().toISOString().slice(0, 10)
      const prefix = locale === 'en' ? 'labels-bahmal' : 'birki-bahmal'
      await downloadLabelsPdf(rows, `${prefix}-${date}.pdf`, locale)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать PDF')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">{ui.pageTitle}</h1>
          <p className="mt-1 text-sm text-muted">{ui.pageHint}</p>
          <p className="mt-1 text-xs text-muted">{ui.fillHint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-gray-200 bg-surface p-1">
            {(['ru', 'en'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => switchLocale(lang)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  locale === lang
                    ? 'bg-primary text-white'
                    : 'text-muted hover:text-text'
                }`}
              >
                {lang === 'ru' ? ui.langRu : ui.langEn}
              </button>
            ))}
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4" />
            {ui.add}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || readyCount === 0}
            onClick={() => void handleDownload()}
          >
            <Download className="h-4 w-4" />
            {ui.pdf} ({readyCount})
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>
      )}

      <Card className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">{ui.bulkAdd}</span>
        {[5, 10, 20].map((n) => (
          <Button
            key={n}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addMany(n)}
          >
            +{n}
          </Button>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={clearEmpty}>
          {ui.clearEmpty}
        </Button>
      </Card>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <Card key={row.id} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-text">{ui.labelN(index + 1)}</p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => duplicateRow(row)}
                  title={ui.duplicate}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(row.id)}
                  title={ui.remove}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input
                  label={ui.name}
                  value={row.name}
                  onChange={(e) => updateRow(row.id, { name: e.target.value })}
                  placeholder={ui.namePh}
                />
              </div>
              <Input
                label={ui.finish1}
                value={row.finish1}
                onChange={(e) => updateRow(row.id, { finish1: e.target.value })}
                placeholder={ui.finish1Ph}
              />
              <Input
                label={ui.finish2}
                value={row.finish2}
                onChange={(e) => updateRow(row.id, { finish2: e.target.value })}
                placeholder={ui.finish2Ph}
              />
              <div className="sm:col-span-2">
                <Input
                  label={ui.code}
                  value={row.code}
                  onChange={(e) => updateRow(row.id, { code: e.target.value })}
                  placeholder={ui.codePh}
                />
              </div>
              <Input
                label={ui.width}
                value={row.width}
                onChange={(e) => updateRow(row.id, { width: e.target.value })}
                placeholder={ui.widthPh}
              />
              <Input
                label={ui.density}
                value={row.density}
                onChange={(e) => updateRow(row.id, { density: e.target.value })}
                placeholder={ui.densityPh}
              />
              <div className="sm:col-span-2">
                <Input
                  label={ui.composition}
                  value={row.composition}
                  onChange={(e) => updateRow(row.id, { composition: e.target.value })}
                  placeholder={ui.compositionPh}
                />
              </div>
            </div>

            <p className="text-xs text-muted">{ui.unitsHint}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pb-8">
        <Button type="button" variant="secondary" onClick={addRow}>
          <Plus className="h-4 w-4" />
          {ui.moreLabel}
        </Button>
        <Button
          type="button"
          disabled={busy || readyCount === 0}
          onClick={() => void handleDownload()}
        >
          <Download className="h-4 w-4" />
          {ui.downloadPdf(readyCount)}
        </Button>
      </div>
    </div>
  )
}
