import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ShopInput, ShopManager } from '@/types/shop.types'

function emptyManager(): ShopManager {
  return { name: '', phone: '' }
}

interface ShopFormProps {
  initial?: ShopInput
  busy?: boolean
  error?: string
  submitLabel: string
  onSubmit: (input: ShopInput) => Promise<void>
  onCancel?: () => void
}

export function ShopForm({
  initial,
  busy,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: ShopFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [locationUrl, setLocationUrl] = useState(initial?.locationUrl ?? '')
  const [managers, setManagers] = useState<ShopManager[]>(
    initial?.managers?.length ? initial.managers.map((m) => ({ ...m })) : [emptyManager()],
  )

  function updateManager(index: number, patch: Partial<ShopManager>) {
    setManagers((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await onSubmit({ name, locationUrl, managers })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Название магазина"
        name="shop-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Bahmal · Чиланзар"
        required
      />
      <Input
        label="Локация (ссылка на карту)"
        name="shop-location"
        type="text"
        value={locationUrl}
        onChange={(e) => setLocationUrl(e.target.value)}
        placeholder="https://maps.google.com/..."
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-text">Менеджеры магазина</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setManagers((prev) => [...prev, emptyManager()])}
          >
            <Plus size={14} />
            Добавить
          </Button>
        </div>
        <p className="text-xs text-muted">Имя и телефон. Это люди в магазине, не сотрудники CRM.</p>
        {managers.map((manager, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              name={`manager-name-${index}`}
              placeholder="Имя"
              value={manager.name}
              onChange={(e) => updateManager(index, { name: e.target.value })}
            />
            <Input
              name={`manager-phone-${index}`}
              placeholder="Телефон"
              value={manager.phone}
              onChange={(e) => updateManager(index, { phone: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-end"
              onClick={() =>
                setManagers((prev) => {
                  const next = prev.filter((_, i) => i !== index)
                  return next.length ? next : [emptyManager()]
                })
              }
              aria-label="Удалить менеджера"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Сохранение...' : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            Отмена
          </Button>
        )}
      </div>
    </form>
  )
}
