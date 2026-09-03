import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { useClients } from '@/hooks/useClients'
import { useKpiLeads } from '@/hooks/useKpiLeads'
import { useKpiPayroll } from '@/hooks/useKpiPayroll'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { KpiExplanation } from '@/components/kpi/KpiExplanation'
import { KpiTeamGuide } from '@/components/kpi/KpiTeamGuide'
import { KpiPasswordGate, isKpiUnlocked } from '@/components/kpi/KpiPasswordGate'
import { KpiHeadPanel } from '@/components/kpi/KpiHeadPanel'
import { KpiDesignerPanel } from '@/components/kpi/KpiDesignerPanel'
import { KpiAssistantPanel } from '@/components/kpi/KpiAssistantPanel'
import { KpiLeadAudit } from '@/components/kpi/KpiLeadAudit'
import { KpiOverrideButtons } from '@/components/kpi/KpiOverrideButtons'
import { LEAD_CATEGORIES } from '@/constants/clientMeta'
import {
  KPI_ROLE_TEMPLATES,
  INSTAGRAM_TIERS,
  INSTAGRAM_DIRECT_FIX,
  applySuggestedDealCounts,
  calculatePayroll,
  findPayrollManager,
  formatKpiMoney,
  formatPercent,
  suggestDealsForMonth,
} from '@/constants/kpiPayroll'
import { groqActivityIsCurrent, kpiMonthIsCurrent } from '@/utils/groqLeadActivity'
import { getCurrentMonth } from '@/utils/dates'
import type { DealBandId, KpiPayrollInputs, KpiPayrollRole } from '@/types/kpiPayroll.types'
import type { LeadCategory } from '@/types/kpiLead.types'

function monthOptions(count = 8) {
  const result: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

function formatMonthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  })
}

function leadCats(lead: { categories?: LeadCategory[]; category?: LeadCategory }) {
  if (lead.categories?.length) return lead.categories
  return lead.category ? [lead.category] : []
}

type DeptTab = 'leads' | 'audit' | 'head' | 'designer' | 'assistant'

export function KPI() {
  const { user, isAdmin } = useAuth()
  const { users } = useUsers(true)
  const { clients } = useClients()
  const [month, setMonth] = useState(getCurrentMonth())
  const [role, setRole] = useState<KpiPayrollRole>('aygul')
  const [deptTab, setDeptTab] = useState<DeptTab>('leads')
  const [unlocked, setUnlocked] = useState(isKpiUnlocked)

  if (!unlocked) {
    return <KpiPasswordGate onUnlock={() => setUnlocked(true)} />
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text">KPI отдела маркетинга</h1>
        <p className="mt-1 text-sm text-muted">
          Пароль уже введён на эту сессию. Раздел виден только начальнику и админу.
        </p>
      </div>
      <select
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
      >
        {monthOptions().map((m) => (
          <option key={m} value={m}>
            {formatMonthLabel(m)}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['leads', 'Айгуль / Кундуз'],
            ['audit', 'Разбор лидов'],
            ['head', 'Начальник'],
            ['designer', 'Дизайнер'],
            ['assistant', 'Ассистент'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm ${
              deptTab === id ? 'bg-secondary text-white' : 'bg-background text-muted'
            }`}
            onClick={() => setDeptTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {deptTab === 'audit' && <KpiLeadAudit clients={clients} initialMonth={month} />}
      {deptTab === 'head' && <KpiHeadPanel month={month} />}
      {deptTab === 'designer' && <KpiDesignerPanel month={month} />}
      {deptTab === 'assistant' && <KpiAssistantPanel month={month} />}
      {deptTab === 'leads' && (
        <KpiPayrollPage
          month={month}
          setMonth={setMonth}
          role={role}
          setRole={setRole}
          users={users}
          clients={clients}
          adminId={user?.id || ''}
          adminName={user?.name || ''}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}

function KpiPayrollPage({
  month,
  setMonth,
  role,
  setRole,
  users,
  clients,
  adminId,
  adminName,
  isAdmin,
}: {
  month: string
  setMonth: (v: string) => void
  role: KpiPayrollRole
  setRole: (v: KpiPayrollRole) => void
  users: ReturnType<typeof useUsers>['users']
  clients: ReturnType<typeof useClients>['clients']
  adminId: string
  adminName: string
  isAdmin: boolean
}) {
  const tpl = KPI_ROLE_TEMPLATES[role]
  const manager = useMemo(() => findPayrollManager(users, role), [users, role])
  const managerId = manager?.id || ''
  const { counts, leads, loading: leadsLoading } = useKpiLeads(managerId, month)
  const { inputs: savedInputs, loading, saving, error, save } = useKpiPayroll(
    role,
    month,
    true,
  )
  const [draft, setDraft] = useState<KpiPayrollInputs>(savedInputs)
  const [savedOk, setSavedOk] = useState('')
  const [tab, setTab] = useState<'pay' | 'guide'>('guide')
  const { leads: allLeads } = useKpiLeads('all', month)

  useEffect(() => {
    if (loading) return
    setDraft(savedInputs)
    setSavedOk('')
  }, [role, month, loading, savedInputs])

  const leadFacts = {
    fabric: counts.fabric,
    finished: counts.finished,
    europe: counts.europe,
  }
  const calc = useMemo(() => calculatePayroll(role, draft, leadFacts), [role, draft, counts])

  const suggestions = useMemo(
    () => suggestDealsForMonth(clients, managerId, month),
    [clients, managerId, month],
  )

  const countedIds = useMemo(() => new Set(leads.map((l) => l.clientId)), [leads])

  const notCounted = useMemo(() => {
    if (!managerId) return []
    return clients
      .filter((c) => c.assignedTo === managerId)
      .filter((c) => groqActivityIsCurrent(c, month) && c.activityLabel === 'active')
      .filter((c) => !countedIds.has(c.id))
      .filter((c) => !(c.kpiQualified === true && kpiMonthIsCurrent(c, month)))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [clients, managerId, month, countedIds])

  function patch(partial: Partial<KpiPayrollInputs>) {
    setDraft((prev) => ({ ...prev, ...partial }))
    setSavedOk('')
  }

  async function handleSave() {
    setSavedOk('')
    try {
      await save(draft, { id: adminId, name: adminName })
      setSavedOk('Расчёт сохранён')
    } catch {
      /* error in hook */
    }
  }

  const dutiesDone = tpl.duties.filter((d) => draft.dutyDone[d.id]).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text">KPI · зарплата менеджеров по лидам</h1>
        <p className="mt-1 text-sm text-muted">
          Как в файлах 02 (Айгуль) и 03 (Кундуз). Факт лидов подтягивается из CRM. Сделки и SMM /
          шоурум проверяете и сохраняете.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
        >
          {monthOptions().map((m) => (
            <option key={m} value={m}>
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>
        {(['aygul', 'kunduz'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setRole(key)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              role === key ? 'bg-secondary text-white' : 'bg-surface text-text shadow-sm'
            }`}
          >
            {KPI_ROLE_TEMPLATES[key].shortName}
          </button>
        ))}
        {(['guide', 'pay'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === key ? 'bg-primary text-white' : 'bg-surface text-text shadow-sm'
            }`}
          >
            {key === 'guide' ? 'Для команды' : 'Расчёт зарплаты'}
          </button>
        ))}
      </div>

      {tab === 'guide' ? (
        <KpiTeamGuide month={month} clients={clients} leads={allLeads} />
      ) : (
        <>
      <p className="text-sm text-muted">
        Сотрудник в CRM:{' '}
        <span className="font-medium text-text">{manager?.name || 'не найден по должности'}</span>
        {manager ? ` · ${tpl.title}` : ` · нужна должность «${tpl.position}»`}
      </p>

      <KpiExplanation role={role} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatChip label="На руки" value={formatKpiMoney(calc.handsTotal)} tone="secondary" />
        <StatChip label="Фикса" value={formatKpiMoney(calc.fixa)} />
        <StatChip label="KPI блок 2" value={formatKpiMoney(calc.block2Total)} />
        <StatChip label="Бонусы блок 3" value={formatKpiMoney(calc.block3Total)} />
      </div>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold text-text">Блок 1 — фикса</h2>
        <p className="text-xs text-muted">
          Оклад {formatKpiMoney(calc.salary)}. Начислено = оклад × дни факт / дни план.
        </p>
        <div className="flex flex-wrap gap-3">
          <NumField
            label="Раб. дни план"
            value={draft.workDaysPlan}
            onChange={(v) => patch({ workDaysPlan: v })}
          />
          <NumField
            label="Раб. дни факт"
            value={draft.workDaysFact}
            onChange={(v) => patch({ workDaysFact: v })}
          />
        </div>
        <p className="text-sm font-semibold text-text">
          {formatPercent(calc.workRatio)} · {formatKpiMoney(calc.fixa)}
        </p>
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-text">Блок 2 — KPI</h2>
            <p className="text-xs text-muted">
              Фонд {formatKpiMoney(calc.kpiFund)}. Сумма = фонд × вес × коэффициент.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={Boolean(draft.leadOverride)}
              onChange={(e) =>
                patch({
                  leadOverride: e.target.checked
                    ? { fabric: leadFacts.fabric, finished: leadFacts.finished, europe: leadFacts.europe }
                    : null,
                })
              }
            />
            Править факт лидов вручную
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-muted">
                <th className="py-2 pr-2 font-medium">Показатель</th>
                <th className="py-2 pr-2 font-medium">Вес</th>
                <th className="py-2 pr-2 font-medium">План</th>
                <th className="py-2 pr-2 font-medium">Факт</th>
                <th className="py-2 pr-2 font-medium">%</th>
                <th className="py-2 pr-2 font-medium">Коэфф.</th>
                <th className="py-2 font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {calc.block2Rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-50 align-top">
                  <td className="py-2 pr-2">
                    <p className="font-medium text-text">{row.label}</p>
                    <p className="text-[11px] text-muted">{row.hint}</p>
                  </td>
                  <td className="py-2 pr-2">{Math.round(row.weight * 100)} %</td>
                  <td className="py-2 pr-2">{row.plan}</td>
                  <td className="py-2 pr-2">
                    {row.id === 'smm' ? (
                      <select
                        value={String(draft.smmFact)}
                        onChange={(e) => patch({ smmFact: Number(e.target.value) })}
                        className="rounded-md border border-gray-200 px-2 py-1 text-sm"
                      >
                        <option value="0">0 — не выполнено</option>
                        <option value="0.5">0,5 — частично (&lt;60% = 0 ₽)</option>
                        <option value="1">1 — выполнено</option>
                      </select>
                    ) : row.id === 'showroom' ? (
                      <select
                        value={String(draft.showroomFact)}
                        onChange={(e) => patch({ showroomFact: Number(e.target.value) })}
                        className="rounded-md border border-gray-200 px-2 py-1 text-sm"
                      >
                        <option value="0">0 — не в норме</option>
                        <option value="1">1 — в норме</option>
                      </select>
                    ) : draft.leadOverride ? (
                      <input
                        type="number"
                        min={0}
                        className="w-20 rounded-md border border-gray-200 px-2 py-1 text-sm"
                        value={draft.leadOverride[row.id as 'fabric' | 'finished' | 'europe']}
                        onChange={(e) =>
                          patch({
                            leadOverride: {
                              ...draft.leadOverride!,
                              [row.id]: Number(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    ) : (
                      <span className="font-semibold">{leadsLoading ? '…' : row.fact}</span>
                    )}
                  </td>
                  <td className="py-2 pr-2">{formatPercent(row.ratio)}</td>
                  <td className="py-2 pr-2 font-semibold">{row.coefficient}</td>
                  <td className="py-2 font-semibold text-text">{formatKpiMoney(row.amount)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2.5 font-semibold" colSpan={6}>
                  Итого блок 2
                </td>
                <td className="py-2.5 font-bold text-secondary">{formatKpiMoney(calc.block2Total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold text-text">Засчитанные KPI-лиды</h2>
        <p className="text-xs text-muted">
          Почему засчитан: шаги в Истории + категории (ткань / ГП / Европа). Админ может убрать лид
          из факта кнопкой «Убрать из KPI».
        </p>
        {leadsLoading ? (
          <p className="text-sm text-muted">Загрузка журнала…</p>
        ) : leads.length === 0 ? (
          <p className="text-sm text-muted">
            За {formatMonthLabel(month)} нет квалифицированных лидов. Запустите анализ в Настройки →
            ИИ → KPI квалификация.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {leads.map((lead) => {
              const client = clients.find((c) => c.id === lead.clientId)
              const reason =
                client?.kpiQualificationReason ||
                (typeof lead.significantMoments === 'number' && lead.significantMoments >= 900
                  ? 'Сделка в 1-м месяце работы — лид засчитывается сразу.'
                  : 'Квалифицирован по журналу KPI.')
              const cats = leadCats(lead)
                .map((c) => LEAD_CATEGORIES[c])
                .join(' + ')
              return (
                <li key={lead.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link
                        to={`/crm?client=${lead.clientId}`}
                        className="font-medium text-secondary hover:underline"
                      >
                        {lead.clientName}
                      </Link>
                      <p className="text-xs text-muted">
                        {cats}
                        {typeof lead.significantMoments === 'number'
                          ? lead.significantMoments >= 900
                            ? ' · сделка в 1-м месяце'
                            : ` · ${lead.significantMoments} шагов по лиду`
                          : ''}
                      </p>
                    </div>
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      засчитан
                    </span>
                    {isAdmin && client && (
                      <KpiOverrideButtons client={client} month={month} log={lead} counted />
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-text">{reason}</p>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold text-text">Активные, но не засчитанные</h2>
        <p className="text-xs text-muted">
          Клиенты этого менеджера, у кого за месяц есть активность в CRM, но KPI-лид не прошёл.
          Админ может взять клиента из списка и нажать «Засчитать».
        </p>
        {notCounted.length === 0 ? (
          <p className="text-sm text-muted">Таких клиентов нет.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {notCounted.map((c) => (
              <li key={c.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link
                    to={`/crm?client=${c.id}`}
                    className="font-medium text-secondary hover:underline"
                  >
                    {c.name}
                  </Link>
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                    не в факте
                  </span>
                  {isAdmin && (
                    <KpiOverrideButtons client={c} month={month} counted={false} />
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {c.kpiQualificationReason ||
                    'Нет обоснования: анализ ещё не ставил отказ или не набралось шагов менеджера по клиенту.'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-text">Блок 3 — бонусы от сделки</h2>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => patch({ dealCounts: applySuggestedDealCounts(suggestions) })}
            disabled={suggestions.length === 0}
          >
            Подставить из CRM
          </Button>
        </div>
        <p className="text-xs text-muted">
          Суммы сделок в CRM часто в сумах — для диапазона $ числа ≥ 100 000 делятся на 12 500.
          Проверьте каждую сделку: бонус только за нового клиента.
        </p>
        {suggestions.length > 0 && (
          <ul className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
            {suggestions.map((s) => (
              <li key={s.clientId}>
                <Link to={`/crm?client=${s.clientId}`} className="font-medium text-secondary hover:underline">
                  {s.clientName}
                </Link>
                <span className="text-muted">
                  {' '}
                  · {s.usd != null ? `${Math.round(s.usd).toLocaleString('ru-RU')} $` : 'нет $'}
                  {s.date ? ` · ${s.date}` : ''}
                  {s.note ? ` · ${s.note}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-muted">
                <th className="py-2 pr-2 font-medium">Условие</th>
                <th className="py-2 pr-2 font-medium">Факт, шт</th>
                <th className="py-2 pr-2 font-medium">За 1</th>
                <th className="py-2 font-medium">Начислено</th>
              </tr>
            </thead>
            <tbody>
              {calc.dealRows.map((row) => (
                <tr key={row.id} className="border-b border-gray-50">
                  <td className="py-2 pr-2">{row.label}</td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      className="w-20 rounded-md border border-gray-200 px-2 py-1 text-sm"
                      value={draft.dealCounts[row.id as DealBandId]}
                      onChange={(e) =>
                        patch({
                          dealCounts: {
                            ...draft.dealCounts,
                            [row.id]: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </td>
                  <td className="py-2 pr-2 text-muted">{formatKpiMoney(row.unitBonus)}</td>
                  <td className="py-2 font-semibold">{formatKpiMoney(row.amount)}</td>
                </tr>
              ))}
              <tr className="border-b border-gray-50">
                <td className="py-2 pr-2">Повторный заказ · 0,8 % от инвойса (вручную)</td>
                <td className="py-2 pr-2 text-muted" colSpan={2}>
                  сумма бонуса, тыс сум
                </td>
                <td className="py-2">
                  <input
                    type="number"
                    min={0}
                    className="w-28 rounded-md border border-gray-200 px-2 py-1 text-sm"
                    value={draft.repeatBonus}
                    onChange={(e) => patch({ repeatBonus: Number(e.target.value) || 0 })}
                  />
                </td>
              </tr>
              {tpl.hasInstagram && (
                <>
                  <tr className="border-b border-gray-50">
                    <td className="py-2 pr-2">Оборот магазина (Instagram / филиал) — одна ступень</td>
                    <td className="py-2 pr-2" colSpan={2}>
                      <select
                        value={draft.instagramTier || ''}
                        onChange={(e) =>
                          patch({
                            instagramTier: (e.target.value || null) as KpiPayrollInputs['instagramTier'],
                          })
                        }
                        className="max-w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                      >
                        <option value="">нет бонуса</option>
                        {INSTAGRAM_TIERS.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label} → {formatKpiMoney(t.bonus)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 font-semibold">{formatKpiMoney(calc.instagramBonus)}</td>
                  </tr>
                  <tr className="border-b border-gray-50">
                    <td className="py-2 pr-2">
                      Чистые онлайн-продажи через Direct
                      <span className="mt-0.5 block text-xs font-normal text-muted">
                        0–15 млн → 4% · 15–40 → 5% · 40–80 → 6% · 80+ → 7%. Вводите сумму в сумах.
                        {calc.onlineSalesLabel ? ` Сейчас: ${calc.onlineSalesLabel}` : ''}
                      </span>
                    </td>
                    <td className="py-2 pr-2" colSpan={2}>
                      <input
                        type="number"
                        min={0}
                        className="w-40 rounded-md border border-gray-200 px-2 py-1 text-sm"
                        value={draft.onlineSalesUzs || ''}
                        placeholder="4754000"
                        onChange={(e) => patch({ onlineSalesUzs: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="py-2 font-semibold">{formatKpiMoney(calc.onlineSalesBonus)}</td>
                  </tr>
                  <tr className="border-b border-gray-50">
                    <td className="py-2 pr-2">Фикса Instagram Direct</td>
                    <td className="py-2 pr-2" colSpan={2}>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.instagramDirectFix}
                          onChange={(e) => patch({ instagramDirectFix: e.target.checked })}
                        />
                        {formatKpiMoney(INSTAGRAM_DIRECT_FIX)}
                      </label>
                    </td>
                    <td className="py-2 font-semibold">
                      {formatKpiMoney(calc.instagramDirectFixBonus)}
                    </td>
                  </tr>
                </>
              )}
              <tr>
                <td className="py-2.5 font-semibold" colSpan={3}>
                  Итого блок 3
                </td>
                <td className="py-2.5 font-bold text-secondary">{formatKpiMoney(calc.block3Total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold text-text">Чек-лист обязанностей (в окладе)</h2>
        <p className="text-xs text-muted">
          {dutiesDone} из {tpl.duties.length} — на сумму «на руки» не влияет, для 1:1.
        </p>
        <ul className="space-y-2">
          {tpl.duties.map((d) => (
            <li key={d.id} className="rounded-lg border border-gray-100 p-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(draft.dutyDone[d.id])}
                  onChange={(e) =>
                    patch({ dutyDone: { ...draft.dutyDone, [d.id]: e.target.checked } })
                  }
                />
                <span>
                  <span className="font-medium text-text">{d.title}</span>
                  <span className="mt-0.5 block text-xs text-muted">{d.detail}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-text">На руки: {formatKpiMoney(calc.handsTotal)}</p>
          <p className="text-xs text-muted">
            {formatKpiMoney(calc.fixa)} + {formatKpiMoney(calc.block2Total)} +{' '}
            {formatKpiMoney(calc.block3Total)}
          </p>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
          {savedOk && <p className="mt-1 text-xs text-emerald-700">{savedOk}</p>}
        </div>
        <Button type="button" onClick={() => void handleSave()} disabled={saving || loading}>
          {saving ? 'Сохранение…' : 'Сохранить расчёт месяца'}
        </Button>
      </Card>
        </>
      )}
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="text-xs text-muted">
      {label}
      <input
        type="number"
        min={0}
        className="mt-1 block w-28 rounded-md border border-gray-200 px-2 py-1.5 text-sm text-text"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  )
}

function StatChip({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'secondary'
}) {
  const tones = {
    default: 'bg-surface text-text',
    secondary: 'bg-secondary/10 text-secondary',
  }
  return (
    <div className={`rounded-xl px-3 py-2.5 shadow-sm ${tones[tone]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-lg font-bold leading-tight">{value}</p>
    </div>
  )
}
