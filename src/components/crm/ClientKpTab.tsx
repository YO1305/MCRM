import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CatalogueCard } from '@/components/catalogue/CatalogueCard'
import { CreateCatalogueModal } from '@/components/catalogue/CreateCatalogueModal'
import { useCatalogues } from '@/hooks/useCatalogues'
import { useAuth } from '@/hooks/useAuth'
import {
  canCreatePersonalKp,
  canDeactivateCatalogue,
  canDeleteCatalogue,
  canUpdateCatalogueExcel,
} from '@/utils/catalogueAccess'
import type { Client } from '@/types/client.types'

export function ClientKpTab({ client }: { client: Client }) {
  const { isAdmin, user } = useAuth()
  const opts = { isAdmin, position: user?.position }
  const { catalogues, allCatalogues, createCatalogue, updateExcel, toggleActive, deleteCatalogue, attachToClient } =
    useCatalogues('personal', client.id)
  const [createOpen, setCreateOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)

  const others = allCatalogues.filter((c) => c.clientId !== client.id)

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canCreatePersonalKp(opts) && (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            Создать КП
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={() => setAttachOpen((v) => !v)}>
          Прикрепить существующий
        </Button>
      </div>

      {attachOpen && (
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="mb-2 text-xs text-muted">Выберите каталог или КП — для клиента появится отдельная ссылка.</p>
          {others.length === 0 ? (
            <p className="text-sm text-muted">Других каталогов нет</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {others.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{c.title}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void attachToClient(c, { id: client.id, name: client.name }).then(() =>
                        setAttachOpen(false),
                      )
                    }
                  >
                    Прикрепить
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {catalogues.length === 0 ? (
        <p className="text-sm text-muted">Для этого клиента ещё нет КП.</p>
      ) : (
        catalogues.map((item) => (
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
        ))
      )}

      <CreateCatalogueModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultType="personal"
        presetClient={{ id: client.id, name: client.name }}
        clients={[client]}
        allowGeneral={false}
        allowPersonal={canCreatePersonalKp(opts)}
        onCreate={createCatalogue}
      />
    </section>
  )
}
