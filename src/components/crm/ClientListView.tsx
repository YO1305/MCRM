import type { Client } from '@/types/client.types'
import type { ClientStage } from '@/constants/clientStages'
import { ClientCard } from './ClientCard'

interface ClientListProps {
  clients: Client[]
  showAssignee?: boolean
  onOpen: (client: Client) => void
  onStageChange: (clientId: string, stage: ClientStage, previous: ClientStage) => void
  onCompleteStep?: (clientId: string) => void
}

export function ClientListView({
  clients,
  showAssignee,
  onOpen,
  onStageChange,
  onCompleteStep,
}: ClientListProps) {
  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-surface px-4 py-16 text-center text-sm text-muted shadow-sm">
        Клиентов пока нет
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {clients.map((client) => (
        <ClientCard
          key={client.id}
          client={client}
          showAssignee={showAssignee}
          onOpen={onOpen}
          onStageChange={onStageChange}
          onCompleteStep={onCompleteStep}
        />
      ))}
    </div>
  )
}
