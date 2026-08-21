import { useEffect, useMemo, useState } from 'react'
import { Check, MapPin, Package, Phone, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/hooks/useAuth'
import { useClientHistory } from '@/hooks/useClientHistory'
import { useDepartments } from '@/hooks/useDepartments'
import type {
  Client,
  ClientSource,
  ProductKind,
  SampleItem,
  SamplesShipmentInput,
} from '@/types/client.types'
import { stageLabel, type ClientStage } from '@/constants/clientStages'
import {
  stageBadge,
  LEAD_CATEGORIES,
} from '@/constants/clientMeta'
import { EditableOptionSelect } from '@/components/admin/EditableOptionSelect'
import { useOptionList } from '@/hooks/useOptionList'
import { useClientStages } from '@/hooks/useClientStages'
import type { LeadCategory } from '@/types/kpiLead.types'
import {
  FABRIC_TYPES,
  GP_TYPES,
  PRODUCT_KIND_LABELS,
  countryName,
  primaryKpiCategory,
  resolveKpiCategories,
} from '@/constants/leadProducts'
import { CountrySelect } from '@/components/crm/CountrySelect'
import { WAIT_STATUS_PRESETS } from '@/constants/waitStatus'
import { formatISODateShort, todayISO, addDaysISO, getCurrentMonth } from '@/utils/dates'
import { clientStepOverdue, visitPrepareDate } from '@/utils/clientWork'
import { ActivityBadge } from '@/components/crm/ActivityBadge'
import { GroqActivityBadge } from '@/components/crm/GroqActivityBadge'
import { ActiveDaysMeter } from '@/components/crm/ActiveDaysMeter'
import { KpiBadge, KpiMomentsMeter } from '@/components/crm/KpiBadge'
import { IdleTouchHint } from '@/components/crm/IdleTouchHint'
import { calculateActiveMonths, resolveOpenedDateFromClient } from '@/utils/dateUtils'
import { canSeeLeadActivity, resolveActivityStatus, resolveOpenedMonth } from '@/utils/leadActivity'
import { useAiActivityConfig } from '@/hooks/useAiActivityConfig'
import { groqActivityIsCurrent, kpiMonthIsCurrent } from '@/utils/groqLeadActivity'
import { ClientKpTab } from '@/components/crm/ClientKpTab'

interface ClientDetailProps {
  client: Client | null
  canDelete?: boolean
  hasPendingDeletion?: boolean
  onClose: () => void
  onSave: (
    clientId: string,
    data: {
      name: string
      phone: string
      company: string
      email: string
      stage: ClientStage
      source: ClientSource
      exhibitionName?: string
      exhibitionDate?: string | null
      notes: string
      nextContactDate: string | null
      dealAmount: number | null
      country: string | null
      products: ProductKind[]
      fabricTypes: string[]
      gpTypes: string[]
      category: LeadCategory | null
      categories: LeadCategory[]
      openedDate?: string | null
      openedMonth?: string | null
    },
    previousStage: ClientStage,
  ) => Promise<void>
  onDelete: (clientId: string) => Promise<void>
  onRequestDelete?: (client: Client, reason: string) => Promise<void>
  onAddNote: (clientId: string, text: string) => Promise<void>
  onAddSalesNote: (clientId: string, text: string) => Promise<void>
  onAssignSales: (
    clientId: string,
    data: {
      salesDepartment: string
      salesDepartmentName: string
      salesManagerId: string
      salesManagerName: string
    },
  ) => Promise<void>
  onSetWaitStatus: (
    clientId: string,
    status: string | null,
    followUpDate?: string | null,
  ) => Promise<void>
  onSetNextStep: (
    clientId: string,
    nextStep: string,
    nextStepDeadline: string | null,
  ) => Promise<void>
  onCompleteNextStep: (clientId: string) => Promise<void>
  onSetVisit: (
    clientId: string,
    visitDate: string | null,
    visitNote: string | null,
  ) => Promise<void>
  onLogCall: (clientId: string, text: string) => Promise<void>
  onLogSamples?: (clientId: string, shipment: SamplesShipmentInput) => Promise<void>
}

function formatTime(value: unknown) {
  const seconds = (value as { seconds?: number } | null)?.seconds
  if (!seconds) return ''
  return new Date(seconds * 1000).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toggleInList(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key]
}

const HISTORY_LABELS: Record<string, string> = {
  created: 'Создание',
  stage_change: 'Этап',
  note: 'Заметка лида',
  call: 'Звонок',
  sales_note: 'Коммент продаж',
  sales_assigned: 'Менеджер продаж',
  wait_status: 'Ожидание',
  next_step: 'След. шаг',
  samples_sent: 'Образцы',
  visit: 'Приезд',
}

export function ClientDetail({
  client,
  canDelete,
  hasPendingDeletion,
  onClose,
  onSave,
  onDelete,
  onRequestDelete,
  onAddNote,
  onAddSalesNote,
  onAssignSales,
  onSetWaitStatus,
  onSetNextStep,
  onCompleteNextStep,
  onSetVisit,
  onLogCall,
  onLogSamples,
}: ClientDetailProps) {
  const { user, isAdmin } = useAuth()
  const { departments } = useDepartments()
  const { entries, loading: historyLoading } = useClientHistory(client?.id || null)
  const sourceList = useOptionList('client_source')
  const { pipeline } = useClientStages()
  const { config: activityConfig } = useAiActivityConfig()
  const month = getCurrentMonth()
  const groqCurrent = groqActivityIsCurrent(client || {}, month)
  const kpiCurrent = kpiMonthIsCurrent(client || {}, month)
  const minDays = activityConfig?.minActiveDays ?? 10
  const minMoments = activityConfig?.minKpiMoments ?? 3

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [stage, setStage] = useState<ClientStage>('contact')
  const [source, setSource] = useState<ClientSource>('other')
  const [exhibitionName, setExhibitionName] = useState('')
  const [exhibitionDate, setExhibitionDate] = useState('')
  const [country, setCountry] = useState('UZ')
  const [products, setProducts] = useState<ProductKind[]>([])
  const [fabricTypes, setFabricTypes] = useState<string[]>([])
  const [gpTypes, setGpTypes] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [nextContactDate, setNextContactDate] = useState('')
  const [dealAmount, setDealAmount] = useState('')
  const [openedDate, setOpenedDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [historyText, setHistoryText] = useState('')
  const [leadNote, setLeadNote] = useState('')
  const [salesNote, setSalesNote] = useState('')
  const [sending, setSending] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [showDeleteForm, setShowDeleteForm] = useState(false)
  const [requestingDelete, setRequestingDelete] = useState(false)

  const [showSalesAssign, setShowSalesAssign] = useState(false)
  const [deptId, setDeptId] = useState('')
  const [salesMemberId, setSalesMemberId] = useState('')
  const [customWait, setCustomWait] = useState('')
  const [waitFollowUpDate, setWaitFollowUpDate] = useState(addDaysISO(todayISO(), 5))
  const [detailTab, setDetailTab] = useState<'info' | 'tasks' | 'notes' | 'history' | 'kp'>('tasks')
  const [nextStepText, setNextStepText] = useState('')
  const [nextStepDeadline, setNextStepDeadline] = useState('')
  const [visitDate, setVisitDate] = useState('')
  const [visitNote, setVisitNote] = useState('')
  const [showSamples, setShowSamples] = useState(false)
  const [sampleDate, setSampleDate] = useState(todayISO())
  const [sampleNote, setSampleNote] = useState('')
  const [sampleRows, setSampleRows] = useState<SampleItem[]>([{ name: '', params: '' }])
  const [savingSamples, setSavingSamples] = useState(false)

  useEffect(() => {
    if (!client) return
    setName(client.name)
    setPhone(client.phone)
    setCompany(client.company || '')
    setEmail(client.email || '')
    setStage(client.stage)
    setSource(client.source)
    setExhibitionName(client.exhibitionName || '')
    setExhibitionDate(client.exhibitionDate || '')
    setCountry(client.country || 'UZ')
    setProducts(
      client.products?.length
        ? client.products
        : client.category === 'finished'
          ? ['finished']
          : client.category === 'fabric'
            ? ['fabric']
            : [],
    )
    setFabricTypes(client.fabricTypes || [])
    setGpTypes(client.gpTypes || [])
    setNotes(client.notes || '')
    setNextContactDate(client.nextContactDate || '')
    setDealAmount(client.dealAmount != null ? String(client.dealAmount) : '')
    setOpenedDate(resolveOpenedDateFromClient(client))
    setNextStepText(client.nextStep || '')
    setNextStepDeadline(client.nextStepDeadline || '')
    setWaitFollowUpDate(client.waitFollowUpDate || addDaysISO(todayISO(), 5))
    setDetailTab('tasks')
    setVisitDate(client.visitDate || '')
    setVisitNote(client.visitNote || '')
    setHistoryText('')
    setLeadNote('')
    setSalesNote('')
    setDeleteReason('')
    setShowDeleteForm(false)
    setShowSalesAssign(!client.salesManagerId)
    setDeptId(client.salesDepartment || '')
    setSalesMemberId(client.salesManagerId || '')
    setShowSamples(false)
    setSampleDate(todayISO())
    setSampleNote('')
    setSampleRows([{ name: '', params: '' }])
  }, [client])

  const selectedDept = useMemo(
    () => departments.find((d) => d.id === deptId) || null,
    [departments, deptId],
  )

  if (!client) return null

  const isLead = !!user && (isAdmin || user.id === client.assignedTo)
  const isSalesPerson = !!user && user.id === client.salesManagerId
  const canEditCore = isLead
  const canAssignSales = isLead
  const canLeadNote = isLead
  // Sales managers are often FIO-only (no CRM login) — lead/admin write sales notes too
  const canSalesNote = isLead || isSalesPerson
  const canWaitNext = isLead

  const categories = resolveKpiCategories(country, products)
  const category = primaryKpiCategory(categories)

  const leadNotes = entries
    .filter((e) => e.type === 'note')
    .slice()
    .reverse()
  const salesNotes = entries
    .filter((e) => e.type === 'sales_note')
    .slice()
    .reverse()

  function toggleProduct(kind: ProductKind) {
    if (!canEditCore) return
    setProducts((prev) => {
      if (prev.includes(kind)) {
        const next = prev.filter((p) => p !== kind)
        if (kind === 'fabric') setFabricTypes([])
        if (kind === 'finished') setGpTypes([])
        return next
      }
      return [...prev, kind]
    })
  }

  async function handleSave() {
    if (!canEditCore || !products.length) return
    setSaving(true)
    try {
      await onSave(
        client!.id,
        {
          name: name.trim(),
          phone: phone.trim(),
          company: company.trim(),
          email: email.trim(),
          stage,
          source,
          exhibitionName: sourceList.requiresExhibition(source)
            ? exhibitionName.trim()
            : '',
          exhibitionDate: sourceList.requiresExhibition(source)
            ? exhibitionDate || null
            : null,
          notes: notes.trim(),
          nextContactDate: nextContactDate || null,
          dealAmount: dealAmount ? Number(dealAmount) : null,
          openedDate: openedDate.trim() || todayISO(),
          openedMonth: (openedDate.trim() || todayISO()).slice(0, 7),
          country: country || null,
          products,
          fabricTypes: products.includes('fabric') ? fabricTypes : [],
          gpTypes: products.includes('finished') ? gpTypes : [],
          category,
          categories,
        },
        client!.stage,
      )
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Удалить клиента безвозвратно?')) return
    await onDelete(client!.id)
    onClose()
  }

  async function handleRequestDelete() {
    if (!onRequestDelete || !deleteReason.trim()) return
    setRequestingDelete(true)
    try {
      await onRequestDelete(client!, deleteReason.trim())
      setShowDeleteForm(false)
      setDeleteReason('')
      onClose()
    } finally {
      setRequestingDelete(false)
    }
  }

  async function handleLeadNote() {
    if (!leadNote.trim()) return
    setSending(true)
    try {
      await onAddNote(client!.id, leadNote)
      setLeadNote('')
    } finally {
      setSending(false)
    }
  }

  async function handleSalesNote() {
    if (!salesNote.trim()) return
    setSending(true)
    try {
      await onAddSalesNote(client!.id, salesNote)
      setSalesNote('')
    } finally {
      setSending(false)
    }
  }

  async function handleCall() {
    setSending(true)
    try {
      await onLogCall(client!.id, historyText.trim() || 'Звонок клиенту')
      setHistoryText('')
    } finally {
      setSending(false)
    }
  }

  async function handleSaveSamples() {
    if (!onLogSamples) return
    const filled = sampleRows.filter((r) => r.name.trim())
    if (!filled.length) {
      alert('Добавьте хотя бы один образец с названием')
      return
    }
    if (!sampleDate) {
      alert('Укажите дату отправки')
      return
    }
    setSavingSamples(true)
    try {
      await onLogSamples(client!.id, {
        sentDate: sampleDate,
        items: filled,
        note: sampleNote,
      })
      setShowSamples(false)
      setSampleRows([{ name: '', params: '' }])
      setSampleNote('')
      setSampleDate(todayISO())
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Не удалось сохранить образцы')
    } finally {
      setSavingSamples(false)
    }
  }

  async function handleAssignSales() {
    if (!selectedDept || !salesMemberId) return
    const member = (selectedDept.members || []).find((m) => m.id === salesMemberId)
    if (!member) return
    setSending(true)
    try {
      await onAssignSales(client!.id, {
        salesDepartment: selectedDept.id,
        salesDepartmentName: selectedDept.name,
        salesManagerId: member.id,
        salesManagerName: member.name,
      })
      setShowSalesAssign(false)
    } finally {
      setSending(false)
    }
  }

  async function handleWait(status: string) {
    if (!canWaitNext) return
    const date = waitFollowUpDate.trim()
    if (!date) {
      alert('Укажите дату, когда сами напишете клиенту')
      return
    }
    setSending(true)
    try {
      await onSetWaitStatus(client!.id, status, date)
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Не удалось сохранить статус')
    } finally {
      setSending(false)
    }
  }

  async function handleClearWait() {
    if (!canWaitNext) return
    setSending(true)
    try {
      await onSetWaitStatus(client!.id, null, null)
      setWaitFollowUpDate(addDaysISO(todayISO(), 5))
    } finally {
      setSending(false)
    }
  }

  async function handleCustomWait() {
    const value = customWait.trim()
    if (!value) return
    await handleWait(value)
    setCustomWait('')
  }

  async function handleNextStepSave() {
    if (!canWaitNext || !nextStepText.trim()) return
    setSending(true)
    try {
      await onSetNextStep(client!.id, nextStepText, nextStepDeadline || null)
    } finally {
      setSending(false)
    }
  }

  async function handleCompleteStep() {
    if (!canWaitNext) return
    setSending(true)
    try {
      await onCompleteNextStep(client!.id)
      setNextStepText('')
      setNextStepDeadline('')
    } finally {
      setSending(false)
    }
  }

  async function handleSaveVisit() {
    if (!canWaitNext || !visitDate) return
    setSending(true)
    try {
      await onSetVisit(client!.id, visitDate, visitNote)
    } finally {
      setSending(false)
    }
  }

  async function handleClearVisit() {
    if (!canWaitNext) return
    setSending(true)
    try {
      await onSetVisit(client!.id, null, null)
      setVisitDate('')
      setVisitNote('')
    } finally {
      setSending(false)
    }
  }

  const fieldDisabled = !canEditCore
  const stepOverdue = clientStepOverdue(client)
  const hasActiveStep = Boolean(client.nextStep?.trim())
  const visitReminder = client.visitDate ? visitPrepareDate(client.visitDate) : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} role="presentation" />
      <div className="relative z-10 flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-text">{client.name}</h2>
            <p className="mt-1 text-xs text-muted">
              Лид-менеджер:{' '}
              <span className="font-medium text-text">{client.assignedToName}</span>
              {client.salesManagerName && (
                <>
                  {' · '}Продажи:{' '}
                  <span className="font-medium text-text">{client.salesManagerName}</span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-background hover:text-text"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <Badge variant={stageBadge(stage)}>{stageLabel(stage)}</Badge>
            {(isAdmin || canSeeLeadActivity(user)) && (
              <ActivityBadge
                status={resolveActivityStatus(client)}
                months={calculateActiveMonths(resolveOpenedMonth(client))}
              />
            )}
            {isAdmin && (
              <GroqActivityBadge
                label={client.activityLabel}
                days={client.activeDaysThisMonth}
                reason={client.activityReason}
                current={groqCurrent}
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
            <Badge variant="default">{sourceList.labelOf(source)}</Badge>
            <Badge variant="info">{countryName(country)}</Badge>
            {categories.map((c) => (
              <Badge key={c} variant="info">
                KPI: {LEAD_CATEGORIES[c]}
              </Badge>
            ))}
            {client.waitStatus && <Badge variant="warning">{client.waitStatus}</Badge>}
            {hasActiveStep && (
              <Badge variant={stepOverdue ? 'danger' : 'info'}>
                Шаг{stepOverdue ? ' · просрок' : ''}
              </Badge>
            )}
            {client.visitDate && (
              <Badge variant="warning">Приезд {formatISODateShort(client.visitDate)}</Badge>
            )}
            {client.lastSamplesSentAt && (
              <Badge variant="info">
                Образцы {client.lastSamplesSentAt}
                {client.lastSamplesCount ? ` · ${client.lastSamplesCount}` : ''}
              </Badge>
            )}
          </div>

          {canEditCore && (
            <div className="flex flex-wrap gap-1.5">
              {pipeline.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStage(s.value)}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    stage === s.value
                      ? 'bg-secondary text-white'
                      : 'bg-background text-muted hover:text-text'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {isAdmin ? (
            <>
              <ActiveDaysMeter
                days={client.activeDaysThisMonth}
                minDays={minDays}
                month={month}
                current={groqCurrent}
              />
              <KpiMomentsMeter
                moments={client.kpiSignificantMoments}
                minMoments={minMoments}
                current={kpiCurrent}
              />
            </>
          ) : (
            <IdleTouchHint client={client} />
          )}

          <div className="flex flex-wrap gap-1.5 border-b border-gray-100 pb-3">
            {(
              [
                ['tasks', 'Задачи'],
                ['info', 'Клиент'],
                ['notes', 'Комментарии'],
                ['kp', 'КП'],
                ['history', 'История'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDetailTab(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  detailTab === key
                    ? 'bg-primary text-white'
                    : 'bg-background text-muted hover:text-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {detailTab === 'tasks' && (
          <>
          {/* Next step + visit */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section
              className={`space-y-2 rounded-xl border p-4 ${
                stepOverdue
                  ? 'border-danger/40 bg-red-50/60'
                  : hasActiveStep
                    ? 'border-secondary/30 bg-secondary/5'
                    : 'border-gray-100'
              }`}
            >
              <p className="text-sm font-semibold text-text">Следующий шаг</p>
              {hasActiveStep && (
                <div className="rounded-lg bg-surface px-3 py-2.5">
                  <p className="text-sm text-text">{client.nextStep}</p>
                  {client.nextStepDeadline && (
                    <p
                      className={`mt-1 text-xs ${
                        stepOverdue ? 'font-medium text-danger' : 'text-muted'
                      }`}
                    >
                      до {formatISODateShort(client.nextStepDeadline)}
                      {stepOverdue ? ' · просрок' : ''}
                    </p>
                  )}
                  {canWaitNext && (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-3 bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={sending}
                      onClick={() => void handleCompleteStep()}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Выполнен
                    </Button>
                  )}
                </div>
              )}
              {canWaitNext ? (
                <>
                  <Textarea
                    value={nextStepText}
                    onChange={(e) => setNextStepText(e.target.value)}
                    placeholder={hasActiveStep ? 'Новый шаг вместо текущего...' : 'Описать следующий шаг...'}
                  />
                  <Input
                    label="Срок"
                    type="date"
                    value={nextStepDeadline}
                    onChange={(e) => setNextStepDeadline(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={sending || !nextStepText.trim()}
                    onClick={() => void handleNextStepSave()}
                  >
                    {hasActiveStep ? 'Заменить шаг' : 'Сохранить шаг'}
                  </Button>
                </>
              ) : (
                !hasActiveStep && <p className="text-sm text-muted">Не задан</p>
              )}
            </section>

            <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-amber-800" />
                <p className="text-sm font-semibold text-text">Приезд клиента</p>
              </div>
              <p className="text-xs text-muted">
                Если клиент хочет приехать — укажите дату. За день до визита менеджер получит
                напоминание (если это воскресенье — в субботу).
              </p>
              {client.visitDate && (
                <div className="rounded-lg bg-white px-3 py-2.5 text-sm">
                  <p className="font-medium text-text">
                    {formatISODateShort(client.visitDate)}
                  </p>
                  {client.visitNote && (
                    <p className="mt-1 text-xs text-muted">{client.visitNote}</p>
                  )}
                  {visitReminder && (
                    <p className="mt-1 text-[11px] text-amber-800">
                      Напоминание: {formatISODateShort(visitReminder)}
                    </p>
                  )}
                </div>
              )}
              {canWaitNext ? (
                <>
                  <Textarea
                    value={visitNote}
                    onChange={(e) => setVisitNote(e.target.value)}
                    placeholder="Клиент хочет приехать, детали встречи..."
                  />
                  <Input
                    label="Дата приезда"
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={sending || !visitDate}
                      onClick={() => void handleSaveVisit()}
                    >
                      Сохранить приезд
                    </Button>
                    {client.visitDate && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={sending}
                        onClick={() => void handleClearVisit()}
                      >
                        Отменить
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                !client.visitDate && <p className="text-sm text-muted">Не запланирован</p>
              )}
            </section>
          </div>

          {/* Sales manager */}
          <section className="space-y-2 rounded-xl border border-gray-100 p-3">
            <p className="text-sm font-semibold text-text">Менеджер по продажам</p>
            {client.salesManagerId && !showSalesAssign ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-text">
                  {client.salesManagerName}
                  <span className="ml-1 text-xs text-muted">
                    ·{' '}
                    {departments.find((d) => d.id === client.salesDepartment)?.name ||
                      client.salesDepartment}
                  </span>
                </p>
                {canAssignSales && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowSalesAssign(true)}
                  >
                    Изменить
                  </Button>
                )}
              </div>
            ) : canAssignSales ? (
              <div className="space-y-2">
                {!client.salesManagerId && (
                  <p className="text-xs text-muted">Подключить менеджера по продажам</p>
                )}
                <select
                  value={deptId}
                  onChange={(e) => {
                    setDeptId(e.target.value)
                    setSalesMemberId('')
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
                >
                  <option value="">Отдел...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <select
                  value={salesMemberId}
                  onChange={(e) => setSalesMemberId(e.target.value)}
                  disabled={!selectedDept}
                  className="w-full rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary disabled:opacity-50"
                >
                  <option value="">Менеджер...</option>
                  {(selectedDept?.members || []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  disabled={sending || !deptId || !salesMemberId}
                  onClick={() => void handleAssignSales()}
                >
                  Сохранить
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted">Не назначен</p>
            )}
          </section>

          {/* Wait status */}
          <section className="space-y-2 rounded-xl border border-gray-100 p-3">
            <p className="text-sm font-semibold text-text">Что ждём</p>
            <p className="text-xs text-muted">
              Пока ждём ответа клиента — ИИ не будет советовать писать сразу. Укажите, когда
              сами выйдете с сообщением («как там / когда ответ»).
            </p>
            {canWaitNext && (
              <Input
                label="Когда сами напишете клиенту"
                type="date"
                value={waitFollowUpDate}
                onChange={(e) => setWaitFollowUpDate(e.target.value)}
                min={todayISO()}
              />
            )}
            <div className="flex flex-wrap gap-2">
              {WAIT_STATUS_PRESETS.map((preset) => {
                const active = client.waitStatus === preset
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={!canWaitNext || sending}
                    onClick={() => void handleWait(preset)}
                    className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                      active
                        ? 'border-secondary bg-secondary/10 text-secondary'
                        : 'border-gray-200 text-muted hover:border-gray-300'
                    } disabled:opacity-50`}
                  >
                    {preset}
                  </button>
                )
              })}
            </div>
            {canWaitNext && (
              <div className="flex gap-2">
                <Input
                  value={customWait}
                  onChange={(e) => setCustomWait(e.target.value)}
                  placeholder="Свой статус..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleCustomWait()
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!customWait.trim() || sending}
                  onClick={() => void handleCustomWait()}
                >
                  +
                </Button>
              </div>
            )}
            {client.waitStatus ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted">
                  Сейчас: {client.waitStatus}
                  {client.waitFollowUpDate
                    ? ` · сами напишем ${formatISODateShort(client.waitFollowUpDate)}`
                    : ''}
                </p>
                {canWaitNext && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={sending}
                    onClick={() => void handleClearWait()}
                  >
                    Снять ожидание
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted">
                Сначала дату follow-up, потом статус (например «Ждём ответа»)…
              </p>
            )}
          </section>
          </>
          )}

          {detailTab === 'notes' && (
          <>
          {/* Lead comments */}
          <section className="space-y-2 rounded-xl border border-l-4 border-gray-100 border-l-secondary p-3">
            <p className="text-sm font-semibold text-text">Комментарии лид-менеджера</p>
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {leadNotes.length === 0 ? (
                <li className="text-xs text-muted">Пока нет</li>
              ) : (
                leadNotes.map((e) => (
                  <li key={e.id} className="rounded-lg bg-background px-3 py-2">
                    <div className="flex justify-between gap-2 text-[11px] text-muted">
                      <span>{e.authorName}</span>
                      <span>{formatTime(e.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm text-text">{e.text}</p>
                  </li>
                ))
              )}
            </ul>
            {canLeadNote && (
              <>
                <Textarea
                  value={leadNote}
                  onChange={(e) => setLeadNote(e.target.value)}
                  placeholder="Комментарий лид-менеджера..."
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={sending || !leadNote.trim()}
                  onClick={() => void handleLeadNote()}
                >
                  Добавить
                </Button>
              </>
            )}
          </section>

          {/* Sales comments */}
          <section className="space-y-2 rounded-xl border border-l-4 border-gray-100 border-l-amber-500 p-3">
            <p className="text-sm font-semibold text-text">Комментарии продаж</p>
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {salesNotes.length === 0 ? (
                <li className="text-xs text-muted">Пока нет</li>
              ) : (
                salesNotes.map((e) => (
                  <li key={e.id} className="rounded-lg bg-background px-3 py-2">
                    <div className="flex justify-between gap-2 text-[11px] text-muted">
                      <span>{e.authorName}</span>
                      <span>{formatTime(e.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm text-text">{e.text}</p>
                  </li>
                ))
              )}
            </ul>
            {canSalesNote && (
              <>
                <Textarea
                  value={salesNote}
                  onChange={(e) => setSalesNote(e.target.value)}
                  placeholder="Комментарий менеджера продаж..."
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={sending || !salesNote.trim()}
                  onClick={() => void handleSalesNote()}
                >
                  Добавить
                </Button>
              </>
            )}
            {!canSalesNote && !client.salesManagerId && (
              <p className="text-xs text-muted">Сначала подключите менеджера продаж</p>
            )}
          </section>
          </>
          )}

          {detailTab === 'info' && (
          <>
          {/* Client info */}
          <section className="space-y-3">
            <p className="text-sm font-semibold text-text">Данные клиента</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={fieldDisabled}
              />
              <Input
                label="Телефон"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={fieldDisabled}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Компания"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                disabled={fieldDisabled}
              />
              <Input
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={fieldDisabled}
              />
            </div>

            {canEditCore && (
              <>
                <CountrySelect value={country} onChange={setCountry} />
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text">Продукция</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(PRODUCT_KIND_LABELS) as ProductKind[]).map((kind) => {
                      const active = products.includes(kind)
                      return (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => toggleProduct(kind)}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                            active
                              ? 'border-secondary bg-secondary/10 text-secondary'
                              : 'border-gray-200 bg-background text-text'
                          }`}
                        >
                          {PRODUCT_KIND_LABELS[kind]}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {products.includes('fabric') && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(FABRIC_TYPES).map(([key, label]) => {
                      const active = fabricTypes.includes(key)
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFabricTypes((prev) => toggleInList(prev, key))}
                          className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                            active
                              ? 'border-secondary bg-secondary/10 text-secondary'
                              : 'border-gray-200 text-muted'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                )}
                {products.includes('finished') && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(GP_TYPES).map(([key, label]) => {
                      const active = gpTypes.includes(key)
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setGpTypes((prev) => toggleInList(prev, key))}
                          className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                            active
                              ? 'border-secondary bg-secondary/10 text-secondary'
                              : 'border-gray-200 text-muted'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <EditableOptionSelect
                    listId="client_source"
                    label="Источник"
                    value={source}
                    onChange={(v) => {
                      setSource(v)
                      if (!sourceList.requiresExhibition(v)) {
                        setExhibitionName('')
                        setExhibitionDate('')
                      }
                    }}
                  />
                  <Input
                    label="Следующий контакт"
                    type="date"
                    value={nextContactDate}
                    onChange={(e) => setNextContactDate(e.target.value)}
                  />
                </div>
                {sourceList.requiresExhibition(source) && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Название выставки *"
                      value={exhibitionName}
                      onChange={(e) => setExhibitionName(e.target.value)}
                    />
                    <Input
                      label="Дата выставки"
                      type="date"
                      value={exhibitionDate}
                      onChange={(e) => setExhibitionDate(e.target.value)}
                    />
                  </div>
                )}
                <Input
                  label="Сумма сделки"
                  type="number"
                  min={0}
                  value={dealAmount}
                  onChange={(e) => setDealAmount(e.target.value)}
                />
                <div>
                  <Input
                    label="Дата открытия лида (реальный старт)"
                    type="date"
                    value={openedDate}
                    onChange={(e) => setOpenedDate(e.target.value)}
                    disabled={fieldDisabled}
                  />
                  <p className="mt-1 text-xs text-muted">
                    Выберите в календаре день, когда реально начали общение с клиентом (не когда
                    занесли в CRM). От этой даты считаются статусы «Новый / Активный / Заморожен».
                  </p>
                </div>
                <Textarea
                  label="Заметки"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </>
            )}

            {!canEditCore && (
              <div className="rounded-lg bg-background px-3 py-2 text-xs text-muted">
                Режим просмотра (менеджер продаж). Можно оставлять комментарии продаж.
              </div>
            )}
          </section>
          </>
          )}

          {detailTab === 'kp' && client && <ClientKpTab client={client} />}

          {detailTab === 'history' && (
          <>
          {/* History */}
          <section className="space-y-2 border-t border-gray-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-text">История</p>
              {canEditCore && onLogSamples && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowSamples((v) => !v)}
                >
                  <Package className="h-3.5 w-3.5" />
                  {showSamples ? 'Скрыть образцы' : 'Отправить образцы'}
                </Button>
              )}
            </div>

            {showSamples && canEditCore && onLogSamples && (
              <div className="space-y-3 rounded-xl border border-secondary/30 bg-secondary/5 p-3">
                <p className="text-xs text-muted">
                  Добавьте образцы (название + параметры). Можно десятки позиций. Всё
                  сохранится в историю для менеджеров по лидам.
                </p>
                <Input
                  label="Дата отправки / передачи"
                  type="date"
                  value={sampleDate}
                  onChange={(e) => setSampleDate(e.target.value)}
                />
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {sampleRows.map((row, idx) => (
                    <li
                      key={idx}
                      className="space-y-1.5 rounded-lg border border-gray-100 bg-surface p-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-muted">
                          Образец {idx + 1}
                        </span>
                        {sampleRows.length > 1 && (
                          <button
                            type="button"
                            className="rounded p-1 text-muted hover:bg-red-50 hover:text-danger"
                            onClick={() =>
                              setSampleRows((rows) => rows.filter((_, i) => i !== idx))
                            }
                            aria-label="Удалить строку"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <Input
                        label="Название"
                        value={row.name}
                        onChange={(e) => {
                          const name = e.target.value
                          setSampleRows((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, name } : r)),
                          )
                        }}
                        placeholder="Например: Ткань Jacquard 300 см"
                      />
                      <Textarea
                        label="Параметры"
                        value={row.params}
                        onChange={(e) => {
                          const params = e.target.value
                          setSampleRows((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, params } : r)),
                          )
                        }}
                        placeholder="Цвет, артикул, состав, метраж…"
                      />
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setSampleRows((rows) => [...rows, { name: '', params: '' }])
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ещё образец
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setSampleRows((rows) => [
                        ...rows,
                        ...Array.from({ length: 5 }, () => ({ name: '', params: '' })),
                      ])
                    }
                  >
                    +5 строк
                  </Button>
                </div>
                <Textarea
                  label="Комментарий (необязательно)"
                  value={sampleNote}
                  onChange={(e) => setSampleNote(e.target.value)}
                  placeholder="Курьер, трек-номер, кому передали…"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={savingSamples}
                  onClick={() => void handleSaveSamples()}
                >
                  <Package className="h-3.5 w-3.5" />
                  {savingSamples ? 'Сохранение...' : 'Сохранить отправку образцов'}
                </Button>
              </div>
            )}

            {historyLoading ? (
              <p className="text-xs text-muted">Загрузка...</p>
            ) : entries.length === 0 ? (
              <p className="text-xs text-muted">Пока пусто</p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto">
                {entries.map((e) => {
                  const kpiAccent =
                    e.type === 'stage_change' && e.text.includes('KPI')
                  const samplesAccent = e.type === 'samples_sent'
                  return (
                    <li
                      key={e.id}
                      className={`rounded-lg px-3 py-2 ${
                        kpiAccent
                          ? 'bg-emerald-50'
                          : samplesAccent
                            ? 'bg-sky-50'
                            : 'bg-background'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-medium text-text">
                          {HISTORY_LABELS[e.type] || e.type} · {e.authorName}
                          {e.sentDate ? ` · ${e.sentDate}` : ''}
                        </span>
                        <span className="text-[10px] text-muted">
                          {formatTime(e.createdAt)}
                        </span>
                      </div>
                      {e.type === 'samples_sent' && e.sampleItems?.length ? (
                        <ul className="mt-1.5 space-y-1">
                          {e.sampleItems.map((s, i) => (
                            <li key={i} className="text-sm text-text">
                              <span className="font-medium">
                                {i + 1}. {s.name}
                              </span>
                              {s.params ? (
                                <span className="text-muted"> — {s.params}</span>
                              ) : null}
                            </li>
                          ))}
                          {e.text.includes('Комментарий:') && (
                            <li className="text-xs text-muted">
                              {e.text.split('Комментарий:')[1]?.trim()
                                ? `Комментарий: ${e.text.split('Комментарий:')[1].trim()}`
                                : null}
                            </li>
                          )}
                        </ul>
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-text">{e.text}</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {canEditCore && (
              <>
                <Textarea
                  value={historyText}
                  onChange={(e) => setHistoryText(e.target.value)}
                  placeholder="Итог звонка..."
                />
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={sending}
                  onClick={() => void handleCall()}
                >
                  <Phone className="h-3.5 w-3.5" />
                  Лог звонка
                </Button>
              </>
            )}
          </section>
          </>
          )}
        </div>

        <div className="shrink-0 space-y-3 border-t border-gray-100 px-5 py-3 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {canEditCore && (
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !name.trim() || !phone.trim() || !products.length}
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose}>
              Закрыть
            </Button>
            {canDelete && (
              <Button
                type="button"
                variant="danger"
                onClick={() => void handleDelete()}
                className="sm:ml-auto"
              >
                Удалить
              </Button>
            )}
            {!canDelete && onRequestDelete && canEditCore && (
              <Button
                type="button"
                variant="danger"
                className="sm:ml-auto"
                disabled={hasPendingDeletion}
                onClick={() => setShowDeleteForm((v) => !v)}
              >
                {hasPendingDeletion ? 'Заявка на удаление…' : 'Заявка на удаление'}
              </Button>
            )}
          </div>

          {showDeleteForm && !canDelete && onRequestDelete && (
            <div className="space-y-2 rounded-xl border border-danger/20 bg-red-50/50 p-3">
              <p className="text-xs text-muted">
                Удаление только после одобрения админа. Укажите причину.
              </p>
              <Textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Причина удаления..."
              />
              <Button
                type="button"
                variant="danger"
                disabled={requestingDelete || !deleteReason.trim()}
                onClick={() => void handleRequestDelete()}
                fullWidth
              >
                {requestingDelete ? 'Отправка...' : 'Отправить заявку'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
