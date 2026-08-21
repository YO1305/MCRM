import { useState } from 'react'
import { Trash2, ExternalLink } from 'lucide-react'
import { useSmm } from '@/hooks/useSmm'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { SmmAnalyticsTab, SmmMetricsTab } from '@/components/smm/SmmMetricsPanels'
import { SmmContentPlan } from '@/components/smm/SmmContentPlan'
import type { SmmTeam } from '@/types/smm.types'

type Tab = 'content' | 'teams' | 'calc' | 'metrics' | 'analytics'

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
          Контент-план по каждой SMM-команде, факт публикации, показатели и аналитика.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['content', 'План'],
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
        <SmmContentPlan smm={smm} />
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
