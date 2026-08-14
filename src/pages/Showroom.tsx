import { useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { useShowroom } from '@/hooks/useShowroom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { todayISO } from '@/utils/dates'
import {
  SCHEDULE_PRESETS,
  WEEKDAY_OPTIONS,
} from '@/types/showroom.types'

export function Showroom() {
  const {
    activeItems,
    items,
    date,
    setDate,
    loading,
    todayProgress,
    isWalkDay,
    canConfigure,
    settings,
    addItem,
    updateItem,
    deleteItem,
    toggleCheck,
    saveSchedule,
  } = useShowroom()

  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [draftDays, setDraftDays] = useState<number[] | null>(null)

  const weekdays = draftDays ?? settings.weekdays ?? []

  async function handleAdd() {
    if (!newTitle.trim()) return
    setBusy(true)
    try {
      await addItem(newTitle)
      setNewTitle('')
    } finally {
      setBusy(false)
    }
  }

  function toggleDay(day: number) {
    setDraftDays((prev) => {
      const base = prev ?? settings.weekdays ?? []
      return base.includes(day) ? base.filter((d) => d !== day) : [...base, day].sort((a, b) => a - b)
    })
  }

  async function handleSaveSchedule() {
    setBusy(true)
    try {
      await saveSchedule(weekdays)
      setDraftDays(null)
    } finally {
      setBusy(false)
    }
  }

  const isToday = date === todayISO()
  const pct =
    todayProgress.total > 0
      ? Math.round((todayProgress.doneCount / todayProgress.total) * 100)
      : 0

  const scheduleLabel = WEEKDAY_OPTIONS.filter((d) =>
    (settings.weekdays || []).includes(d.value),
  )
    .map((d) => d.short)
    .join(', ')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Шоурум · чек-лист</h1>
          <p className="mt-1 text-sm text-muted">
            Обход по расписанию
            {scheduleLabel ? `: ${scheduleLabel}` : ''}. После всех галочек — уведомление
            «обход подтверждён».
          </p>
        </div>
        {canConfigure && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setShowConfig((v) => !v)
              setDraftDays(null)
            }}
          >
            {showConfig ? 'К обходу' : 'Настроить'}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          label="Дата обхода"
        />
        <div className="rounded-xl bg-surface px-4 py-2 shadow-sm">
          <p className="text-[11px] font-medium uppercase text-muted">Готово</p>
          <p className="text-lg font-bold text-text">
            {todayProgress.doneCount}/{todayProgress.total}
            <span className="ml-2 text-sm font-medium text-secondary">{pct}%</span>
          </p>
        </div>
        {isWalkDay ? (
          <Badge variant="success">День обхода</Badge>
        ) : (
          <Badge variant="default">Не по расписанию</Badge>
        )}
        {todayProgress.complete && <Badge variant="info">Подтверждён</Badge>}
      </div>

      {showConfig && canConfigure ? (
        <div className="space-y-4">
          <Card className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-text">Расписание обхода</h2>
              <p className="mt-0.5 text-xs text-muted">
                Сколько раз в неделю — выберите пресет или дни вручную
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {SCHEDULE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setDraftDays([...preset.weekdays])}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                    JSON.stringify([...(draftDays ?? settings.weekdays)].sort()) ===
                    JSON.stringify([...preset.weekdays].sort())
                      ? 'border-secondary bg-secondary/10 text-secondary'
                      : 'border-gray-200 text-muted hover:border-gray-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((d) => {
                const on = weekdays.includes(d.value)
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      on
                        ? 'border-secondary bg-secondary/10 text-secondary'
                        : 'border-gray-200 text-muted'
                    }`}
                  >
                    {d.short}
                  </button>
                )
              })}
            </div>

            <p className="text-xs text-muted">
              Сейчас: {weekdays.length} раз(а) в неделю
            </p>

            <Button
              type="button"
              size="sm"
              disabled={busy || weekdays.length === 0}
              onClick={() => void handleSaveSchedule()}
            >
              Сохранить расписание
            </Button>
          </Card>

          <Card className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-text">Пункты чек-листа</h2>
              <p className="mt-0.5 text-xs text-muted">
                Эти пункты появляются в дни обхода
              </p>
            </div>

            <ul className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <li className="py-2 text-sm text-muted">Список пуст — добавьте пункты</li>
              ) : (
                items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <input
                        defaultValue={item.title}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          if (v && v !== item.title) void updateItem(item.id, { title: v })
                        }}
                        className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-text hover:border-gray-200 focus:border-secondary focus:outline-none"
                      />
                      <p className="text-xs text-muted">
                        {item.active !== false ? 'В обходе' : 'Выключен'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          void updateItem(item.id, { active: item.active === false })
                        }
                      >
                        {item.active !== false ? 'Выкл' : 'Вкл'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Удалить «${item.title}»?`)) void deleteItem(item.id)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))
              )}
            </ul>

            <div className="flex gap-2">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Новый пункт, например: Витрина чистая"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleAdd()
                  }
                }}
              />
              <Button
                type="button"
                disabled={busy || !newTitle.trim()}
                onClick={() => void handleAdd()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="space-y-3">
          <h2 className="text-base font-semibold text-text">
            Обход {isToday ? 'сегодня' : date}
          </h2>

          {!isWalkDay && (
            <div className="rounded-lg bg-background px-3 py-2 text-sm text-muted">
              На эту дату обход не запланирован. Можно всё равно отметить пункты при
              необходимости.
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted">Загрузка...</p>
          ) : activeItems.length === 0 ? (
            <p className="text-sm text-muted">
              Чек-лист ещё не настроен. Нажмите «Настроить».
            </p>
          ) : (
            <ul className="space-y-2">
              {todayProgress.rows.map(({ item, done, check }) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void toggleCheck(item, !done)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                      done
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-gray-100 bg-background hover:border-gray-200'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        done
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-gray-300 bg-surface'
                      }`}
                    >
                      {done && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-sm font-medium ${
                          done ? 'text-emerald-900 line-through' : 'text-text'
                        }`}
                      >
                        {item.title}
                      </span>
                      {done && check?.doneByName && (
                        <span className="mt-0.5 block text-xs text-muted">
                          {check.doneByName}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {todayProgress.complete && (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              Обход подтверждён — уведомление отправлено руководителю
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
