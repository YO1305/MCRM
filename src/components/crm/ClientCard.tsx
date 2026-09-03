import { Building2, Check, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { Client } from '@/types/client.types'
import {
  stageIsClosed,
  stageIsWon,
  stageLabel,
  type ClientStage,
} from '@/constants/clientStages'
import { stageBadge, LEAD_CATEGORIES } from '@/constants/clientMeta'
import { countryName } from '@/constants/leadProducts'
import { clientHasActiveStep, clientStepOverdue } from '@/utils/clientWork'
import { useClientStages } from '@/hooks/useClientStages'
import { useAuth } from '@/hooks/useAuth'
import { ActivityBadge } from '@/components/crm/ActivityBadge'
import { GroqActivityBadge } from '@/components/crm/GroqActivityBadge'
import { ActiveDaysMeter } from '@/components/crm/ActiveDaysMeter'
import { KpiBadge } from '@/components/crm/KpiBadge'
import { IdleTouchHint } from '@/components/crm/IdleTouchHint'
import { calculateActiveMonths } from '@/utils/dateUtils'
import { canSeeLeadActivity, resolveActivityStatus, resolveOpenedMonth } from '@/utils/leadActivity'
import { useAiActivityConfig } from '@/hooks/useAiActivityConfig'
import { effectiveGroqActivity, kpiMonthIsCurrent } from '@/utils/groqLeadActivity'
import { getCurrentMonth } from '@/utils/dates'

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
  const { user, isAdmin } = useAuth()
  const showActivity = isAdmin || canSeeLeadActivity(user)
  const { config: activityConfig } = useAiActivityConfig()
  const month = getCurrentMonth()
  const groqUi = effectiveGroqActivity(client, month)
  const kpiCurrent = kpiMonthIsCurrent(client, month)
  const minDays = activityConfig?.minActiveDays ?? 10
  const [moreOpen, setMoreOpen] = useState(false)

  const isArchived = stageIsClosed(client.stage)
  const won = stageIsWon(client.stage)
  const stepActive = clientHasActiveStep(client)
  const stepOverdue = clientStepOverdue(client)

  const stageIndex = funnel.findIndex((s) => s.value === client.stage)
  const nextStage =
    stageIndex >= 0 && stageIndex < funnel.length - 1 ? funnel[stageIndex + 1] : null
  const rejectStage = closedStagesFind(archiveStages, 'rejected') || 'rejected'
  const failedStage = closedStagesFind(archiveStages, 'failed') || 'failed'
  const abandonedStage = closedStagesFind(archiveStages, 'abandoned') || 'abandoned'

  const categoryKey =
    (client.categories?.length ? client.categories[0] : null) || client.category || null
  const categoryLabel = categoryKey ? LEAD_CATEGORIES[categoryKey] || categoryKey : null

  return (
    <article
      className={`rounded-xl border bg-surface p-3 shadow-sm transition-shadow hover:shadow-md ${
        stepOverdue ? 'border-danger/40' : 'border-gray-100'
      }`}
    >
      <button type="button" onClick={() => onOpen(client)} className="w-full text-left">
        <div className="flex flex-wrap items-start gap-1.5">
          <h3 className="flex-1 text-sm font-semibold text-text">{client.name}</h3>
          <Badge variant={stageBadge(client.stage)}>{stageLabel(client.stage)}</Badge>
          {showActivity && (
            <ActivityBadge
              status={resolveActivityStatus(client)}
              months={calculateActiveMonths(resolveOpenedMonth(client))}
            />
          )}
          {isAdmin && (
            <GroqActivityBadge
              label={groqUi.label}
              days={client.activeDaysThisMonth}
              reason={client.activityReason}
              current={Boolean(groqUi.label)}
              carried={groqUi.carried}
            />
          )}
          {isAdmin && (
            <KpiBadge
              qualified={client.kpiQualified}
              moments={client.kpiSignificantMoments}
              reason={client.kpiQualificationReason}
              current={kpiCurrent}
            />
          )}
        </div>

        <div className="mt-1.5 space-y-1 text-xs text-muted">
          {client.company && (
            <p className="flex items-center gap-1.5 truncate">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{client.company}</span>
            </p>
          )}
          {stepActive && client.nextStep && (
            <p
              className={`line-clamp-2 rounded-md px-2 py-1 ${
                stepOverdue ? 'bg-red-50 text-danger' : 'bg-secondary/5 text-text'
              }`}
            >
              {client.nextStep}
              {client.nextStepDeadline ? ` · до ${client.nextStepDeadline}` : ''}
              {stepOverdue ? ' · просрок' : ''}
            </p>
          )}
          {isAdmin ? (
            <ActiveDaysMeter
              days={client.activeDaysThisMonth}
              minDays={minDays}
              month={month}
              current={Boolean(groqUi.label)}
              carried={groqUi.carried}
            />
          ) : (
            <IdleTouchHint client={client} />
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          {showAssignee && (
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
              {client.assignedToName}
            </span>
          )}
          {client.waitStatus && (
            <span className="rounded-md bg-yellow-50 px-1.5 py-0.5 font-medium text-yellow-800">
              ⏳ {client.waitStatus}
            </span>
          )}
          {client.country && (
            <span className="rounded-md bg-background px-1.5 py-0.5">
              {countryName(client.country)}
            </span>
          )}
          {categoryLabel && (
            <span className="rounded-md bg-secondary/10 px-1.5 py-0.5 font-medium text-secondary">
              {categoryLabel}
            </span>
          )}
        </div>
      </button>

      {!isArchived && !won && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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
          {nextStage && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onStageChange(client.id, nextStage.value, client.stage)}
            >
              → {nextStage.label}
            </Button>
          )}
          <div className="relative">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="Ещё действия"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            {moreOpen && (
              <div className="absolute right-0 z-20 mt-1 min-w-[140px] rounded-lg border border-gray-100 bg-surface p-1 shadow-lg">
                <button
                  type="button"
                  className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-text hover:bg-background"
                  onClick={() => {
                    setMoreOpen(false)
                    onStageChange(client.id, rejectStage, client.stage)
                  }}
                >
                  Отказ
                </button>
                <button
                  type="button"
                  className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-text hover:bg-background"
                  onClick={() => {
                    setMoreOpen(false)
                    onStageChange(client.id, failedStage, client.stage)
                  }}
                >
                  Провалено
                </button>
                <button
                  type="button"
                  className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-text hover:bg-background"
                  onClick={() => {
                    setMoreOpen(false)
                    onStageChange(client.id, abandonedStage, client.stage)
                  }}
                >
                  Заброшено
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isArchived && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <p className="w-full text-[11px] text-muted">В архиве · вернуть в воронку</p>
          {funnel.slice(0, 2).map((stage) => (
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
