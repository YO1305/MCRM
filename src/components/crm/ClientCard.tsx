import { Phone, Building2, Calendar, Check, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { Client } from '@/types/client.types'
import {
  stageIsClosed,
  stageIsWon,
  stageLabel,
  leadKpiTrackingEnabled,
  type ClientStage,
} from '@/constants/clientStages'
import { stageBadge, CLIENT_SOURCES, LEAD_CATEGORIES } from '@/constants/clientMeta'
import { countryName } from '@/constants/leadProducts'
import { todayISO } from '@/utils/dates'
import { clientActionDeadline, clientHasActiveStep } from '@/utils/clientWork'
import { useClientStages } from '@/hooks/useClientStages'

interface ClientCardProps {
  client: Client
  showAssignee?: boolean
  onOpen: (client: Client) => void
  onStageChange: (clientId: string, stage: ClientStage, previous: ClientStage) => void
  onCompleteStep?: (clientId: string) => void
}

export function ClientCard({
  client,
  showAssignee,
  onOpen,
  onStageChange,
  onCompleteStep,
}: ClientCardProps) {
  const { funnel, closed: archiveStages } = useClientStages()
  const today = todayISO()
  const deadline = clientActionDeadline(client)
  const isArchived = stageIsClosed(client.stage)
  const won = stageIsWon(client.stage)
  const contactOverdue = !!deadline && deadline < today && !isArchived && !won
  const stepActive = clientHasActiveStep(client)

  const nextStages = funnel.filter((s) => s.value !== client.stage).slice(0, 2)
  const rejectStage = closedStagesFind(archiveStages, 'rejected') || 'rejected'
  const failedStage = closedStagesFind(archiveStages, 'failed') || 'failed'
  const abandonedStage = closedStagesFind(archiveStages, 'abandoned') || 'abandoned'

  return (
    <article
      className={`rounded-xl border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md ${
        contactOverdue ? 'border-danger/40' : 'border-gray-100'
      }`}
    >
      <button type="button" onClick={() => onOpen(client)} className="w-full text-left">
        <div className="flex flex-wrap items-start gap-2">
          <h3 className="flex-1 text-sm font-semibold text-text">{client.name}</h3>
          <Badge variant={stageBadge(client.stage)}>{stageLabel(client.stage)}</Badge>
        </div>

        <div className="mt-2 space-y-1 text-xs text-muted">
          {client.company && (
            <p className="flex items-center gap-1.5">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{client.company}</span>
            </p>
          )}
          <p className="flex items-center gap-1.5">
            <Phone className="h-3 w-3 shrink-0" />
            <span>{client.phone}</span>
          </p>
          {deadline && (
            <p
              className={`flex items-center gap-1.5 ${
                contactOverdue ? 'font-medium text-danger' : ''
              }`}
            >
              <Calendar className="h-3 w-3 shrink-0" />
              <span>
                {stepActive ? 'шаг' : 'контакт'} {deadline}
                {contactOverdue ? ' · просрок' : ''}
              </span>
            </p>
          )}
          {stepActive && client.nextStep && (
            <p className="line-clamp-2 pl-5 text-xs text-text">{client.nextStep}</p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          {showAssignee && (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">
              {client.assignedToName}
            </span>
          )}
          {client.salesManagerName && (
            <span className="rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
              Продажи: {client.salesManagerName}
            </span>
          )}
          {client.waitStatus && (
            <span className="rounded-md bg-yellow-50 px-2 py-0.5 font-medium text-yellow-800">
              ⏳ {client.waitStatus}
            </span>
          )}
          {client.visitDate && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
              <MapPin className="h-3 w-3" />
              приезд {client.visitDate}
            </span>
          )}
          <span className="rounded-md bg-background px-2 py-0.5">
            {CLIENT_SOURCES[client.source] || client.source}
          </span>
          {client.country && (
            <span className="rounded-md bg-background px-2 py-0.5">
              {countryName(client.country)}
            </span>
          )}
          {(client.categories?.length
            ? client.categories
            : client.category
              ? [client.category]
              : []
          ).map((cat) => (
            <span
              key={cat}
              className="rounded-md bg-secondary/10 px-2 py-0.5 font-medium text-secondary"
            >
              {LEAD_CATEGORIES[cat]}
            </span>
          ))}
          {client.kpiLeadCounted && leadKpiTrackingEnabled() && (
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
              KPI ✓
            </span>
          )}
          {client.lastSamplesSentAt && (
            <span className="rounded-md bg-sky-50 px-2 py-0.5 font-medium text-sky-800">
              Образцы {client.lastSamplesSentAt}
            </span>
          )}
          {client.dealAmount != null && client.dealAmount > 0 && (
            <span className="font-medium text-text">
              {client.dealAmount.toLocaleString('ru-RU')} сум
            </span>
          )}
        </div>
      </button>

      {!isArchived && !won && (
        <div className="mt-3 flex flex-wrap gap-2">
          {stepActive && onCompleteStep && (
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => onCompleteStep(client.id)}
            >
              <Check className="h-3.5 w-3.5" />
              Шаг выполнен
            </Button>
          )}
          {nextStages.map((stage) => (
            <Button
              key={stage.value}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onStageChange(client.id, stage.value, client.stage)}
            >
              → {stage.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onStageChange(client.id, rejectStage, client.stage)}
          >
            Отказ
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onStageChange(client.id, failedStage, client.stage)}
          >
            Провалено
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onStageChange(client.id, abandonedStage, client.stage)}
          >
            Заброшено
          </Button>
        </div>
      )}

      {isArchived && (
        <div className="mt-3 flex flex-wrap gap-2">
          <p className="w-full text-[11px] text-muted">В архиве · можно вернуть в воронку</p>
          {funnel.slice(0, 3).map((stage) => (
            <Button
              key={stage.value}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onStageChange(client.id, stage.value, client.stage)}
            >
              → {stage.label}
            </Button>
          ))}
        </div>
      )}
    </article>
  )
}

function closedStagesFind(
  list: { value: string; isRejected?: boolean; isFailed?: boolean; isAbandoned?: boolean }[],
  kind: 'rejected' | 'failed' | 'abandoned',
): string | null {
  const hit = list.find((s) =>
    kind === 'rejected'
      ? s.isRejected
      : kind === 'failed'
        ? s.isFailed
        : s.isAbandoned,
  )
  return hit?.value || null
}
