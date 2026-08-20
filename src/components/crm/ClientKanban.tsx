import type { Client } from '@/types/client.types'
import type { ClientStage } from '@/constants/clientStages'
import { useClientStages } from '@/hooks/useClientStages'
import { ClientCard } from './ClientCard'

interface ClientKanbanProps {
  clients: Client[]
  /** funnel = active pipeline; archive = отказ / провалено / заброшено */
  mode?: 'funnel' | 'archive'
  showAssignee?: boolean
  onOpen: (client: Client) => void
  onStageChange: (clientId: string, stage: ClientStage, previous: ClientStage) => void
  onCompleteStep?: (clientId: string) => void
}

export function ClientKanban({
  clients,
  mode = 'funnel',
  showAssignee,
  onOpen,
  onStageChange,
  onCompleteStep,
}: ClientKanbanProps) {
  const { funnel, closed } = useClientStages()
  const columns = mode === 'archive' ? closed : funnel

  if (mode === 'archive' && columns.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-surface px-4 py-16 text-center text-sm text-muted shadow-sm">
        Архивных этапов нет. Добавьте «Отказ / Провалено / Заброшено» в Настройках.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {mode === 'archive' && (
        <p className="text-xs text-muted">
          Архив: карточки не удаляются — здесь отказы, проваленные и заброшенные сделки.
          Откройте карточку, чтобы вернуть в воронку.
        </p>
      )}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((stage) => {
          const column = clients.filter((c) => c.stage === stage.value)
          return (
            <div
              key={stage.value}
              className="w-72 shrink-0 space-y-2 rounded-xl bg-background/80 p-2 sm:w-80"
            >
              <div className="flex items-center justify-between px-1 py-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {stage.label}
                </h3>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-text">
                  {column.length}
                </span>
              </div>
              {column.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted">Пусто</p>
              ) : (
                column.map((client) => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    showAssignee={showAssignee}
                    onOpen={onOpen}
                    onStageChange={onStageChange}
                    onCompleteStep={onCompleteStep}
                  />
                ))
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
