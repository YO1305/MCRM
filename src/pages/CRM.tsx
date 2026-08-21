import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Brain, LayoutGrid, List, Plus, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'
import { useClients } from '@/hooks/useClients'
import { useUsers } from '@/hooks/useUsers'
import { useDeletionRequests } from '@/hooks/useDeletionRequests'
import { useAiTasks } from '@/hooks/useAiTasks'
import { Button } from '@/components/ui/Button'
import { CreateClientModal } from '@/components/crm/CreateClientModal'
import { ClientKanban } from '@/components/crm/ClientKanban'
import { ClientListView } from '@/components/crm/ClientListView'
import { ClientDetail } from '@/components/crm/ClientDetail'
import { CrmAiTasksPanel } from '@/components/crm/CrmAiTasksPanel'
import { type ClientStage, stageIsClosed, stageIsWon } from '@/constants/clientStages'
import { useClientStages } from '@/hooks/useClientStages'
import { POSITION_LABELS } from '@/constants/positions'
import { todayISO, getCurrentMonth } from '@/utils/dates'
import { clientActionDeadline } from '@/utils/clientWork'
import type { ActivityStatus, Client } from '@/types/client.types'
import type { GroqActivityLabel } from '@/types/aiActivity.types'
import { canSeeLeadActivity, resolveActivityStatus } from '@/utils/leadActivity'
import { groqActivityIsCurrent, kpiMonthIsCurrent } from '@/utils/groqLeadActivity'
import { useAiConfig } from '@/hooks/useAiConfig'

type CrmSection = 'funnel' | 'ai'
type ViewMode = 'list' | 'kanban'
type ScopeFilter = 'active' | 'today' | 'overdue' | 'deal' | 'archive' | 'all'

export function CRM() {
  const { user, isAdmin } = useAuth()
  const { canAccess } = useRole()
  const {
    clients,
    loading,
    error,
    createClient,
    updateClient,
    setStage,
    addNote,
    addSalesNote,
    assignSalesManager,
    setWaitStatus,
    setNextStep,
    completeNextStep,
    setVisit,
    logCall,
    logSamplesSent,
    deleteClient,
  } = useClients()
  const { requestDeletion, requests: deletionRequests } = useDeletionRequests()
  const canManage = canAccess('crm')
  const { users, loading: usersLoading } = useUsers(canManage && isAdmin)
  const { pipeline } = useClientStages()
  const { pendingCount } = useAiTasks()

  const [section, setSection] = useState<CrmSection>('funnel')
  const [view, setView] = useState<ViewMode>('kanban')
  const [scope, setScope] = useState<ScopeFilter>('active')
  const [stageFilter, setStageFilter] = useState<ClientStage | 'all'>('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [waitFilter, setWaitFilter] = useState('all')
  const [activityFilter, setActivityFilter] = useState<ActivityStatus | 'all'>('all')
  const [groqFilter, setGroqFilter] = useState<GroqActivityLabel | 'all'>('all')
  const [kpiFilter, setKpiFilter] = useState<'all' | 'yes' | 'no'>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const today = todayISO()
  const showActivity = isAdmin || canSeeLeadActivity(user)
  const { config: aiConfig } = useAiConfig()
  const activityThresholds = {
    touchThresholdDays: aiConfig?.touchThresholdDays,
    movementThresholdDays: aiConfig?.movementThresholdDays,
    maxActiveMonths: aiConfig?.maxActiveMonths,
  }
  const selected = useMemo(
    () => (selectedId ? clients.find((c) => c.id === selectedId) || null : null),
    [clients, selectedId],
  )

  useEffect(() => {
    const id = searchParams.get('client')
    if (id) setSelectedId(id)
    const tab = searchParams.get('tab')
    if (tab === 'ai') setSection('ai')
    else if (tab === 'funnel') setSection('funnel')
  }, [searchParams])

  function setCrmSection(next: CrmSection) {
    setSection(next)
    const params = new URLSearchParams(searchParams)
    if (next === 'ai') params.set('tab', 'ai')
    else params.delete('tab')
    setSearchParams(params, { replace: true })
  }

  function openClient(client: Client) {
    setSelectedId(client.id)
  }

  function openClientById(clientId: string) {
    setSelectedId(clientId)
  }

  function closeClient() {
    setSelectedId(null)
    if (searchParams.get('client')) {
      const next = new URLSearchParams(searchParams)
      next.delete('client')
      setSearchParams(next, { replace: true })
    }
  }

  const teamUsers = useMemo(() => {
    if (!isAdmin) return []
    return users.filter((u) => u.isActive !== false)
  }, [isAdmin, users])

  const waitOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of clients) {
      if (c.waitStatus) set.add(c.waitStatus)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [clients])

  const scoped = useMemo(() => {
    let list = clients
    if (isAdmin && assigneeFilter !== 'all') {
      list = list.filter((c) => c.assignedTo === assigneeFilter)
    }
    return list
  }, [clients, isAdmin, assigneeFilter])

  const stats = useMemo(() => {
    const active = scoped.filter((c) => !stageIsWon(c.stage) && !stageIsClosed(c.stage))
    const deadlineOf = (c: Client) => clientActionDeadline(c)
    return {
      total: scoped.length,
      active: active.length,
      today: active.filter((c) => deadlineOf(c) === today).length,
      overdue: active.filter((c) => {
        const d = deadlineOf(c)
        return !!d && d < today
      }).length,
      deal: scoped.filter((c) => stageIsWon(c.stage)).length,
      archive: scoped.filter((c) => stageIsClosed(c.stage)).length,
      pipelineSum: scoped
        .filter((c) => !stageIsClosed(c.stage) && c.dealAmount)
        .reduce((sum, c) => sum + (c.dealAmount || 0), 0),
    }
  }, [scoped, today])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scoped.filter((c) => {
      if (q) {
        const hay = `${c.name} ${c.phone} ${c.company} ${c.email} ${c.notes} ${c.waitStatus || ''} ${c.salesManagerName || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (stageFilter !== 'all' && c.stage !== stageFilter) return false
      if (waitFilter !== 'all' && c.waitStatus !== waitFilter) return false
      if (
        showActivity &&
        activityFilter !== 'all' &&
        resolveActivityStatus(c, activityThresholds) !== activityFilter
      ) {
        return false
      }
      if (isAdmin && groqFilter !== 'all') {
        const month = getCurrentMonth()
        if (!groqActivityIsCurrent(c, month) || c.activityLabel !== groqFilter) return false
      }
      if (isAdmin && kpiFilter !== 'all') {
        const month = getCurrentMonth()
        if (!kpiMonthIsCurrent(c, month)) return false
        if (kpiFilter === 'yes' && c.kpiQualified !== true) return false
        if (kpiFilter === 'no' && c.kpiQualified !== false) return false
      }

      const deadline = clientActionDeadline(c)
      const inWork = !stageIsWon(c.stage) && !stageIsClosed(c.stage)
      switch (scope) {
        case 'active':
          return inWork
        case 'today':
          return deadline === today && inWork
        case 'overdue':
          return !!deadline && deadline < today && inWork
        case 'deal':
          return stageIsWon(c.stage)
        case 'archive':
          return stageIsClosed(c.stage)
        default:
          return true
      }
    })
  }, [scoped, search, stageFilter, waitFilter, activityFilter, groqFilter, kpiFilter, showActivity, isAdmin, activityThresholds, scope, today])

  async function handleStageChange(
    clientId: string,
    stage: ClientStage,
    previous: ClientStage,
  ) {
    try {
      await setStage(clientId, stage, previous)
    } catch (err) {
      console.error(err)
      alert('Не удалось сменить этап')
    }
  }

  async function handleCompleteStep(clientId: string) {
    try {
      await completeNextStep(clientId)
    } catch (err) {
      console.error(err)
      alert('Не удалось отметить шаг выполненным')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">CRM</h1>
          <p className="mt-1 text-sm text-muted">
            {section === 'ai'
              ? 'Советы и действия ИИ по лидам'
              : isAdmin
                ? `Активных: ${stats.active} · контактов сегодня: ${stats.today}`
                : 'Ваши клиенты и лиды'}
            {section === 'funnel' && stats.overdue > 0
              ? ` · просрок контакта: ${stats.overdue}`
              : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {section === 'funnel' && (
            <>
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Новый клиент
              </Button>
              <div className="flex rounded-lg border border-gray-200 bg-surface p-1">
                <button
                  type="button"
                  onClick={() => setView('kanban')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                    view === 'kanban' ? 'bg-primary text-white' : 'text-muted hover:text-text'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Канбан
                </button>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                    view === 'list' ? 'bg-primary text-white' : 'text-muted hover:text-text'
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  Список
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCrmSection('funnel')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
            section === 'funnel'
              ? 'bg-primary text-white'
              : 'bg-surface text-muted shadow-sm hover:text-text'
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          Воронка
        </button>
        <button
          type="button"
          onClick={() => setCrmSection('ai')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
            section === 'ai'
              ? 'bg-violet-700 text-white'
              : 'bg-surface text-muted shadow-sm hover:text-text'
          }`}
        >
          <Brain className="h-4 w-4" />
          ИИ помощник
          {pendingCount > 0 && (
            <span
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                section === 'ai' ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-800'
              }`}
            >
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {section === 'ai' ? (
        <CrmAiTasksPanel onOpenClient={openClientById} />
      ) : (
        <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatChip label="Всего" value={stats.total} />
        <StatChip label="В работе" value={stats.active} tone="secondary" />
        <StatChip
          label="Просрок контакта"
          value={stats.overdue}
          tone={stats.overdue > 0 ? 'danger' : 'muted'}
        />
        <StatChip label="Сделки" value={stats.deal} tone="success" />
      </div>

      {stats.archive > 0 && (
        <p className="text-xs text-muted">
          В архиве (отказ / провалено / заброшено): {stats.archive}
        </p>
      )}

      {stats.pipelineSum > 0 && (
        <p className="text-xs text-muted">
          Сумма в воронке (без архива): {stats.pipelineSum.toLocaleString('ru-RU')} сум
        </p>
      )}

      {showActivity && (
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all', 'Все'],
              ['new', 'Новые'],
              ['active', 'Активные'],
              ['critical', 'Критические'],
              ['frozen', 'Замороженные'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActivityFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activityFilter === key
                  ? 'bg-secondary text-white'
                  : 'bg-surface text-muted shadow-sm hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
            За месяц
          </span>
          {(
            [
              ['all', 'Все'],
              ['active', 'Активные'],
              ['passive', 'Пассивные'],
              ['paused', 'На паузе'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setGroqFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                groqFilter === key
                  ? 'bg-emerald-700 text-white'
                  : 'bg-surface text-muted shadow-sm hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
            KPI
          </span>
          {(
            [
              ['all', 'Все'],
              ['yes', 'KPI лиды'],
              ['no', 'Не в KPI'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setKpiFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                kpiFilter === key
                  ? 'bg-emerald-700 text-white'
                  : 'bg-surface text-muted shadow-sm hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isAdmin && teamUsers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAssigneeFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              assigneeFilter === 'all'
                ? 'bg-secondary text-white'
                : 'bg-surface text-muted shadow-sm hover:text-text'
            }`}
          >
            Все менеджеры
          </button>
          {teamUsers.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setAssigneeFilter(u.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                assigneeFilter === u.id
                  ? 'bg-secondary text-white'
                  : 'bg-surface text-muted shadow-sm hover:text-text'
              }`}
            >
              {u.name}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-[13px] z-10 h-4 w-4 text-muted" />
        <input
          name="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск: имя, телефон, компания..."
          className="w-full rounded-lg border border-gray-200 bg-surface py-2.5 pl-9 pr-3 text-sm text-text outline-none placeholder:text-muted focus:border-secondary focus:ring-2 focus:ring-secondary/20"
        />
      </div>

      {waitOptions.length > 0 && (
        <div className="flex flex-col gap-1.5 sm:max-w-xs">
          <label className="text-xs font-medium text-muted">Статус ожидания</label>
          <select
            value={waitFilter}
            onChange={(e) => setWaitFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
          >
            <option value="all">Все статусы</option>
            {waitOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['active', 'В работе'],
            ['today', 'Контакт сегодня'],
            ['overdue', 'Просрок'],
            ['deal', 'Сделки'],
            ['archive', 'Архив'],
            ['all', 'Все'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setScope(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              scope === key
                ? 'bg-primary text-white'
                : 'bg-surface text-muted shadow-sm hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'list' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStageFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              stageFilter === 'all'
                ? 'bg-secondary text-white'
                : 'bg-surface text-muted shadow-sm'
            }`}
          >
            Все этапы
          </button>
          {pipeline.map((stage) => (
            <button
              key={stage.value}
              type="button"
              onClick={() => setStageFilter(stage.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                stageFilter === stage.value
                  ? 'bg-secondary text-white'
                  : 'bg-surface text-muted shadow-sm'
              }`}
            >
              {stage.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : view === 'kanban' ? (
        <ClientKanban
          clients={
            scope === 'archive'
              ? filtered
              : filtered.filter((c) => !stageIsClosed(c.stage))
          }
          mode={scope === 'archive' ? 'archive' : 'funnel'}
          showAssignee={isAdmin && assigneeFilter === 'all'}
          onOpen={openClient}
          onStageChange={handleStageChange}
          onCompleteStep={handleCompleteStep}
        />
      ) : (
        <ClientListView
          clients={filtered}
          showAssignee={isAdmin && assigneeFilter === 'all'}
          onOpen={openClient}
          onStageChange={handleStageChange}
          onCompleteStep={handleCompleteStep}
        />
      )}

      {!loading && filtered.length > 0 && view === 'list' && (
        <p className="text-center text-xs text-muted">
          Показано {filtered.length}
          {isAdmin && assigneeFilter !== 'all'
            ? ` · ${teamUsers.find((u) => u.id === assigneeFilter)?.name || ''}`
            : ''}
          {assigneeFilter === 'all' && isAdmin
            ? ` · ${POSITION_LABELS[user?.position || 'head']}`
            : ''}
        </p>
      )}
        </>
      )}

      <ClientDetail
        client={selected}
        canDelete={isAdmin}
        hasPendingDeletion={
          !!selected &&
          deletionRequests.some(
            (r) => r.clientId === selected.id && r.status === 'pending',
          )
        }
        onClose={closeClient}
        onSave={async (id, data, previousStage) => {
          await updateClient(id, data, { previousStage })
        }}
        onDelete={deleteClient}
        onRequestDelete={async (client, reason) => {
          await requestDeletion(client, reason)
        }}
        onAddNote={addNote}
        onAddSalesNote={addSalesNote}
        onAssignSales={assignSalesManager}
        onSetWaitStatus={setWaitStatus}
        onSetNextStep={setNextStep}
        onCompleteNextStep={completeNextStep}
        onSetVisit={setVisit}
        onLogCall={logCall}
        onLogSamples={logSamplesSent}
      />

      <CreateClientModal
        open={createOpen}
        users={isAdmin ? users : user ? [user] : []}
        usersLoading={usersLoading}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (input, assignee) => {
          await createClient(input, assignee)
        }}
      />
    </div>
  )
}

function StatChip({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'secondary' | 'danger' | 'success' | 'muted'
}) {
  const tones = {
    default: 'bg-surface text-text',
    secondary: 'bg-secondary/10 text-secondary',
    danger: 'bg-red-50 text-danger',
    success: 'bg-emerald-50 text-emerald-700',
    muted: 'bg-surface text-muted',
  }
  return (
    <div className={`rounded-xl px-3 py-2.5 shadow-sm ${tones[tone]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-xl font-bold">{value}</p>
    </div>
  )
}
