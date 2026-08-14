import { useMemo, useState } from 'react'
import { Check, Plus, Trash2, ExternalLink } from 'lucide-react'
import { useSmm } from '@/hooks/useSmm'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { getCurrentMonth } from '@/utils/dates'
import { CONTENT_TYPE_PRESETS, type SmmContentItem, type SmmTeam } from '@/types/smm.types'
import { SmmAnalyticsTab, SmmMetricsTab } from '@/components/smm/SmmMetricsPanels'

type Tab = 'content' | 'teams' | 'calc' | 'metrics' | 'analytics'

function monthLabel(monthKey: string) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  })
}

export function Smm() {
  const [tab, setTab] = useState<Tab>('content')
  const smm = useSmm()

  if (!smm.canManage) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-text">Контроль СММ</h1>
        <p className="text-sm text-muted">Нет доступа к этому разделу.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Контроль СММ</h1>
        <p className="mt-1 text-sm text-muted">
          Контент-планы, команды, расчёты и показатели для старшего менеджера по лидам.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['content', 'Контент'],
            ['teams', 'СММ команды'],
            ['calc', 'Расчёты'],
            ['metrics', 'Показатели'],
            ['analytics', 'Аналитика'],
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

      {smm.loading ? (
        <p className="text-sm text-muted">Загрузка...</p>
      ) : tab === 'content' ? (
        <ContentTab smm={smm} />
      ) : tab === 'teams' ? (
        <TeamsTab smm={smm} />
      ) : tab === 'calc' ? (
        <Card className="space-y-3">
          <h2 className="text-base font-semibold text-text">Расчёты</h2>
          <p className="text-sm text-muted">
            Модуль оплаты СММ (статьи, 10-е / 25-е, Excel для финансов) вынесен в отдельный
            раздел.
          </p>
          <a
            href="/smm-payments"
            className="inline-flex text-sm font-medium text-secondary hover:underline"
          >
            Открыть SMM оплата →
          </a>
        </Card>
      ) : tab === 'metrics' ? (
        <SmmMetricsTab teams={smm.teams} />
      ) : tab === 'analytics' ? (
        <SmmAnalyticsTab teams={smm.teams} />
      ) : null}
    </div>
  )
}

function ContentTab({ smm }: { smm: ReturnType<typeof useSmm> }) {
  const [month, setMonth] = useState(getCurrentMonth())
  const [openTeamId, setOpenTeamId] = useState<string | null>(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [busy, setBusy] = useState(false)

  const monthItems = useMemo(
    () => smm.items.filter((i) => i.monthKey === month),
    [smm.items, month],
  )

  async function addTeamCard() {
    if (!newTeamName.trim()) return
    setBusy(true)
    try {
      await smm.createTeam({ name: newTeamName })
      setNewTeamName('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Месяц плана</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm"
          />
        </div>
        <p className="pb-2 text-sm text-muted">{monthLabel(month)}</p>
      </div>

      <Card className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <Input
            label="Новая карточка команды (для контента)"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Например: Команда A / Агентство X"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void addTeamCard()
              }
            }}
          />
        </div>
        <Button
          type="button"
          disabled={busy || !newTeamName.trim()}
          onClick={() => void addTeamCard()}
        >
          <Plus className="h-4 w-4" />
          Добавить команду
        </Button>
      </Card>

      {smm.teams.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Пока нет команд. Добавьте карточку выше или заполните раздел «СММ команды».
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {smm.teams.map((team) => {
            const items = monthItems.filter((i) => i.teamId === team.id)
            const closed = items.filter((i) => smm.isClosed(i)).length
            const open = openTeamId === team.id
            return (
              <Card key={team.id} className="space-y-3">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-2 text-left"
                  onClick={() => setOpenTeamId(open ? null : team.id)}
                >
                  <div>
                    <h3 className="text-base font-semibold text-text">{team.name}</h3>
                    <p className="text-xs text-muted">
                      План {monthLabel(month)}: {closed}/{items.length} пунктов закрыто
                    </p>
                  </div>
                  <Badge variant={items.length && closed === items.length ? 'success' : 'default'}>
                    {items.length ? `${closed}/${items.length}` : 'пусто'}
                  </Badge>
                </button>

                {open && (
                  <TeamContentPlan
                    team={team}
                    month={month}
                    items={items}
                    smm={smm}
                  />
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TeamContentPlan({
  team,
  month,
  items,
  smm,
}: {
  team: SmmTeam
  month: string
  items: SmmContentItem[]
  smm: ReturnType<typeof useSmm>
}) {
  const [title, setTitle] = useState('')
  const [plan, setPlan] = useState('4')
  const [busy, setBusy] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function addItem() {
    if (!title.trim()) return
    setBusy(true)
    try {
      await smm.addContentItem({
        teamId: team.id,
        monthKey: month,
        title,
        planCount: Number(plan) || 0,
      })
      setTitle('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-gray-100 pt-3">
      <div className="flex flex-wrap gap-2">
        {CONTENT_TYPE_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setTitle(p)}
            className={`rounded-lg border px-2.5 py-1 text-xs ${
              title === p
                ? 'border-secondary bg-secondary/10 text-secondary'
                : 'border-gray-200 text-muted hover:border-gray-300'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название контента (рилс, пост…)"
          />
        </div>
        <Input
          type="number"
          min={0}
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          placeholder="План / мес"
        />
        <Button
          type="button"
          disabled={busy || !title.trim()}
          onClick={() => void addItem()}
        >
          <Plus className="h-4 w-4" />
          В план
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted">На этот месяц пунктов плана ещё нет</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const fact = smm.factForItem(item.id)
            const closed = smm.isClosed(item)
            const open = expandedId === item.id
            return (
              <li
                key={item.id}
                className={`rounded-xl border px-3 py-3 ${
                  closed ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-100 bg-background'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setExpandedId(open ? null : item.id)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-text">{item.title}</span>
                      {closed ? (
                        <Badge variant="success">
                          <Check className="mr-1 inline h-3 w-3" />
                          Закрыт
                        </Badge>
                      ) : (
                        <Badge variant="warning">
                          {fact}/{item.planCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted">
                      План: {item.planCount} · Факт: {fact}
                      {!closed && item.planCount > 0
                        ? ` · осталось ${Math.max(0, item.planCount - fact)}`
                        : ''}
                    </p>
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Удалить «${item.title}» из плана?`)) {
                        void smm.deleteContentItem(item.id)
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {open && (
                  <ContentItemFacts
                    item={item}
                    smm={smm}
                    onPlanChange={(n) => void smm.updateContentItem(item.id, { planCount: n })}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ContentItemFacts({
  item,
  smm,
  onPlanChange,
}: {
  item: SmmContentItem
  smm: ReturnType<typeof useSmm>
  onPlanChange: (n: number) => void
}) {
  const facts = smm.facts
    .filter((f) => f.contentItemId === item.id)
    .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [count, setCount] = useState('1')
  const [note, setNote] = useState('')
  const [planEdit, setPlanEdit] = useState(String(item.planCount))
  const [busy, setBusy] = useState(false)

  async function add() {
    setBusy(true)
    try {
      await smm.addFact({
        contentItemId: item.id,
        publishedAt: date,
        count: Number(count) || 1,
        note,
      })
      setCount('1')
      setNote('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-gray-200/80 pt-3">
      <div className="flex flex-wrap items-end gap-2">
        <Input
          label="План (шт/мес)"
          type="number"
          min={0}
          value={planEdit}
          onChange={(e) => setPlanEdit(e.target.value)}
          className="w-28"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onPlanChange(Math.max(0, Number(planEdit) || 0))}
        >
          Сохранить план
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <Input
          type="date"
          label="Дата публикации"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Input
          type="number"
          min={1}
          label="Факт (+шт)"
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
        <Input
          label="Комментарий"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="необяз."
        />
        <div className="flex items-end">
          <Button
            type="button"
            fullWidth
            disabled={busy}
            onClick={() => void add()}
          >
            <Plus className="h-4 w-4" />
            Добавить факт
          </Button>
        </div>
      </div>

      {facts.length === 0 ? (
        <p className="text-xs text-muted">Фактов пока нет — добавьте дату и количество</p>
      ) : (
        <ul className="space-y-1">
          {facts.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium text-text">{f.publishedAt}</span>
                <span className="text-muted"> · +{f.count}</span>
                {f.note ? <span className="text-muted"> · {f.note}</span> : null}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void smm.deleteFact(f.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TeamsTab({ smm }: { smm: ReturnType<typeof useSmm> }) {
  const [form, setForm] = useState({
    name: '',
    instagram: '',
    telegram: '',
    facebook: '',
    youtube: '',
    contactName: '',
    contactPhone: '',
    contactNote: '',
  })
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save() {
    if (!form.name.trim()) return
    setBusy(true)
    try {
      if (editId) {
        await smm.updateTeam(editId, { ...form, name: form.name.trim() })
        setEditId(null)
      } else {
        await smm.createTeam(form)
      }
      setForm({
        name: '',
        instagram: '',
        telegram: '',
        facebook: '',
        youtube: '',
        contactName: '',
        contactPhone: '',
        contactNote: '',
      })
    } finally {
      setBusy(false)
    }
  }

  function startEdit(t: SmmTeam) {
    setEditId(t.id)
    setForm({
      name: t.name,
      instagram: t.instagram || '',
      telegram: t.telegram || '',
      facebook: t.facebook || '',
      youtube: t.youtube || '',
      contactName: t.contactName || '',
      contactPhone: t.contactPhone || '',
      contactNote: t.contactNote || '',
    })
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="text-base font-semibold text-text">
          {editId ? 'Редактировать команду' : 'Новая СММ команда'}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Название / компания *"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <Input
            label="Контакт (ФИО)"
            value={form.contactName}
            onChange={(e) => set('contactName', e.target.value)}
          />
          <Input
            label="Телефон контакта"
            value={form.contactPhone}
            onChange={(e) => set('contactPhone', e.target.value)}
          />
          <Input
            label="Instagram"
            value={form.instagram}
            onChange={(e) => set('instagram', e.target.value)}
            placeholder="https://instagram.com/..."
          />
          <Input
            label="Telegram"
            value={form.telegram}
            onChange={(e) => set('telegram', e.target.value)}
          />
          <Input
            label="Facebook"
            value={form.facebook}
            onChange={(e) => set('facebook', e.target.value)}
          />
          <Input
            label="YouTube"
            value={form.youtube}
            onChange={(e) => set('youtube', e.target.value)}
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Заметка по контакту"
              value={form.contactNote}
              onChange={(e) => set('contactNote', e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy || !form.name.trim()} onClick={() => void save()}>
            {editId ? 'Сохранить' : 'Добавить команду'}
          </Button>
          {editId && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditId(null)
                setForm({
                  name: '',
                  instagram: '',
                  telegram: '',
                  facebook: '',
                  youtube: '',
                  contactName: '',
                  contactPhone: '',
                  contactNote: '',
                })
              }}
            >
              Отмена
            </Button>
          )}
        </div>
      </Card>

      {smm.teams.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Команд пока нет</p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {smm.teams.map((t) => (
            <Card key={t.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-text">{t.name}</h3>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(t)}>
                    Изменить
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Удалить «${t.name}» и связанные планы?`)) {
                        void smm.deleteTeam(t.id)
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted">
                {t.contactName || 'Контакт не указан'}
                {t.contactPhone ? ` · ${t.contactPhone}` : ''}
              </p>
              {t.contactNote && <p className="text-xs text-muted">{t.contactNote}</p>}
              <div className="flex flex-wrap gap-2 text-xs">
                <LinkChip label="IG" href={t.instagram} />
                <LinkChip label="TG" href={t.telegram} />
                <LinkChip label="FB" href={t.facebook} />
                <LinkChip label="YT" href={t.youtube} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function LinkChip({ label, href }: { label: string; href: string }) {
  if (!href?.trim()) {
    return (
      <span className="rounded-md bg-background px-2 py-1 text-muted">{label}: —</span>
    )
  }
  const url = href.startsWith('http') ? href : `https://${href}`
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-md bg-secondary/10 px-2 py-1 font-medium text-secondary hover:bg-secondary/15"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  )
}
