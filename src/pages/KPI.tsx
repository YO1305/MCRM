import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { useKpiLeads } from '@/hooks/useKpiLeads'
import { Card } from '@/components/ui/Card'
import { LEAD_CATEGORIES } from '@/constants/clientMeta'
import { getCurrentMonth } from '@/utils/dates'
import type { LeadCategory } from '@/types/kpiLead.types'
import { POSITION_LABELS } from '@/constants/positions'

function monthOptions(count = 6) {
  const result: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    result.push(`${y}-${m}`)
  }
  return result
}

function formatMonthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, (m || 1) - 1, 1)
  return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

export function KPI() {
  const { user, isAdmin } = useAuth()
  const { users } = useUsers(isAdmin)
  const [month, setMonth] = useState(getCurrentMonth())
  const [managerId, setManagerId] = useState(isAdmin ? 'all' : user?.id || '')

  const effectiveUserId = isAdmin ? managerId : user?.id || ''
  const { counts, leads, loading } = useKpiLeads(effectiveUserId, month)

  const managers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.isActive !== false &&
          (u.position === 'leads_manager_1' ||
            u.position === 'leads_manager_2' ||
            u.position === 'operator' ||
            u.position === 'head' ||
            u.role === 'admin'),
      ),
    [users],
  )

  const rows: { key: LeadCategory; label: string; fact: number }[] = [
    { key: 'fabric', label: LEAD_CATEGORIES.fabric, fact: counts.fabric },
    { key: 'finished', label: LEAD_CATEGORIES.finished, fact: counts.finished },
    { key: 'europe', label: LEAD_CATEGORIES.europe, fact: counts.europe },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text">
          {isAdmin ? 'KPI — лиды команды' : 'Мои KPI · лиды'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Факт считается автоматически: клиент впервые переведён на этап с отметкой «Лид KPI»
          (настраивается в Настройках → этапы воронки).
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

        {isAdmin && (
          <select
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
          >
            <option value="all">Вся команда</option>
            {managers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {POSITION_LABELS[u.position]}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatChip label="Всего лидов" value={counts.total} tone="secondary" />
        <StatChip label="Ткань" value={counts.fabric} />
        <StatChip label="ГП" value={counts.finished} />
        <StatChip label="Европа" value={counts.europe} />
      </div>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold text-text">Факт за {formatMonthLabel(month)}</h2>
        <p className="text-xs text-muted">
          Планы пока ведутся в Excel. Здесь — автоматический факт из CRM.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-muted">
                <th className="py-2 pr-3 font-medium">Категория</th>
                <th className="py-2 pr-3 font-medium">План</th>
                <th className="py-2 font-medium">Факт</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-gray-50">
                  <td className="py-2.5 pr-3 font-medium text-text">{row.label}</td>
                  <td className="py-2.5 pr-3 text-muted">—</td>
                  <td className="py-2.5 font-semibold text-text">
                    {loading ? '…' : row.fact}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-2.5 pr-3 font-semibold text-text">Итого</td>
                <td className="py-2.5 pr-3 text-muted">—</td>
                <td className="py-2.5 font-bold text-secondary">
                  {loading ? '…' : counts.total}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold text-text">Зафиксированные лиды</h2>
        {loading ? (
          <p className="text-sm text-muted">Загрузка...</p>
        ) : leads.length === 0 ? (
          <p className="text-sm text-muted">
            За этот месяц лидов ещё нет. Переведите клиента на этап с отметкой «Лид KPI».
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {leads.map((lead) => (
              <li
                key={lead.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium text-text">{lead.clientName}</p>
                  <p className="text-xs text-muted">
                    {lead.assignedToName} ·{' '}
                    {(lead.categories?.length
                      ? lead.categories
                      : [lead.category]
                    )
                      .map((c) => LEAD_CATEGORIES[c])
                      .join(' + ')}
                  </p>
                </div>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  {lead.month}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
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
  tone?: 'default' | 'secondary'
}) {
  const tones = {
    default: 'bg-surface text-text',
    secondary: 'bg-secondary/10 text-secondary',
  }
  return (
    <div className={`rounded-xl px-3 py-2.5 shadow-sm ${tones[tone]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-xl font-bold">{value}</p>
    </div>
  )
}
