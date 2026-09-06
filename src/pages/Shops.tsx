import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Plus, Store } from 'lucide-react'
import { ShopForm } from '@/components/shops/ShopForm'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useShops } from '@/hooks/useShops'
import type { ShopInput } from '@/types/shop.types'

export function Shops() {
  const { shops, loading, error, createShop } = useShops()
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  async function handleCreate(input: ShopInput) {
    setBusy(true)
    setFormError('')
    try {
      await createShop(input)
      setCreating(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Не удалось создать магазин')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Магазины</h1>
          <p className="mt-1 text-sm text-muted">
            Сеть магазинов: карточка, менеджеры, ежедневный Excel по продажам, ABC и маржа.
          </p>
        </div>
        <Button type="button" onClick={() => setCreating((v) => !v)}>
          <Plus size={16} />
          {creating ? 'Скрыть форму' : 'Создать магазин'}
        </Button>
      </div>

      {creating && (
        <Card>
          <h2 className="mb-4 text-base font-semibold text-text">Новый магазин</h2>
          <ShopForm
            busy={busy}
            error={formError}
            submitLabel="Создать"
            onSubmit={handleCreate}
            onCancel={() => {
              setCreating(false)
              setFormError('')
            }}
          />
        </Card>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : shops.length === 0 ? (
        <Card className="py-10 text-center">
          <Store className="mx-auto mb-3 text-muted" size={32} />
          <p className="font-medium text-text">Магазинов пока нет</p>
          <p className="mt-1 text-sm text-muted">Создайте первый — затем ежедневно загружайте Excel.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shops.map((shop) => (
            <Link key={shop.id} to={`/shops/${shop.id}`} className="block">
              <Card className="h-full transition-colors hover:border-secondary/40">
                <p className="text-base font-semibold text-text">{shop.name}</p>
                {shop.locationUrl ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-secondary">
                    <MapPin size={12} />
                    Локация на карте
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted">Локация не указана</p>
                )}
                <div className="mt-3 space-y-1">
                  {(shop.managers || []).length === 0 ? (
                    <p className="text-xs text-muted">Менеджеры не отмечены</p>
                  ) : (
                    shop.managers.map((m, i) => (
                      <p key={`${m.name}-${i}`} className="text-sm text-text">
                        {m.name}
                        {m.phone ? <span className="text-muted"> · {m.phone}</span> : null}
                      </p>
                    ))
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
