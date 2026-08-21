import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import type { CatalogueCategory, CatalogueInput, CatalogueType } from '@/types/catalogue.types'
import { CATALOGUE_CATEGORY_LABELS } from '@/types/catalogue.types'
import { parseExcelPrices } from '@/utils/excelParser'
import type { Client } from '@/types/client.types'

interface CreateCatalogueModalProps {
  open: boolean
  onClose: () => void
  defaultType?: CatalogueType
  presetClient?: { id: string; name: string } | null
  clients: Client[]
  allowGeneral: boolean
  allowPersonal: boolean
  onCreate: (input: CatalogueInput) => Promise<string>
}

export function CreateCatalogueModal({
  open,
  onClose,
  defaultType = 'general',
  presetClient,
  clients,
  allowGeneral,
  allowPersonal,
  onCreate,
}: CreateCatalogueModalProps) {
  const initialType: CatalogueType =
    presetClient || !allowGeneral ? 'personal' : defaultType
  const [type, setType] = useState<CatalogueType>(initialType)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<CatalogueCategory>('fabric')
  const [description, setDescription] = useState('')
  const [clientId, setClientId] = useState(presetClient?.id || '')
  const [clientQuery, setClientQuery] = useState('')
  const [pdf, setPdf] = useState<File | null>(null)
  const [excel, setExcel] = useState<File | null>(null)
  const [parsed, setParsed] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [createdUrl, setCreatedUrl] = useState('')

  useEffect(() => {
    if (!open) return
    setType(presetClient || !allowGeneral ? 'personal' : defaultType)
    setTitle(presetClient ? `КП — ${presetClient.name}` : '')
    setClientId(presetClient?.id || '')
    setClientQuery('')
    setDescription('')
    setPdf(null)
    setExcel(null)
    setParsed(null)
    setError('')
    setCreatedUrl('')
  }, [open, defaultType, presetClient, allowGeneral])

  const clientMatches = useMemo(() => {
    const q = clientQuery.trim().toLowerCase()
    const list = clients.filter((c) => c.name)
    if (!q) return list.slice(0, 12)
    return list
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.company || '').toLowerCase().includes(q),
      )
      .slice(0, 12)
  }, [clients, clientQuery])

  const selectedClient = clients.find((c) => c.id === clientId) || presetClient

  async function handleExcel(file: File | null) {
    setExcel(file)
    setParsed(null)
    if (!file) return
    try {
      const rows = await parseExcelPrices(file)
      setParsed(rows.length)
    } catch {
      setParsed(null)
      setError('Не удалось разобрать Excel')
    }
  }

  async function submit() {
    setError('')
    if (!pdf) {
      setError('Загрузите PDF')
      return
    }
    setBusy(true)
    try {
      const url = await onCreate({
        type,
        title,
        category,
        description,
        clientId: type === 'personal' ? selectedClient?.id : undefined,
        clientName: type === 'personal' ? selectedClient?.name : undefined,
        pdf,
        excel,
      })
      setCreatedUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-text">
          {createdUrl ? 'Ссылка готова' : 'Создать каталог / КП'}
        </h2>

        {createdUrl ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted">Отправьте эту ссылку клиенту. При обновлении Excel адрес не меняется.</p>
            <p className="break-all rounded-lg bg-background px-3 py-2 text-sm text-text">{createdUrl}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void navigator.clipboard.writeText(createdUrl)}
              >
                Копировать
              </Button>
              <Button type="button" variant="ghost" onClick={onClose}>
                Закрыть
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {allowGeneral && (
                <button
                  type="button"
                  onClick={() => setType('general')}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    type === 'general' ? 'bg-secondary text-white' : 'bg-background text-muted'
                  }`}
                >
                  Общий каталог
                </button>
              )}
              {allowPersonal && (
                <button
                  type="button"
                  onClick={() => setType('personal')}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    type === 'personal' ? 'bg-secondary text-white' : 'bg-background text-muted'
                  }`}
                >
                  Персональное КП
                </button>
              )}
            </div>

            <Input
              label="Название"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ткань — Прайс Q3 2026"
            />

            <label className="flex flex-col gap-1.5 text-sm font-medium text-text">
              Категория
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CatalogueCategory)}
                className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm font-normal"
              >
                {(Object.keys(CATALOGUE_CATEGORY_LABELS) as CatalogueCategory[]).map((k) => (
                  <option key={k} value={k}>
                    {CATALOGUE_CATEGORY_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>

            <Textarea
              label="Описание"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />

            {type === 'personal' && !presetClient && (
              <div>
                <Input
                  label="Клиент"
                  value={clientQuery}
                  onChange={(e) => {
                    setClientQuery(e.target.value)
                    setClientId('')
                  }}
                  placeholder="Поиск по имени или компании"
                />
                <ul className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-gray-100">
                  {clientMatches.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`block w-full px-3 py-2 text-left text-sm ${
                          clientId === c.id ? 'bg-secondary/10 text-secondary' : 'hover:bg-background'
                        }`}
                        onClick={() => {
                          setClientId(c.id)
                          setClientQuery(c.name)
                        }}
                      >
                        {c.name}
                        {c.company ? ` · ${c.company}` : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {type === 'personal' && presetClient && (
              <p className="text-sm text-muted">Клиент: {presetClient.name}</p>
            )}

            <label className="block text-sm font-medium text-text">
              PDF каталог
              <input
                type="file"
                accept="application/pdf"
                className="mt-1 block w-full text-sm"
                onChange={(e) => setPdf(e.target.files?.[0] || null)}
              />
              {pdf && <p className="mt-1 text-xs text-emerald-700">{pdf.name} ✓</p>}
            </label>

            <label className="block text-sm font-medium text-text">
              Прайс (Excel)
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="mt-1 block w-full text-sm"
                onChange={(e) => void handleExcel(e.target.files?.[0] || null)}
              />
              {excel && (
                <p className="mt-1 text-xs text-emerald-700">
                  {excel.name} ✓
                  {parsed != null ? ` · распознано строк: ${parsed}` : ''}
                </p>
              )}
            </label>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy || !title.trim() || !pdf}
                onClick={() => void submit()}
              >
                {busy ? 'Создание…' : 'Создать и получить ссылку'}
              </Button>
              <Button type="button" variant="ghost" onClick={onClose}>
                Отмена
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
