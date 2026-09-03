import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { KpiOverrideButtons } from '@/components/kpi/KpiOverrideButtons'
import { useAuth } from '@/hooks/useAuth'
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
  const { isAdmin } = useAuth()
  const { config } = useAiActivityConfig()
  const minKpiMoments = config?.minKpiMoments ?? 3
  const [month, setMonth] = useState(initialMonth || previousMonthKey() || getCurrentMonth())
  const { leads } = useKpiLeads('all', month)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (initialMonth) setMonth(initialMonth)
  }, [initialMonth])
  const [managerId, setManagerId] = useState('all')
  const [bucket, setBucket] = useState<'all' | 'yes' | 'no'>('all')
  const [selectedId, setSelectedId] = useState('')
  const [showRules, setShowRules] = useState(false)

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
            Найдите клиента (например Шахноза). Правило простое: 3 содержательных шага, 2 разных дня,
            2 вида работы. Как Шахноза: КП + этап «КП отправлено» + звонок. Админ может нажать
            «Засчитать» или «Убрать из KPI» — правка не слетит после переанализа.{' '}
            <a
              className="text-secondary underline"
              href="/Kak_otbor_aktivnost_i_lidy.doc"
              download="Kak_otbor_aktivnost_i_kpi_lid.doc"
            >
              Скачать инструкцию Word
            </a>
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
            placeholder="Например Шахноза"
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
                <div
                  className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-sm ${
                    selectedId === c.id ? 'bg-secondary/10' : 'hover:bg-background'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="font-medium text-text">{c.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {c.assignedToName || 'без менеджера'} · {stageLabel(c.stage)}
                    </span>
                  </button>
                  <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                    <Badge variant={yes ? 'success' : 'default'}>{yes ? 'в KPI' : 'нет'}</Badge>
                    {isAdmin && (
                      <KpiOverrideButtons
                        client={c}
                        month={month}
                        log={logByClient.get(c.id) || null}
                        counted={yes}
                      />
                    )}
                  </span>
                </div>
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
              {isAdmin && (
                <KpiOverrideButtons
                  client={selected}
                  month={month}
                  log={logByClient.get(selected.id) || null}
                  counted={explanation.counted}
                />
              )}
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
              {explanation.activeDays}. Журнал: {explanation.journalLabel}.
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-center">
              <p className="text-2xl font-semibold text-gray-900">{explanation.managerWorkCount}</p>
              <p className="text-xs text-gray-500">рабочих записей (активный)</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
              <p className="text-2xl font-semibold text-emerald-800">{explanation.leadStepCount}</p>
              <p className="text-xs text-emerald-800">шагов по лиду из {minKpiMoments}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center">
              <p className="text-2xl font-semibold text-amber-800">{explanation.needMoreSteps}</p>
              <p className="text-xs text-amber-800">ещё не хватает до KPI-лида</p>
            </div>
          </div>

          <p className="text-xs text-muted">В зарплатном журнале за месяц: {countedN} карточек.</p>

          <div className="space-y-2">
            {explanation.gates
              .filter((g) => g.id === 'human' || g.id === 'score')
              .map((g) => (
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

          {explanation.howToFix.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3">
              <h4 className="text-sm font-semibold text-text">Что написать в истории, чтобы засчитало</h4>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-text">
                {explanation.howToFix.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ol>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-text">
              Каждая строка: в KPI или только активность
            </h4>
            {explanation.history.length === 0 ? (
              <p className="mt-1 text-sm text-muted">За этот месяц в «Истории» пусто.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {explanation.history.map((h, i) => (
                  <li
                    key={`${h.date}-${i}`}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      h.kpiCounted
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-gray-100 bg-surface'
                    }`}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      {h.kpiCounted ? (
                        <Badge variant="success">в KPI</Badge>
                      ) : (
                        <Badge variant="default">не в KPI</Badge>
                      )}
                      {h.kpiCounted && <Badge variant="info">шаг по лиду</Badge>}
                      {h.kind === 'light' && <Badge variant="warning">только активность</Badge>}
                      {h.kind === 'wait' && <Badge variant="warning">ожидание</Badge>}
                      {h.kind === 'noise' && <Badge variant="default">не шаг</Badge>}
                      <span className="text-xs text-muted">
                        {h.date} · {h.typeLabel}
                      </span>
                    </div>
                    <p className="text-text">{h.text}</p>
                    <p className="mt-1 text-xs text-muted">{h.why}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <details className="rounded-lg border border-gray-100 bg-background px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-secondary">
              Полная проверка по ступеням (журнал, Groq, полки)
            </summary>
            <div className="mt-3 space-y-2">
              {explanation.gates
                .filter((g) => g.id !== 'human' && g.id !== 'score')
                .map((g) => (
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
          </details>

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
