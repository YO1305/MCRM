import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/hooks/useClients'
import { useCatalogues } from '@/hooks/useCatalogues'
import { CatalogueCard } from '@/components/catalogue/CatalogueCard'
import { CreateCatalogueModal } from '@/components/catalogue/CreateCatalogueModal'
import {
  canCreateGeneralCatalogue,
  canCreatePersonalKp,
  canDeactivateCatalogue,
  canDeleteCatalogue,
  canManageCatalogues,
  canUpdateCatalogueExcel,
} from '@/utils/catalogueAccess'
import type { CatalogueType } from '@/types/catalogue.types'

export function Catalogue() {
  const { isAdmin, user } = useAuth()
  const opts = { isAdmin, position: user?.position }
  const canSee = canManageCatalogues(opts)
  const { catalogues, loading, createCatalogue, updateExcel, toggleActive, deleteCatalogue } =
    useCatalogues()
  const { clients } = useClients()
  const [tab, setTab] = useState<CatalogueType>('general')
  const [modal, setModal] = useState(false)
  const [search, setSearch] = useState('')

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return catalogues.filter((c) => {
      if (c.type !== tab) return false
      if (!q) return true
      return (
        c.title.toLowerCase().includes(q) ||
        (c.clientName || '').toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q)
      )
    })
  }, [catalogues, tab, search])

  if (!canSee) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text">Каталог и КП</h1>
        <p className="mt-2 text-sm text-muted">Нет доступа.</p>
      </div>
    )
  }

  const allowGeneral = canCreateGeneralCatalogue(opts)
  const allowPersonal = canCreatePersonalKp(opts)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Каталог и КП</h1>
        <p className="mt-1 text-sm text-muted">
          Постоянная ссылка для клиента. Обновили Excel — цены на той же странице уже новые.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={tab === 'general' ? 'secondary' : 'ghost'}
          onClick={() => setTab('general')}
        >
          Общие каталоги
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === 'personal' ? 'secondary' : 'ghost'}
          onClick={() => setTab('personal')}
        >
          Персональные КП
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {(tab === 'general' ? allowGeneral : allowPersonal) && (
          <Button type="button" onClick={() => setModal(true)}>
            <Plus className="h-4 w-4" />
            {tab === 'general' ? 'Создать каталог' : 'Создать КП для клиента'}
          </Button>
        )}
        {tab === 'personal' && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск клиента"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Загрузка…</p>
      ) : list.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Пока пусто. Создайте первый документ и скопируйте ссылку.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((item) => (
            <CatalogueCard
              key={item.id}
              item={item}
              canUpdateExcel={canUpdateCatalogueExcel(opts)}
              canToggle={canDeactivateCatalogue(opts)}
              canDelete={canDeleteCatalogue(opts)}
              onUpdateExcel={(file) => updateExcel(item.id, file)}
              onToggle={() => toggleActive(item.id, !item.isActive)}
              onDelete={() => deleteCatalogue(item.id)}
            />
          ))}
        </div>
      )}

      <CreateCatalogueModal
        open={modal}
        onClose={() => setModal(false)}
        defaultType={tab}
        clients={clients}
        allowGeneral={allowGeneral}
        allowPersonal={allowPersonal}
        onCreate={createCatalogue}
      />
    </div>
  )
}
