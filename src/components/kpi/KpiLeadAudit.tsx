import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useClientHistory } from '@/hooks/useClientHistory'
import { useAiActivityConfig } from '@/hooks/useAiActivityConfig'
import { useKpiLeads } from '@/hooks/useKpiLeads'
import { TEAM_GUIDE_INTRO, TEAM_GUIDE_SECTIONS } from '@/constants/kpiTeamGuide'
import { LEAD_CATEGORIES } from '@/constants/clientMeta'
import { stageLabel } from '@/constants/clientStages'
import { getCurrentMonth } from '@/utils/dates'
import type { Client } from '@/types/client.types'
import type { KpiLeadLog } from '@/types/kpiLead.types'
import {
  explainKpiLead,
  formatMonthHuman,
  type GateStatus,
} from '@/utils/kpiLeadExplain'

function previousMonthKey() {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthChoices(count = 10) {
  const result: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

function gateClass(status: GateStatus) {
  if (status === 'pass') return 'border-emerald-200 bg-emerald-50'
  if (status === 'fail') return 'border-rose-200 bg-rose-50'
  if (status === 'skip') return 'border-gray-100 bg-gray-50'
  return 'border-sky-100 bg-sky-50'
}

function gateWord(status: GateStatus) {
  if (status === 'pass') return 'прошёл'
  if (status === 'fail') return 'не прошёл'
  if (status === 'skip') return 'не применялся'
  return 'пояснение'
}

export function KpiLeadAudit({
  clients,
  initialMonth,
}: {
  clients: Client[]
  initialMonth?: string
}) {
  const { config } = useAiActivityConfig()
  const minKpiMoments = config?.minKpiMoments ?? 3
  const [month, setMonth] = useState(initialMonth || previousMonthKey() || getCurrentMonth())
  const { leads } = useKpiLeads('all', month)
  const [q, setQ] = useState('')
  const [managerId, setManagerId] = useState('all')
  const [bucket, setBucket] = useState<'all' | 'yes' | 'no'>('all')
  const [selectedId, setSelectedId] = useState('')
  const [showRules, setShowRules] = useState(true)

  const logByClient = useMemo(() => {
    const map = new Map<string, KpiLeadLog>()
    for (const lead of leads) map.set(lead.clientId, lead)
    return map
  }, [leads])

  const managers = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of clients) {
      if (c.assignedTo) map.set(c.assignedTo, c.assignedToName || c.assignedTo)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ru'))
  }, [clients])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return clients
      .filter((c) => (managerId === 'all' ? true : c.assignedTo === managerId))
      .filter((c) => {
        const yes = logByClient.has(c.id)
        if (bucket === 'yes') return yes
        if (bucket === 'no') return !yes
        return true
      })
      .filter((c) => {
        if (!needle) return true
        return `${c.name} ${c.company} ${c.assignedToName}`.toLowerCase().includes(needle)
      })
      .sort((a, b) => {
        const ay = logByClient.has(a.id) ? 0 : 1
        const by = logByClient.has(b.id) ? 0 : 1
        if (ay !== by) return ay - by
        return (a.name || '').localeCompare(b.name || '', 'ru')
      })
  }, [clients, managerId, bucket, q, logByClient])

  const selected = clients.find((c) => c.id === selectedId) || null
  const { entries, loading: historyLoading } = useClientHistory(selected?.id || null)

  const explanation = useMemo(() => {
    if (!selected) return null
    return explainKpiLead({
      client: selected,
      month,
      history: entries,
      log: logByClient.get(selected.id) || null,
      minKpiMoments,
    })
  }, [selected, month, entries, logByClient, minKpiMoments])

  const countedN = leads.length
  const inListYes = rows.filter((c) => logByClient.has(c.id)).length

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-text">Разбор KPI-лидов по клиенту</h2>
          <p className="mt-1 text-sm text-muted">
            В зарплату попали <span className="font-medium text-text">{countedN}</span> карточек
            (журнал KPI). Выберите клиента — ниже каждая ступень: журнал CRM, Groq-активность,
            Groq-квалификация, почему засчитали или нет, рекомендации.
          </p>
        </div>
        <select
          value={month}
          onChange={(e) => {
            setMonth(e.target.value)
            setSelectedId('')
          }}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
        >
          {monthChoices().map((m) => (
            <option key={m} value={m}>
              {formatMonthHuman(m)}
            </option>
          ))}
        </select>
        <p className="text-sm leading-relaxed text-text">{TEAM_GUIDE_INTRO}</p>
        <button
          type="button"
          className="text-sm font-medium text-secondary underline"
          onClick={() => setShowRules((v) => !v)}
        >
          {showRules ? 'Скрыть полную логику' : 'Показать полную логику до мелочей'}
        </button>
        {showRules && (
          <div className="space-y-3 rounded-xl border border-gray-100 bg-background p-3">
            {TEAM_GUIDE_SECTIONS.map((s) => (
              <div key={s.title}>
                <h3 className="text-sm font-semibold text-text">{s.title}</h3>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Имя клиента…"
            className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
          />
          <select
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
          >
            <option value="all">Все менеджеры по лидам</option>
            {managers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={bucket}
            onChange={(e) => setBucket(e.target.value as typeof bucket)}
            className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
          >
            <option value="all">Все в списке</option>
            <option value="yes">Только засчитанные</option>
            <option value="no">Только НЕ засчитанные</option>
          </select>
        </div>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
        >
          <option value="">Выберите клиента из воронки…</option>
          {rows.map((c) => (
            <option key={c.id} value={c.id}>
              {logByClient.has(c.id) ? '✓ ' : '✗ '}
              {c.name}
              {c.assignedToName ? ` — ${c.assignedToName}` : ''}
              {` · ${stageLabel(c.stage)}`}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">
          В фильтре {rows.length} клиентов, из них засчитаны {inListYes}. Нажмите строку или выберите
          имя сверху.
        </p>
        <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">
          {rows.map((c) => {
            const yes = logByClient.has(c.id)
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm ${
                    selectedId === c.id ? 'bg-secondary/10' : 'hover:bg-background'
                  }`}
                >
                  <span>
                    <span className="font-medium text-text">{c.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {c.assignedToName || 'без менеджера'} · {stageLabel(c.stage)}
                    </span>
                  </span>
                  <Badge variant={yes ? 'success' : 'default'}>{yes ? 'в KPI' : 'нет'}</Badge>
                </button>
              </li>
            )
          })}
        </ul>
      </Card>

      {selected && explanation && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-text">{explanation.clientName}</h3>
              <p className="text-sm text-muted">
                {explanation.managerName} · {explanation.stageName} · открыт: {explanation.openedRaw} ·
                {explanation.activeMonths}-й месяц на {formatMonthHuman(month)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={explanation.counted ? 'success' : 'danger'}>
                {explanation.counted ? 'Засчитан' : 'Не засчитан'}
              </Badge>
              <Link to={`/crm?client=${selected.id}`} className="text-sm text-secondary underline">
                Открыть карточку
              </Link>
            </div>
          </div>
          <p className="rounded-lg bg-background px-3 py-2 text-sm font-medium text-text">
            {explanation.verdict}
          </p>

          {historyLoading ? (
            <p className="text-sm text-muted">Загружаю журнал истории…</p>
          ) : (
            <p className="text-xs text-muted">
              Записей в истории за месяц: {explanation.monthHistoryCount}. Дней с работой:{' '}
              {explanation.activeDays}. Журнал ступени 1: {explanation.journalLabel}.
            </p>
          )}

          <div className="space-y-2">
            {explanation.gates.map((g) => (
              <div key={g.id} className={`rounded-lg border px-3 py-2 ${gateClass(g.status)}`}>
                <p className="text-sm font-semibold text-text">
                  {g.title}{' '}
                  <span className="font-normal text-xs uppercase tracking-wide text-muted">
                    {gateWord(g.status)}
                  </span>
                </p>
                <p className="mt-1 text-sm leading-relaxed text-text">{g.detail}</p>
              </div>
            ))}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-text">Журнал за {formatMonthHuman(month)} построчно</h4>
            {explanation.history.length === 0 ? (
              <p className="mt-1 text-sm text-muted">За этот месяц в «Истории» пусто.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {explanation.history.map((h, i) => (
                  <li key={`${h.date}-${i}`} className="rounded-lg border border-gray-100 bg-surface px-3 py-2 text-sm">
                    <p className="text-xs text-muted">
                      {h.date} · {h.typeLabel}
                      {h.countsAsWork ? ' · даёт активность' : ' · не даёт активность'}
                    </p>
                    <p className="mt-0.5 text-text">{h.text}</p>
                    {h.skipReason && <p className="mt-0.5 text-xs text-muted">{h.skipReason}</p>}
                    {h.looksLikeClientStep && (
                      <p className="mt-0.5 text-xs text-emerald-700">
                        Похоже на шаг клиента (Groq KPI): {h.looksLikeClientStep}
                      </p>
                    )}
                    {h.looksLikeManagerOnly && !h.looksLikeClientStep && (
                      <p className="mt-0.5 text-xs text-amber-800">
                        Похоже только на работу менеджера: {h.looksLikeManagerOnly}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
            <h4 className="text-sm font-semibold text-text">Что делать / рекомендации</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text">
              {explanation.recommendations.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>

          {explanation.counted && explanation.shelvesFromLog.length > 0 && (
            <p className="text-sm text-muted">
              Полки в факте:{' '}
              {explanation.shelvesFromLog.map((c) => LEAD_CATEGORIES[c] || c).join(', ')}
            </p>
          )}
        </Card>
      )}
    </div>
  )
}
