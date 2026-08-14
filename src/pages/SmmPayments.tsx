import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Plus, Trash2 } from 'lucide-react'
import { useSmmTeams, useAllSmmPaymentItems, useSmmPaymentItems } from '@/hooks/useSmmPaymentsModule'
import {
  useSmmPaymentItemsActions,
  useSmmPayments,
  useSmmPaymentsHistory,
} from '@/hooks/useSmmPayments'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { getCurrentMonth } from '@/utils/dates'
import {
  CYCLE_LABELS,
  computeAmountUZS,
  type SmmCurrency,
  type SmmPaymentCycle,
  type SmmPaymentItem,
} from '@/types/smmPayment.types'
import type { SmmTeam } from '@/types/smm.types'

type Tab = 'setup' | 'pay' | 'history'

function formatSum(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n || 0)
}

function monthOptions(count = 18) {
  const out: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({
      value,
      label: d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
    })
  }
  return out
}

export function SmmPayments() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>('pay')
  const [month, setMonth] = useState(params.get('month') || getCurrentMonth())
  const [cycle, setCycle] = useState<SmmPaymentCycle>(
    params.get('cycle') === 'second' ? 'second' : 'first',
  )

  const { canManage, loading: teamsLoading } = useSmmTeams()

  useEffect(() => {
    const m = params.get('month')
    const c = params.get('cycle')
    if (m) setMonth(m)
    if (c === 'first' || c === 'second') setCycle(c)
  }, [params])

  if (!canManage) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-text">SMM оплата</h1>
        <p className="text-sm text-muted">Нет доступа</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text">SMM оплата</h1>
        <p className="mt-1 text-sm text-muted">
          Настройка статей, оплата за месяц (10-е / 25-е), экспорт для финансов.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['setup', 'Команды и настройка'],
            ['pay', 'Оплата за месяц'],
            ['history', 'История'],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={tab === id ? 'secondary' : 'ghost'}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {teamsLoading ? (
        <p className="text-sm text-muted">Загрузка...</p>
      ) : tab === 'setup' ? (
        <SetupTab />
      ) : tab === 'pay' ? (
        <PayTab month={month} setMonth={setMonth} cycle={cycle} setCycle={setCycle} />
      ) : (
        <HistoryTab />
      )}
    </div>
  )
}

function SetupTab() {
  const { teams, activeTeams, createTeam, updateTeam, deleteTeam } = useSmmTeams()
  const { items: allItems } = useAllSmmPaymentItems()
  const actions = useSmmPaymentItemsActions()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [teamForm, setTeamForm] = useState({
    name: '',
    agency: '',
    contactName: '',
    contactPhone: '',
    isActive: true,
  })
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [showTeamForm, setShowTeamForm] = useState(false)
  const [busy, setBusy] = useState(false)

  const selected = teams.find((t) => t.id === selectedId) || null
  const { items } = useSmmPaymentItems(selectedId)

  useEffect(() => {
    if (!selectedId && activeTeams[0]) setSelectedId(activeTeams[0].id)
  }, [activeTeams, selectedId])

  async function saveTeam() {
    if (!teamForm.name.trim()) return
    setBusy(true)
    try {
      if (editingTeamId) {
        await updateTeam(editingTeamId, {
          name: teamForm.name.trim(),
          agency: teamForm.agency.trim(),
          contactName: teamForm.contactName.trim(),
          contactPhone: teamForm.contactPhone.trim(),
          isActive: teamForm.isActive,
        })
      } else {
        const id = await createTeam(teamForm)
        setSelectedId(id)
      }
      setShowTeamForm(false)
      setEditingTeamId(null)
      setTeamForm({
        name: '',
        agency: '',
        contactName: '',
        contactPhone: '',
        isActive: true,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="space-y-3 h-fit">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-text">Команды</h2>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditingTeamId(null)
              setTeamForm({
                name: '',
                agency: '',
                contactName: '',
                contactPhone: '',
                isActive: true,
              })
              setShowTeamForm(true)
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить
          </Button>
        </div>

        {teams.length === 0 ? (
          <p className="text-sm text-muted">Добавьте первую команду</p>
        ) : (
          <ul className="space-y-1">
            {teams.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    selectedId === t.id
                      ? 'bg-secondary/10 font-medium text-secondary'
                      : 'hover:bg-background text-text'
                  } ${t.isActive === false ? 'opacity-50' : ''}`}
                >
                  <span className="block">{t.name}</span>
                  <span className="text-xs text-muted">{t.agency || '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="space-y-4">
        {showTeamForm && (
          <Card className="space-y-3">
            <h3 className="font-semibold text-text">
              {editingTeamId ? 'Редактировать команду' : 'Новая команда'}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Город / команда *"
                value={teamForm.name}
                onChange={(e) => setTeamForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ташкент"
              />
              <Input
                label="Агентство"
                value={teamForm.agency}
                onChange={(e) => setTeamForm((f) => ({ ...f, agency: e.target.value }))}
                placeholder="Brand Face"
              />
              <Input
                label="Контакт"
                value={teamForm.contactName}
                onChange={(e) => setTeamForm((f) => ({ ...f, contactName: e.target.value }))}
              />
              <Input
                label="Телефон"
                value={teamForm.contactPhone}
                onChange={(e) => setTeamForm((f) => ({ ...f, contactPhone: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={teamForm.isActive}
                onChange={(e) => setTeamForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Активна
            </label>
            <div className="flex gap-2">
              <Button type="button" disabled={busy} onClick={() => void saveTeam()}>
                Сохранить
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowTeamForm(false)}>
                Отмена
              </Button>
            </div>
          </Card>
        )}

        {!selected ? (
          <Card>
            <p className="text-sm text-muted">Выберите команду слева</p>
          </Card>
        ) : (
          <TeamItemsPanel
            team={selected}
            items={items}
            allCount={allItems.filter((i) => i.teamId === selected.id).length}
            actions={actions}
            onEditTeam={() => {
              setEditingTeamId(selected.id)
              setTeamForm({
                name: selected.name,
                agency: selected.agency || '',
                contactName: selected.contactName || '',
                contactPhone: selected.contactPhone || '',
                isActive: selected.isActive !== false,
              })
              setShowTeamForm(true)
            }}
            onDeleteTeam={() => {
              if (confirm(`Деактивировать «${selected.name}»?`)) void deleteTeam(selected.id)
            }}
          />
        )}
      </div>
    </div>
  )
}

function TeamItemsPanel({
  team,
  items,
  allCount,
  actions,
  onEditTeam,
  onDeleteTeam,
}: {
  team: SmmTeam
  items: SmmPaymentItem[]
  allCount: number
  actions: ReturnType<typeof useSmmPaymentItemsActions>
  onEditTeam: () => void
  onDeleteTeam: () => void
}) {
  const [editing, setEditing] = useState<SmmPaymentItem | null>(null)
  const [creating, setCreating] = useState(false)
  const lastUsdRate = useMemo(() => {
    const usd = items.filter((i) => i.currency === 'USD' && i.usdRate)
    return usd.length ? Number(usd[usd.length - 1].usdRate) : 12800
  }, [items])

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-text">{team.name}</h2>
          <p className="text-sm text-muted">{team.agency || 'Агентство не указано'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onEditTeam}>
            Изменить команду
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDeleteTeam}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="sm" onClick={() => { setCreating(true); setEditing(null) }}>
            <Plus className="h-3.5 w-3.5" />
            Добавить статью
          </Button>
        </div>
      </div>

      {(creating || editing) && (
        <ItemForm
          teamId={team.id}
          initial={editing}
          defaultOrder={items.length + 1}
          defaultUsdRate={lastUsdRate}
          onCancel={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSave={async (data) => {
            await actions.saveItemFields(editing?.id || null, data)
            setCreating(false)
            setEditing(null)
          }}
        />
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs uppercase text-muted">
              <th className="px-2 py-2">№</th>
              <th className="px-2 py-2">Статья</th>
              <th className="px-2 py-2">Сумма</th>
              <th className="px-2 py-2">Валюта</th>
              <th className="px-2 py-2">Курс</th>
              <th className="px-2 py-2">Сумма (сум)</th>
              <th className="px-2 py-2">Активна</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-2 py-4 text-muted">
                  Статей пока нет{allCount ? '' : ''}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-gray-50">
                  <td className="px-2 py-2 text-muted">{item.order}</td>
                  <td className="px-2 py-2 font-medium text-text">{item.label}</td>
                  <td className="px-2 py-2 text-muted">{formatSum(item.amount)}</td>
                  <td className="px-2 py-2 text-muted">{item.currency}</td>
                  <td className="px-2 py-2 text-muted">
                    {item.currency === 'USD' ? formatSum(Number(item.usdRate) || 0) : '—'}
                  </td>
                  <td className="px-2 py-2 font-medium text-text">
                    {formatSum(item.amountUZS)}
                  </td>
                  <td className="px-2 py-2">
                    {item.isActive !== false ? (
                      <Badge variant="success">Да</Badge>
                    ) : (
                      <Badge variant="default">Нет</Badge>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(item)
                          setCreating(false)
                        }}
                      >
                        Изм.
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void actions.deleteItem(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function ItemForm({
  teamId,
  initial,
  defaultOrder,
  defaultUsdRate,
  onCancel,
  onSave,
}: {
  teamId: string
  initial: SmmPaymentItem | null
  defaultOrder: number
  defaultUsdRate: number
  onCancel: () => void
  onSave: (data: {
    teamId: string
    label: string
    amount: number
    currency: SmmCurrency
    usdRate: number | null
    order: number
    isActive: boolean
  }) => Promise<void>
}) {
  const [label, setLabel] = useState(initial?.label || '')
  const [amount, setAmount] = useState(String(initial?.amount ?? ''))
  const [currency, setCurrency] = useState<SmmCurrency>(initial?.currency || 'UZS')
  const [usdRate, setUsdRate] = useState(
    String(initial?.usdRate ?? defaultUsdRate),
  )
  const [order, setOrder] = useState(String(initial?.order ?? defaultOrder))
  const [isActive, setIsActive] = useState(initial?.isActive !== false)
  const [busy, setBusy] = useState(false)

  const amountUZS = computeAmountUZS(
    Number(amount) || 0,
    currency,
    currency === 'USD' ? Number(usdRate) || 0 : null,
  )

  return (
    <div className="space-y-3 rounded-xl border border-gray-100 bg-background p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input label="Название статьи *" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Аванс" />
        <Input label="Сумма *" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Валюта</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as SmmCurrency)}
            className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm"
          >
            <option value="UZS">UZS</option>
            <option value="USD">USD</option>
          </select>
        </div>
        {currency === 'USD' && (
          <Input
            label="Курс USD"
            type="number"
            value={usdRate}
            onChange={(e) => setUsdRate(e.target.value)}
          />
        )}
        <Input label="Порядок" type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
        <div className="flex flex-col justify-end">
          <p className="text-sm text-muted">
            Сумма в сум: <span className="font-semibold text-text">{formatSum(amountUZS)}</span>
          </p>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Активна
      </label>
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={busy || !label.trim()}
          onClick={() => {
            setBusy(true)
            void onSave({
              teamId,
              label,
              amount: Number(amount) || 0,
              currency,
              usdRate: currency === 'USD' ? Number(usdRate) || 0 : null,
              order: Number(order) || 0,
              isActive,
            }).finally(() => setBusy(false))
          }}
        >
          Сохранить статью
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </div>
  )
}

function PayTab({
  month,
  setMonth,
  cycle,
  setCycle,
}: {
  month: string
  setMonth: (v: string) => void
  cycle: SmmPaymentCycle
  setCycle: (v: SmmPaymentCycle) => void
}) {
  const { teams } = useSmmTeams()
  const { items } = useAllSmmPaymentItems()
  const { payments, loading, generatePayments, markPaid, markPending, deletePayment, exportExcel, summary } =
    useSmmPayments(month, cycle)
  const [busy, setBusy] = useState(false)
  const [noteId, setNoteId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const byTeam = useMemo(() => {
    const map = new Map<string, typeof payments>()
    for (const p of payments) {
      if (!map.has(p.teamId)) map.set(p.teamId, [])
      map.get(p.teamId)!.push(p)
    }
    return [...map.entries()]
  }, [payments])

  async function handleGenerate() {
    const existing = payments.length
    if (existing > 0) {
      const ok = confirm(
        'Записи за этот период уже созданы. Создать только новые (для новых статей)?',
      )
      if (!ok) return
    }
    setBusy(true)
    try {
      const res = await generatePayments(teams, items)
      alert(`Создано: ${res.created}, пропущено (уже были): ${res.skipped}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Месяц</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm"
          >
            {monthOptions().map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          {(['first', 'second'] as const).map((c) => (
            <Button
              key={c}
              type="button"
              size="sm"
              variant={cycle === c ? 'secondary' : 'ghost'}
              onClick={() => setCycle(c)}
            >
              {CYCLE_LABELS[c]}
            </Button>
          ))}
        </div>
        <Button type="button" disabled={busy} onClick={() => void handleGenerate()}>
          Создать записи
        </Button>
        <Button type="button" variant="secondary" onClick={() => exportExcel()}>
          <Download className="h-4 w-4" />
          Экспорт Excel
        </Button>
      </Card>

      {summary.allPaid && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Все оплаты за этот период выполнены ✓
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Загрузка...</p>
      ) : payments.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Записей нет. Нажмите «Создать записи» после настройки статей в командах.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {byTeam.map(([teamId, list]) => {
            const pending = list
              .filter((p) => p.status === 'pending')
              .reduce((s, p) => s + p.amount, 0)
            const paid = list
              .filter((p) => p.status === 'paid')
              .reduce((s, p) => s + p.amount, 0)
            return (
              <Card key={teamId} className="space-y-3">
                <div className="border-b border-gray-100 pb-2">
                  <h3 className="font-semibold text-text">
                    {list[0].teamName}
                    {list[0].agencyName ? ` — ${list[0].agencyName}` : ''}
                  </h3>
                </div>
                <ul className="space-y-2">
                  {list.map((p) => (
                    <li
                      key={p.id}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 ${
                        p.status === 'paid' ? 'bg-gray-50 text-muted' : 'bg-background'
                      }`}
                    >
                      <div>
                        <p
                          className={`text-sm font-medium ${
                            p.status === 'paid' ? 'line-through text-muted' : 'text-text'
                          }`}
                        >
                          {p.itemLabel}
                        </p>
                        <p className="text-xs text-muted">{formatSum(p.amount)} сум</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={p.status}
                          onChange={(e) => {
                            const v = e.target.value
                            if (v === 'paid') {
                              setNoteId(p.id)
                              setNote(p.note || '')
                            } else {
                              void markPending(p.id)
                            }
                          }}
                          className="rounded-lg border border-gray-200 bg-surface px-2 py-1.5 text-sm"
                        >
                          <option value="pending">К оплате</option>
                          <option value="paid">Оплачено</option>
                        </select>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-danger"
                          title="Удалить запись"
                          onClick={() => {
                            if (
                              confirm(
                                `Удалить запись «${p.itemLabel}»?\nМожно создать заново через «Создать записи».`,
                              )
                            ) {
                              void deletePayment(p.id).catch((err) => {
                                console.error(err)
                                alert('Не удалось удалить')
                              })
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {noteId === p.id && (
                        <div className="flex w-full flex-wrap gap-2">
                          <Input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Комментарий (необязательно)"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              void markPaid(p.id, note).then(() => setNoteId(null))
                            }}
                          >
                            Подтвердить оплату
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setNoteId(null)}>
                            Отмена
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted">
                  Итого к оплате: {formatSum(pending)} сум · оплачено: {formatSum(paid)} сум
                </p>
              </Card>
            )
          })}
        </div>
      )}

      <Card className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div>
          <p className="text-[11px] uppercase text-muted">Команд</p>
          <p className="text-lg font-bold text-text">{summary.teams}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-muted">Статей</p>
          <p className="text-lg font-bold text-text">{summary.items}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-muted">К оплате</p>
          <p className="text-lg font-bold text-text">{formatSum(summary.pending)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-muted">Оплачено</p>
          <p className="text-lg font-bold text-text">{formatSum(summary.paid)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-muted">Остаток</p>
          <p className="text-lg font-bold text-danger">{formatSum(summary.remaining)}</p>
        </div>
      </Card>
    </div>
  )
}

function HistoryTab() {
  const { payments, loading, deletePayment, deletePayments } = useSmmPaymentsHistory()
  const { teams } = useSmmTeams()
  const [month, setMonth] = useState('all')
  const [teamId, setTeamId] = useState('all')
  const [status, setStatus] = useState('all')
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (month !== 'all' && p.period !== month) return false
      if (teamId !== 'all' && p.teamId !== teamId) return false
      if (status !== 'all' && p.status !== status) return false
      return true
    })
  }, [payments, month, teamId, status])

  const months = useMemo(() => {
    const set = new Set(payments.map((p) => p.period))
    return [...set].sort().reverse()
  }, [payments])

  async function handleDeleteOne(p: (typeof filtered)[0]) {
    if (
      !confirm(
        `Удалить из истории?\n${p.period} · ${p.teamName} · ${p.itemLabel} · ${formatSum(p.amount)} сум`,
      )
    ) {
      return
    }
    try {
      await deletePayment(p.id)
    } catch (err) {
      console.error(err)
      alert('Не удалось удалить')
    }
  }

  async function handleDeleteFiltered() {
    if (!filtered.length) return
    if (
      !confirm(
        `Удалить все показанные записи (${filtered.length})?\nЭто нельзя отменить. При необходимости создайте оплаты заново во вкладке «Оплата».`,
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await deletePayments(filtered.map((p) => p.id))
    } catch (err) {
      console.error(err)
      alert('Не удалось удалить')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
        >
          <option value="all">Все месяцы</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
        >
          <option value="all">Все команды</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
        >
          <option value="all">Все статусы</option>
          <option value="pending">К оплате</option>
          <option value="paid">Оплачено</option>
        </select>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy || filtered.length === 0}
          className="text-danger hover:bg-red-50"
          onClick={() => void handleDeleteFiltered()}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {busy ? 'Удаление...' : `Удалить показанные (${filtered.length})`}
        </Button>
      </Card>

      <Card className="overflow-hidden !p-0">
        {loading ? (
          <p className="p-4 text-sm text-muted">Загрузка...</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted">Нет записей по фильтру</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-background text-xs uppercase text-muted">
                  <th className="px-3 py-2">Месяц</th>
                  <th className="px-3 py-2">Цикл</th>
                  <th className="px-3 py-2">Команда</th>
                  <th className="px-3 py-2">Статья</th>
                  <th className="px-3 py-2">Сумма</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2">Оплачено</th>
                  <th className="px-3 py-2">Кем</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="px-3 py-2 text-muted">{p.period}</td>
                    <td className="px-3 py-2 text-muted">{CYCLE_LABELS[p.paymentCycle]}</td>
                    <td className="px-3 py-2 font-medium text-text">{p.teamName}</td>
                    <td className="px-3 py-2 text-muted">{p.itemLabel}</td>
                    <td className="px-3 py-2 text-muted">{formatSum(p.amount)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={p.status === 'paid' ? 'success' : 'warning'}>
                        {p.status === 'paid' ? 'Оплачено' : 'К оплате'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {typeof p.paidAt === 'string' ? p.paidAt.slice(0, 10) : '—'}
                    </td>
                    <td className="px-3 py-2 text-muted">{p.paidBy || '—'}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-danger"
                        title="Удалить"
                        onClick={() => void handleDeleteOne(p)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
