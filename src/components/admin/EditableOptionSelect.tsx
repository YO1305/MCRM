import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  OPTION_LIST_LABELS,
  slugifyOption,
  type AppOption,
  type OptionListId,
} from '@/constants/optionLists'
import { useOptionList } from '@/hooks/useOptionList'

interface Props {
  listId: OptionListId
  value: string
  onChange: (value: string) => void
  label?: string
  className?: string
}

function sanitizeOptions(list: AppOption[]): AppOption[] {
  return list.map((o) => {
    const next: AppOption = {
      value: o.value,
      label: o.label.trim() || o.value,
    }
    if (o.builtin) next.builtin = true
    if (o.requiresExhibition) next.requiresExhibition = true
    return next
  })
}

/** Select for statuses/types/sources + admin «Редактировать» to add custom options. */
export function EditableOptionSelect({
  listId,
  value,
  onChange,
  label,
  className = '',
}: Props) {
  const { options, labelOf, saveOptions, canEdit } = useOptionList(listId)
  const [open, setOpen] = useState(false)

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        {label && (
          <label className="text-sm font-medium text-text">{label}</label>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen(true)
            }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-secondary hover:underline"
            title="Добавить свои варианты (админ)"
          >
            <Pencil className="h-3 w-3" />
            Редактировать
          </button>
        )}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-secondary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {value && !options.some((o) => o.value === value) && (
          <option value={value}>{labelOf(value)}</option>
        )}
      </select>

      {open &&
        createPortal(
          <OptionListEditorModal
            listId={listId}
            options={options}
            onClose={() => setOpen(false)}
            onSave={async (next) => {
              await saveOptions(sanitizeOptions(next))
              setOpen(false)
            }}
          />,
          document.body,
        )}
    </div>
  )
}

function OptionListEditorModal({
  listId,
  options,
  onClose,
  onSave,
}: {
  listId: OptionListId
  options: AppOption[]
  onClose: () => void
  onSave: (next: AppOption[]) => Promise<void>
}) {
  const [draft, setDraft] = useState<AppOption[]>(() =>
    options.map((o) => ({ ...o })),
  )
  const [newLabel, setNewLabel] = useState('')
  const [newExhibition, setNewExhibition] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function addCustom() {
    const label = newLabel.trim()
    if (!label) return
    let value = slugifyOption(label)
    if (draft.some((o) => o.value === value)) {
      value = `${value}_${Date.now().toString(36)}`
    }
    const item: AppOption = { value, label, builtin: false }
    if (newExhibition) item.requiresExhibition = true
    setDraft((d) => [...d, item])
    setNewLabel('')
    setNewExhibition(false)
  }

  async function handleSave() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onSave(draft)
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : 'Не удалось сохранить. Проверьте права админа.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase text-muted">Админ</p>
            <h3 className="text-lg font-semibold text-text">
              {OPTION_LIST_LABELS[listId]}
            </h3>
            <p className="text-xs text-muted">
              Добавьте свои варианты — они появятся в выпадающих списках у всех.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-background"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <ul className="space-y-2">
            {draft.map((o, idx) => (
              <li
                key={o.value}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-background px-3 py-2"
              >
                <input
                  value={o.label}
                  onChange={(e) => {
                    const label = e.target.value
                    setDraft((d) =>
                      d.map((x, i) => (i === idx ? { ...x, label } : x)),
                    )
                  }}
                  className="min-w-0 flex-1 rounded-md border border-gray-200 bg-surface px-2 py-1.5 text-sm"
                />
                {(listId === 'contact_source' || listId === 'client_source') && (
                  <label className="flex items-center gap-1 text-[11px] text-muted">
                    <input
                      type="checkbox"
                      checked={Boolean(o.requiresExhibition)}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setDraft((d) =>
                          d.map((x, i) => {
                            if (i !== idx) return x
                            const next = { ...x }
                            if (checked) next.requiresExhibition = true
                            else delete next.requiresExhibition
                            return next
                          }),
                        )
                      }}
                    />
                    Выставка
                  </label>
                )}
                {!o.builtin && (
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-danger"
                    onClick={() => setDraft((d) => d.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="space-y-2 rounded-xl border border-dashed border-gray-200 p-3">
            <p className="text-xs font-medium text-muted">Новый вариант</p>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Например: WhatsApp / Выставка Ташкент"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  addCustom()
                }
              }}
            />
            {(listId === 'contact_source' || listId === 'client_source') && (
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={newExhibition}
                  onChange={(e) => setNewExhibition(e.target.checked)}
                />
                Требует название и дату выставки
              </label>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!newLabel.trim()}
              onClick={(e) => {
                e.preventDefault()
                addCustom()
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Добавить в список
            </Button>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>
          )}
        </div>

        <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
          <Button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void handleSave()
            }}
          >
            {busy ? 'Сохраняем...' : 'Сохранить варианты'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </div>
    </div>
  )
}
