import { useEffect, useMemo, useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { useSmm } from '@/hooks/useSmm'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { getCurrentMonth, todayISO } from '@/utils/dates'
import {
  SMM_CONTENT_FORMATS,
  inferSmmFormat,
  smmFormatLabel,
  type SmmContentFormat,
  type SmmContentItem,
  type SmmTeam,
} from '@/types/smm.types'

function monthLabel(monthKey: string) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  })
}

export function SmmContentPlan({ smm }: { smm: ReturnType<typeof useSmm> }) {
  const [month, setMonth] = useState(getCurrentMonth())
  const [teamId, setTeamId] = useState('')

  useEffect(() => {
    if (!teamId && smm.teams[0]) setTeamId(smm.teams[0].id)
  }, [smm.teams, teamId])

  const activeTeamId = smm.teams.some((t) => t.id === teamId)
    ? teamId
    : smm.teams[0]?.id || ''
  const team = smm.teams.find((t) => t.id === activeTeamId)

  const monthItems = useMemo(
    () => smm.items.filter((i) => i.monthKey === month && i.teamId === activeTeamId),
    [smm.items, month, activeTeamId],
  )
  const doneCount = monthItems.filter((i) => smm.isDone(i)).length

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <p className="text-sm text-muted">
          В начале месяца выберите команду и соберите план: формат, название, короткое описание и
          дату публикации по графику SMM. Галочка появится только когда укажете фактическую дату
          выхода.
        </p>
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
          <div className="min-w-[220px] flex-1">
            <label className="mb-1.5 block text-sm font-medium text-text">Команда</label>
            <select
              value={activeTeamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm"
            >
              {smm.teams.length === 0 ? (
                <option value="">Сначала добавьте команду во вкладке «СММ команды»</option>
              ) : (
                smm.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <p className="pb-2 text-sm text-muted">{monthLabel(month)}</p>
        </div>
      </Card>

      {!team ? (
        <Card>
          <p className="text-sm text-muted">
            Нет команд. Откройте вкладку «СММ команды» и добавьте агентство / подрядчика.
          </p>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-text">План · {team.name}</h2>
            <Badge variant={monthItems.length && doneCount === monthItems.length ? 'success' : 'default'}>
              Выполнено {doneCount} из {monthItems.length}
            </Badge>
          </div>
          <AddPlanForm team={team} month={month} onAdd={smm.addContentItem} />
          {monthItems.length === 0 ? (
            <Card>
              <p className="text-sm text-muted">На этот месяц записей ещё нет.</p>
            </Card>
          ) : (
            <ul className="space-y-2">
              {monthItems.map((item) => (
                <PlanRow key={item.id} item={item} smm={smm} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function AddPlanForm({
  team,
  month,
  onAdd,
}: {
  team: SmmTeam
  month: string
  onAdd: ReturnType<typeof useSmm>['addContentItem']
}) {
  const [format, setFormat] = useState<SmmContentFormat>('post')
  const [formatOther, setFormatOther] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [plannedDate, setPlannedDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    setBusy(true)
    try {
      await onAdd({
        teamId: team.id,
        monthKey: month,
        format,
        formatOther,
        title,
        description,
        plannedDate,
      })
      setTitle('')
      setDescription('')
      setFormatOther('')
      setPlannedDate('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold text-text">Новая запись в план</h3>
      <div className="flex flex-wrap gap-2">
        {SMM_CONTENT_FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFormat(f.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              format === f.id
                ? 'border-secondary bg-secondary/10 text-secondary'
                : 'border-gray-200 text-muted hover:border-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {format === 'other' && (
        <Input
          label="Какой формат"
          value={formatOther}
          onChange={(e) => setFormatOther(e.target.value)}
          placeholder="Например: карусель, прямая трансляция"
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Кратко, как в графике SMM"
        />
        <Input
          type="date"
          label="Запланированная дата публикации"
          value={plannedDate}
          onChange={(e) => setPlannedDate(e.target.value)}
        />
      </div>
      <Textarea
        label="Краткое описание"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="О чём ролик / пост, оффер, продукт"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button
        type="button"
        disabled={busy || !title.trim() || !plannedDate}
        onClick={() => void save()}
      >
        <Plus className="h-4 w-4" />
        Сохранить в план
      </Button>
    </Card>
  )
}

function PlanRow({
  item,
  smm,
}: {
  item: SmmContentItem
  smm: ReturnType<typeof useSmm>
}) {
  const done = smm.isDone(item)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description || '')
  const [plannedDate, setPlannedDate] = useState(item.plannedDate || '')
  const [publishedAt, setPublishedAt] = useState(smm.publishedDateOf(item) || todayISO())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function savePlan() {
    setError('')
    setBusy(true)
    try {
      await smm.updateContentItem(item.id, {
        title: title.trim(),
        description: description.trim(),
        plannedDate,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  async function saveFact() {
    setError('')
    setBusy(true)
    try {
      await smm.markPublished(item.id, publishedAt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Укажите фактическую дату')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li
      className={`rounded-xl border px-3 py-3 ${
        done ? 'border-emerald-200 bg-emerald-50/70' : 'border-gray-100 bg-surface'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen((v) => !v)}>
          <div className="flex flex-wrap items-center gap-2">
            {done ? (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="h-3.5 w-3.5" />
              </span>
            ) : (
              <span className="inline-flex h-5 w-5 rounded-full border border-gray-300" />
            )}
            <Badge variant="info">
              {smmFormatLabel(
                item.format || inferSmmFormat(item.title).format,
                item.formatOther || inferSmmFormat(item.title).formatOther,
              )}
            </Badge>
            <span className="font-medium text-text">{item.title}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            План: {item.plannedDate || 'дата не указана'}
            {done ? ` · факт: ${smm.publishedDateOf(item)} · выполнено` : ' · не опубликовано'}
          </p>
          {item.description ? <p className="mt-0.5 text-xs text-muted">{item.description}</p> : null}
        </button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            if (confirm(`Удалить «${item.title}» из плана?`)) void smm.deleteContentItem(item.id)
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-gray-200/80 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input
              type="date"
              label="Запланированная дата"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
            />
          </div>
          <Textarea
            label="Краткое описание"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void savePlan()}>
            Сохранить правки плана
          </Button>

          <div className="rounded-lg bg-background p-3">
            <p className="mb-2 text-xs font-medium text-text">
              Когда контент вышел — укажите фактическую дату. После сохранения появится галочка.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <Input
                type="date"
                label="Фактическая дата публикации"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
              />
              <Button type="button" disabled={busy || !publishedAt} onClick={() => void saveFact()}>
                <Check className="h-4 w-4" />
                Отметить выполненным
              </Button>
              {done && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void smm.clearPublished(item.id)}
                >
                  Снять галочку
                </Button>
              )}
            </div>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </li>
  )
}
