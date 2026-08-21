import { useRef, useState } from 'react'
import { Copy, ExternalLink, Eye } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Catalogue } from '@/types/catalogue.types'
import { CATALOGUE_CATEGORY_LABELS } from '@/types/catalogue.types'
import { cataloguePublicUrl } from '@/utils/slugUtils'

function formatWhen(value: unknown): string {
  if (!value) return '—'
  if (typeof value === 'string' && value.length >= 10) {
    return new Date(value).toLocaleDateString('ru-RU')
  }
  const seconds = (value as { seconds?: number }).seconds
  if (typeof seconds === 'number') {
    return new Date(seconds * 1000).toLocaleDateString('ru-RU')
  }
  return '—'
}

export function CatalogueCard({
  item,
  canUpdateExcel,
  canToggle,
  canDelete,
  onUpdateExcel,
  onToggle,
  onDelete,
}: {
  item: Catalogue
  canUpdateExcel: boolean
  canToggle: boolean
  canDelete: boolean
  onUpdateExcel: (file: File) => Promise<void>
  onToggle: () => Promise<void>
  onDelete: () => Promise<void>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const url = item.publicUrl || cataloguePublicUrl(item.slug)

  async function copy() {
    await navigator.clipboard.writeText(url)
    setMsg('Ссылка скопирована')
  }

  async function pickExcel(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setMsg('')
    try {
      await onUpdateExcel(file)
      setMsg('Цены обновлены. Клиенты уже видят новые цены.')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Не удалось обновить Excel')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-text">{item.title}</h3>
          <p className="text-xs text-muted">
            {CATALOGUE_CATEGORY_LABELS[item.category] || item.category}
            {item.clientName ? ` · клиент: ${item.clientName}` : ''}
            {item.createdByName ? ` · ${item.createdByName}` : ''}
            {' · обновлён '}
            {formatWhen(item.updatedAt || item.excelUploadedAt || item.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={item.isActive ? 'success' : 'danger'}>
            {item.isActive ? 'Активен' : 'Выключен'}
          </Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <Eye className="h-3.5 w-3.5" />
            {item.viewCount || 0}
          </span>
        </div>
      </div>

      <p className="text-xs text-muted">
        PDF: {item.pdfFileName || '—'}
        {item.excelFileName ? ` · Excel: ${item.excelFileName}` : ' · Excel не загружен'}
        {item.priceData?.length ? ` · строк: ${item.priceData.length}` : ''}
      </p>

      <p className="break-all text-sm text-secondary">{url}</p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => void copy()}>
          <Copy className="h-3.5 w-3.5" />
          Копировать
        </Button>
        <a href={url} target="_blank" rel="noreferrer">
          <Button type="button" size="sm" variant="ghost">
            <ExternalLink className="h-3.5 w-3.5" />
            Открыть
          </Button>
        </a>
        {canUpdateExcel && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => void pickExcel(e.target.files?.[0])}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              Обновить Excel
            </Button>
          </>
        )}
        {canToggle && (
          <Button type="button" size="sm" variant="ghost" onClick={() => void onToggle()}>
            {item.isActive ? 'Деактивировать' : 'Включить'}
          </Button>
        )}
        {canDelete && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm('Удалить каталог? Ссылка перестанет открываться.')) void onDelete()
            }}
          >
            Удалить
          </Button>
        )}
      </div>
      {msg && <p className="text-xs text-emerald-700">{msg}</p>}
    </Card>
  )
}
