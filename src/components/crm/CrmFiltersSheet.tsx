import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { POSITION_LABELS } from '@/constants/positions'
import { countryName } from '@/constants/leadProducts'
import type { ActivityStatus } from '@/types/client.types'
import type { GroqActivityLabel } from '@/types/aiActivity.types'
import type { User } from '@/types/user.types'
import type { ClientStage } from '@/constants/clientStages'

export interface CrmFilterValues {
  assigneeId: string
  country: string
  source: string
  groq: GroqActivityLabel | 'all'
  activity: ActivityStatus | 'all'
  waitStatus: string
  stage: ClientStage | 'all'
}

interface Option {
  value: string
  label: string
}

interface CrmFiltersSheetProps {
  open: boolean
  onClose: () => void
  values: CrmFilterValues
  onChange: (next: CrmFilterValues) => void
  onReset: () => void
  isAdmin: boolean
  showActivity: boolean
  managers: User[]
  countries: Option[]
  sources: Option[]
  waitOptions: string[]
  stages: { value: ClientStage; label: string }[]
  showStage: boolean
}

function ChipRow<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            value === opt.value
              ? 'bg-secondary text-white'
              : 'border border-gray-200 bg-background text-muted hover:text-text'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-text">{label}</p>
      {children}
    </div>
  )
}

export function crmFilterCount(values: CrmFilterValues): number {
  let n = 0
  if (values.assigneeId !== 'all') n += 1
  if (values.country !== 'all') n += 1
  if (values.source !== 'all') n += 1
  if (values.groq !== 'all') n += 1
  if (values.activity !== 'all') n += 1
  if (values.waitStatus !== 'all') n += 1
  if (values.stage !== 'all') n += 1
  return n
}

export function crmFilterChips(
  values: CrmFilterValues,
  ctx: {
    managers: User[]
    sources: Option[]
    isAdmin: boolean
    showActivity: boolean
    stages: { value: ClientStage; label: string }[]
  },
): { key: keyof CrmFilterValues; label: string }[] {
  const chips: { key: keyof CrmFilterValues; label: string }[] = []
  if (ctx.isAdmin && values.assigneeId !== 'all') {
    const name = ctx.managers.find((u) => u.id === values.assigneeId)?.name || 'Менеджер'
    chips.push({ key: 'assigneeId', label: name })
  }
  if (values.country !== 'all') {
    chips.push({ key: 'country', label: countryName(values.country) })
  }
  if (values.source !== 'all') {
    const src = ctx.sources.find((s) => s.value === values.source)?.label || values.source
    chips.push({ key: 'source', label: src })
  }
  if (ctx.isAdmin && values.groq !== 'all') {
    const map: Record<GroqActivityLabel, string> = {
      active: 'Активные',
      passive: 'Пассивные',
      paused: 'На паузе',
    }
    chips.push({ key: 'groq', label: map[values.groq] })
  }
  if (ctx.showActivity && values.activity !== 'all') {
    const map: Record<ActivityStatus, string> = {
      new: 'Новые',
      active: 'Срок: активные',
      critical: 'Критические',
      frozen: 'Замороженные',
    }
    chips.push({ key: 'activity', label: map[values.activity] })
  }
  if (values.waitStatus !== 'all') {
    chips.push({ key: 'waitStatus', label: values.waitStatus })
  }
  if (values.stage !== 'all') {
    const st = ctx.stages.find((s) => s.value === values.stage)?.label || values.stage
    chips.push({ key: 'stage', label: st })
  }
  return chips
}

export function CrmFiltersSheet({
  open,
  onClose,
  values,
  onChange,
  onReset,
  isAdmin,
  showActivity,
  managers,
  countries,
  sources,
  waitOptions,
  stages,
  showStage,
}: CrmFiltersSheetProps) {
  if (!open) return null

  function patch(part: Partial<CrmFilterValues>) {
    onChange({ ...values, ...part })
  }

  const selectClass =
    'w-full rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-secondary'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} role="presentation" />
      <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-surface px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-lg font-bold text-text">Фильтры CRM</h2>
            <p className="text-xs text-muted">Только нужные поля — отмечайте и смотрите воронку</p>
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

        <div className="space-y-5 p-4 sm:p-5">
          {isAdmin && (
            <Field label="Работа по лиду">
              <ChipRow
                value={values.groq}
                onChange={(groq) => patch({ groq })}
                options={[
                  { value: 'all', label: 'Все' },
                  { value: 'active', label: 'Активные' },
                  { value: 'passive', label: 'Пассивные' },
                  { value: 'paused', label: 'На паузе' },
                ]}
              />
            </Field>
          )}

          {isAdmin && managers.length > 0 && (
            <Field label="Менеджер">
              <select
                value={values.assigneeId}
                onChange={(e) => patch({ assigneeId: e.target.value })}
                className={selectClass}
              >
                <option value="all">Все менеджеры</option>
                {managers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {POSITION_LABELS[u.position]}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Страна">
            <select
              value={values.country}
              onChange={(e) => patch({ country: e.target.value })}
              className={selectClass}
            >
              <option value="all">Все страны</option>
              {countries.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Источник">
            <select
              value={values.source}
              onChange={(e) => patch({ source: e.target.value })}
              className={selectClass}
            >
              <option value="all">Все источники</option>
              {sources.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          {showActivity && (
            <Field label="Срок лида">
              <ChipRow
                value={values.activity}
                onChange={(activity) => patch({ activity })}
                options={[
                  { value: 'all', label: 'Все' },
                  { value: 'new', label: 'Новые' },
                  { value: 'active', label: 'Активные' },
                  { value: 'critical', label: 'Критические' },
                  { value: 'frozen', label: 'Замороженные' },
                ]}
              />
            </Field>
          )}

          {waitOptions.length > 0 && (
            <Field label="Ожидание">
              <select
                value={values.waitStatus}
                onChange={(e) => patch({ waitStatus: e.target.value })}
                className={selectClass}
              >
                <option value="all">Все статусы</option>
                {waitOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {showStage && (
            <Field label="Этап">
              <select
                value={values.stage}
                onChange={(e) => patch({ stage: e.target.value as ClientStage | 'all' })}
                className={selectClass}
              >
                <option value="all">Все этапы</option>
                {stages.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-gray-100 bg-surface px-4 py-3 sm:px-5">
          <Button type="button" variant="ghost" onClick={onReset}>
            Сбросить
          </Button>
          <Button type="button" className="flex-1" onClick={onClose}>
            Показать
          </Button>
        </div>
      </div>
    </div>
  )
}
