import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarOff, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { updateDocument } from '@/firebase/firestore'
import { adminSetUserCredentials } from '@/firebase/callable'
import { useTaskTemplates } from '@/hooks/useTaskTemplates'
import {
  CONFIGURABLE_SECTIONS,
  SECTION_LABELS,
  defaultConfigurableSections,
  type AppSection,
} from '@/constants/access'
import { POSITION_LABELS } from '@/constants/positions'
import { TASK_PRIORITIES } from '@/constants/taskMeta'
import { isRecurringTasksPaused, RECURRENCE_LABELS } from '@/utils/taskTemplates'
import { formatISODateShort, todayISO } from '@/utils/dates'
import type { User } from '@/types/user.types'
import type { TaskRecurrence, TaskTemplate } from '@/types/taskTemplate.types'
import type { TaskPriority } from '@/types/task.types'

interface EmployeeConstructorProps {
  member: User
  onClose: () => void
}

const WEEKDAYS = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Вс' },
]

type Draft = {
  title: string
  description: string
  priority: TaskPriority
  recurrence: TaskRecurrence
  interval: number
  dueOffsetDays: number
  weekday: number
  dayOfMonth: number
}

const emptyDraft = (): Draft => ({
  title: '',
  description: '',
  priority: 'normal',
  recurrence: 'daily',
  interval: 1,
  dueOffsetDays: 0,
  weekday: 1,
  dayOfMonth: 1,
})

function draftFromTemplate(t: TaskTemplate): Draft {
  return {
    title: t.title,
    description: t.description || '',
    priority: t.priority || 'normal',
    recurrence: t.recurrence,
    interval: t.interval || 1,
    dueOffsetDays: t.dueOffsetDays || 0,
    weekday: t.weekday ?? 1,
    dayOfMonth: t.dayOfMonth ?? 1,
  }
}

function scheduleHint(t: TaskTemplate | Draft) {
  const parts = [RECURRENCE_LABELS[t.recurrence]]
  if (t.recurrence === 'every_n_days' || t.recurrence === 'every_n_months') {
    parts.push(`каждые ${t.interval}`)
  }
  if (t.recurrence === 'weekly') {
    const d = WEEKDAYS.find((w) => w.value === (t.weekday ?? 1))
    if (d) parts.push(d.label)
  }
  if (t.recurrence === 'monthly') {
    parts.push(`${t.dayOfMonth}-е число`)
  }
  parts.push(
    t.dueOffsetDays > 0 ? `срок +${t.dueOffsetDays} дн.` : 'срок в тот же день',
  )
  return parts.join(' · ')
}

export function EmployeeConstructor({ member, onClose }: EmployeeConstructorProps) {
  const defaults = useMemo(() => defaultConfigurableSections(member.position), [member.position])
  const [sections, setSections] = useState<AppSection[]>(
    Array.isArray(member.enabledSections) ? member.enabledSections : defaults,
  )
  const [useCustomMenu, setUseCustomMenu] = useState(Array.isArray(member.enabledSections))
  const [savingMenu, setSavingMenu] = useState(false)
  const [menuMsg, setMenuMsg] = useState('')

  const {
    templates,
    loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    syncEmployeeTasks,
    restartDailyTasks,
    dedupeTodayTasks,
    clearOpenGeneratedTasks,
  } = useTaskTemplates(member.id)

  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft)
  const [adding, setAdding] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [filter, setFilter] = useState<'all' | 'daily' | 'other'>('all')
  const [syncing, setSyncing] = useState(false)
  const [restarting, setRestarting] = useState(false)

  useEffect(() => {
    setSections(Array.isArray(member.enabledSections) ? member.enabledSections : defaults)
    setUseCustomMenu(Array.isArray(member.enabledSections))
    setEditingId(null)
    setOkMsg('')
    setError('')
  }, [member, defaults])

  const sorted = useMemo(() => {
    const list = [...templates]
    list.sort((a, b) => {
      const aDaily = a.recurrence === 'daily' ? 0 : 1
      const bDaily = b.recurrence === 'daily' ? 0 : 1
      if (aDaily !== bDaily) return aDaily - bDaily
      if (a.active !== b.active) return a.active ? -1 : 1
      return a.title.localeCompare(b.title, 'ru')
    })
    return list
  }, [templates])

  const visible = useMemo(() => {
    if (filter === 'daily') return sorted.filter((t) => t.recurrence === 'daily')
    if (filter === 'other') return sorted.filter((t) => t.recurrence !== 'daily')
    return sorted
  }, [sorted, filter])

  const dailyCount = templates.filter((t) => t.recurrence === 'daily').length

  function toggleSection(section: AppSection) {
    setSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section],
    )
  }

  async function saveMenu() {
    setSavingMenu(true)
    setMenuMsg('')
    try {
      await updateDocument('users', member.id, {
        enabledSections: useCustomMenu ? sections : null,
      })
      setMenuMsg(useCustomMenu ? 'Меню сохранено' : 'Меню по должности (дефолт)')
    } catch (err) {
      console.error(err)
      setMenuMsg('Не удалось сохранить меню')
    } finally {
      setSavingMenu(false)
    }
  }

  async function handleAddTemplate(e: FormEvent) {
    e.preventDefault()
    if (!draft.title.trim()) {
      setError('Введите название шаблона')
      return
    }
    setAdding(true)
    setError('')
    setOkMsg('')
    try {
      await createTemplate({
        userId: member.id,
        userName: member.name,
        title: draft.title.trim(),
        description: draft.description,
        priority: draft.priority,
        recurrence: draft.recurrence,
        interval:
          draft.recurrence === 'every_n_days' || draft.recurrence === 'every_n_months'
            ? draft.interval
            : 1,
        dueOffsetDays: draft.dueOffsetDays,
        weekday: draft.recurrence === 'weekly' ? draft.weekday : null,
        dayOfMonth: draft.recurrence === 'monthly' ? draft.dayOfMonth : null,
      })
      setDraft(emptyDraft())
      setOkMsg('Шаблон сохранён — он в списке выше. Можно изменить или удалить в любой момент.')
      setFilter(draft.recurrence === 'daily' ? 'daily' : 'all')
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error
          ? `Не удалось добавить: ${err.message}`
          : 'Не удалось добавить шаблон',
      )
    } finally {
      setAdding(false)
    }
  }

  function startEdit(t: TaskTemplate) {
    setEditingId(t.id)
    setEditDraft(draftFromTemplate(t))
    setError('')
    setOkMsg('')
  }

  async function saveEdit() {
    if (!editingId) return
    if (!editDraft.title.trim()) {
      setError('Введите название')
      return
    }
    setSavingEdit(true)
    setError('')
    try {
      await updateTemplate(editingId, {
        title: editDraft.title.trim(),
        description: editDraft.description.trim(),
        priority: editDraft.priority,
        recurrence: editDraft.recurrence,
        interval:
          editDraft.recurrence === 'every_n_days' || editDraft.recurrence === 'every_n_months'
            ? editDraft.interval
            : 1,
        dueOffsetDays: editDraft.dueOffsetDays,
        weekday: editDraft.recurrence === 'weekly' ? editDraft.weekday : null,
        dayOfMonth: editDraft.recurrence === 'monthly' ? editDraft.dayOfMonth : null,
      })
      setEditingId(null)
      setOkMsg('Шаблон обновлён')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Не удалось сохранить изменения')
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} role="presentation" />
      <div className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-surface px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-lg font-bold text-text">Настройки · {member.name}</h2>
            <p className="text-xs text-muted">
              {POSITION_LABELS[member.position]} · логин/пароль, меню и постоянные задачи
            </p>
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

        <div className="space-y-6 p-4 sm:p-5">
          <CredentialsSection member={member} />

          <PauseTasksSection
            member={member}
            onClearedOpenTasks={clearOpenGeneratedTasks}
            onMessage={(ok, err) => {
              setOkMsg(ok)
              setError(err)
            }}
          />

          {/* Permanent templates — first, always visible */}
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-text">
                Постоянные задачи · {templates.length}
              </h3>
              <p className="mt-1 text-xs text-muted">
                Ежедневные и по расписанию остаются здесь навсегда. Их можно менять, выключать
                или удалять. Каждый день CRM сама создаёт задачу сотруднику из активного
                шаблона. Удаление/выключение сразу убирает открытые задачи по этому шаблону.
              </p>
              {isRecurringTasksPaused(member) && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Сейчас пауза до {formatISODateShort(member.recurringTasksPausedUntil || '')} —
                  новые ежедневные задачи не создаются.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['all', `Все (${templates.length})`],
                  ['daily', `Ежедневные (${dailyCount})`],
                  ['other', `Другие (${templates.length - dailyCount})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    filter === key
                      ? 'bg-primary text-white'
                      : 'bg-background text-muted hover:text-text'
                  }`}
                >
                  {label}
                </button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={syncing || loading}
                onClick={() => {
                  setSyncing(true)
                  setError('')
                  void syncEmployeeTasks(member.id)
                    .then((n) => {
                      setOkMsg(
                        n > 0
                          ? `Убрано лишних задач у сотрудника: ${n}`
                          : 'Лишних задач нет — всё совпадает с шаблонами',
                      )
                    })
                    .catch((err) => {
                      console.error(err)
                      setError(
                        err instanceof Error
                          ? err.message
                          : 'Не удалось очистить лишние задачи',
                      )
                    })
                    .finally(() => setSyncing(false))
                }}
              >
                {syncing ? 'Очистка...' : 'Убрать лишние задачи'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={restarting || loading}
                onClick={() => {
                  if (
                    !confirm(
                      `Перезапустить ежедневные задачи на сегодня для ${member.name}?\n\nДубликаты и старые копии за сегодня будут удалены, затем созданы заново по активным шаблонам.`,
                    )
                  ) {
                    return
                  }
                  setRestarting(true)
                  setError('')
                  void (async () => {
                    const deduped = await dedupeTodayTasks(member.id)
                    const { removed, created } = await restartDailyTasks(member.id)
                    setOkMsg(
                      `Перезапуск: убрано ${removed + deduped}, создано заново ${created}`,
                    )
                  })()
                    .catch((err) => {
                      console.error(err)
                      setError(
                        err instanceof Error ? err.message : 'Не удалось перезапустить',
                      )
                    })
                    .finally(() => setRestarting(false))
                }}
              >
                {restarting ? 'Перезапуск...' : 'Перезапустить на сегодня'}
              </Button>
            </div>

            {okMsg && (
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {okMsg}
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>
            )}

            {loading ? (
              <p className="text-sm text-muted">Загрузка шаблонов...</p>
            ) : visible.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-background px-4 py-6 text-center">
                <p className="text-sm font-medium text-text">Пока нет шаблонов</p>
                <p className="mt-1 text-xs text-muted">
                  Добавьте ниже, например «Ежедневный обзвон» — шаблон сохранится в этом
                  списке.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {visible.map((t) => (
                  <li
                    key={t.id}
                    className={`rounded-xl border px-3 py-2.5 ${
                      t.active
                        ? 'border-gray-100 bg-background'
                        : 'border-dashed border-gray-200 bg-surface opacity-80'
                    }`}
                  >
                    {editingId === t.id ? (
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-secondary">Редактирование</p>
                        <TemplateFields draft={editDraft} onChange={setEditDraft} />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={savingEdit}
                            onClick={() => void saveEdit()}
                          >
                            {savingEdit ? 'Сохраняем...' : 'Сохранить изменения'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-text">{t.title}</p>
                            {t.recurrence === 'daily' && (
                              <Badge variant="info">Ежедневно</Badge>
                            )}
                            {!t.active && <Badge variant="default">Выкл</Badge>}
                          </div>
                          <p className="mt-0.5 text-xs text-muted">{scheduleHint(t)}</p>
                          {t.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted">{t.description}</p>
                          )}
                          {t.lastGeneratedDate && (
                            <p className="mt-1 text-[11px] text-muted">
                              Последний раз создана: {t.lastGeneratedDate}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => startEdit(t)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-secondary hover:bg-surface"
                            title="Изменить"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Изменить
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const turningOff = t.active
                              void updateTemplate(t.id, { active: !t.active })
                                .then(() =>
                                  setOkMsg(
                                    turningOff
                                      ? 'Шаблон выключен, открытые задачи по нему убраны'
                                      : 'Шаблон включён',
                                  ),
                                )
                                .catch((err) => {
                                  console.error(err)
                                  setError('Не удалось изменить шаблон')
                                })
                            }}
                            className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface hover:text-text"
                          >
                            {t.active ? 'Выкл' : 'Вкл'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                confirm(
                                  `Удалить постоянную задачу «${t.title}»?\n\nШаблон удалится, и открытые задачи сотрудника по нему тоже будут убраны.`,
                                )
                              ) {
                                void deleteTemplate(t.id)
                                  .then(() =>
                                    setOkMsg('Шаблон удалён, открытые задачи убраны'),
                                  )
                                  .catch((err) => {
                                    console.error(err)
                                    setError('Не удалось удалить шаблон')
                                  })
                              }
                            }}
                            className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-danger"
                            aria-label="Удалить"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <form
              onSubmit={handleAddTemplate}
              className="space-y-3 rounded-xl border border-secondary/30 bg-secondary/5 p-3"
            >
              <p className="text-xs font-semibold text-text">Добавить постоянную задачу</p>
              <TemplateFields draft={draft} onChange={setDraft} />
              <Button type="submit" disabled={adding} fullWidth>
                <Plus className="h-4 w-4" />
                {adding ? 'Сохраняем...' : 'Сохранить в список'}
              </Button>
            </form>
          </section>

          <section className="space-y-3 border-t border-gray-100 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-text">Разделы в меню</h3>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={useCustomMenu}
                  onChange={(e) => setUseCustomMenu(e.target.checked)}
                />
                Свой набор (иначе по должности)
              </label>
            </div>
            <p className="text-xs text-muted">
              {useCustomMenu
                ? 'Только отмеченные разделы будут в меню. Остальное скрыто.'
                : 'Сейчас меню по должности. Включите «Свой набор», чтобы выдать доступ точечно.'}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CONFIGURABLE_SECTIONS.map((section) => {
                const active = sections.includes(section)
                return (
                  <button
                    key={section}
                    type="button"
                    disabled={!useCustomMenu}
                    onClick={() => toggleSection(section)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm disabled:opacity-50 ${
                      active
                        ? 'border-secondary bg-secondary/10'
                        : 'border-gray-200 bg-background'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                        active
                          ? 'border-secondary bg-secondary text-white'
                          : 'border-gray-300'
                      }`}
                    >
                      {active && <Check className="h-3.5 w-3.5" />}
                    </span>
                    {SECTION_LABELS[section]}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={() => void saveMenu()} disabled={savingMenu}>
                {savingMenu ? 'Сохраняем...' : 'Сохранить меню'}
              </Button>
              {menuMsg && <span className="text-xs text-muted">{menuMsg}</span>}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function PauseTasksSection({
  member,
  onClearedOpenTasks,
  onMessage,
}: {
  member: User
  onClearedOpenTasks: (employeeId: string) => Promise<number>
  onMessage: (ok: string, err: string) => void
}) {
  const [from, setFrom] = useState(member.recurringTasksPausedFrom || todayISO())
  const [until, setUntil] = useState(member.recurringTasksPausedUntil || '')
  const [savedFrom, setSavedFrom] = useState(member.recurringTasksPausedFrom || null)
  const [savedUntil, setSavedUntil] = useState(member.recurringTasksPausedUntil || null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setFrom(member.recurringTasksPausedFrom || todayISO())
    setUntil(member.recurringTasksPausedUntil || '')
    setSavedFrom(member.recurringTasksPausedFrom || null)
    setSavedUntil(member.recurringTasksPausedUntil || null)
  }, [member.id, member.recurringTasksPausedFrom, member.recurringTasksPausedUntil])

  const pauseFields = {
    recurringTasksPausedFrom: savedFrom,
    recurringTasksPausedUntil: savedUntil,
  }
  const pausedNow = isRecurringTasksPaused(pauseFields)
  const hasSavedRange = Boolean(savedUntil)

  async function savePause() {
    if (!until) {
      onMessage('', 'Укажите дату окончания паузы')
      return
    }
    const start = from || todayISO()
    const end = until
    if (start > end) {
      onMessage('', 'Дата начала не может быть позже окончания')
      return
    }
    setBusy(true)
    onMessage('', '')
    try {
      await updateDocument('users', member.id, {
        recurringTasksPausedFrom: start,
        recurringTasksPausedUntil: end,
      })
      setSavedFrom(start)
      setSavedUntil(end)
      const today = todayISO()
      let removed = 0
      if (today >= start && today <= end) {
        removed = await onClearedOpenTasks(member.id)
      }
      onMessage(
        removed > 0
          ? `Пауза сохранена: с ${formatISODateShort(start)} по ${formatISODateShort(end)}. Убрано открытых задач по шаблонам: ${removed}`
          : `Пауза сохранена: с ${formatISODateShort(start)} по ${formatISODateShort(end)}. В эти дни ежедневные задачи не создаются.`,
        '',
      )
    } catch (err) {
      console.error(err)
      onMessage('', err instanceof Error ? err.message : 'Не удалось сохранить паузу')
    } finally {
      setBusy(false)
    }
  }

  async function clearPause() {
    setBusy(true)
    onMessage('', '')
    try {
      await updateDocument('users', member.id, {
        recurringTasksPausedFrom: null,
        recurringTasksPausedUntil: null,
      })
      setSavedFrom(null)
      setSavedUntil(null)
      setFrom(todayISO())
      setUntil('')
      onMessage('Пауза снята — ежедневные задачи снова будут создаваться', '')
    } catch (err) {
      console.error(err)
      onMessage('', err instanceof Error ? err.message : 'Не удалось снять паузу')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className={`space-y-3 rounded-xl border p-3 ${
        pausedNow
          ? 'border-amber-200 bg-amber-50'
          : 'border-gray-200 bg-background'
      }`}
    >
      <div className="flex items-start gap-2">
        <CalendarOff className={`mt-0.5 h-4 w-4 shrink-0 ${pausedNow ? 'text-amber-700' : 'text-muted'}`} />
        <div>
          <h3 className="text-sm font-semibold text-text">Пауза ежедневных задач</h3>
          <p className="mt-1 text-xs text-muted">
            Отпуск, больничный и т.п. В выбранные дни CRM не создаёт сотруднику ежедневные,
            по расписанию и ИИ-задачи по лидам. Если пауза включает сегодня — открытые задачи
            по шаблонам и ИИ сразу уберутся.
          </p>
        </div>
      </div>

      {hasSavedRange && (
        <p className={`text-sm ${pausedNow ? 'font-medium text-amber-900' : 'text-muted'}`}>
          {pausedNow ? 'Сейчас пауза: ' : 'Запланирована пауза: '}
          {formatISODateShort(savedFrom || savedUntil || '')}
          {' — '}
          {formatISODateShort(savedUntil || '')}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="С"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input
          label="По"
          type="date"
          value={until}
          onChange={(e) => setUntil(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void savePause()}>
          {busy ? 'Сохранение...' : hasSavedRange ? 'Обновить паузу' : 'Включить паузу'}
        </Button>
        {hasSavedRange && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void clearPause()}
          >
            Снять паузу
          </Button>
        )}
      </div>
    </section>
  )
}

function TemplateFields({
  draft,
  onChange,
}: {
  draft: Draft
  onChange: (next: Draft) => void
}) {
  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    onChange({ ...draft, [key]: value })
  }

  return (
    <div className="space-y-3">
      <Input
        label="Название"
        value={draft.title}
        onChange={(e) => set('title', e.target.value)}
        placeholder="Например: Ежедневный обзвон"
        required
      />
      <Textarea
        label="Описание"
        value={draft.description}
        onChange={(e) => set('description', e.target.value)}
        placeholder="Необязательно"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Расписание</label>
          <select
            value={draft.recurrence}
            onChange={(e) => set('recurrence', e.target.value as TaskRecurrence)}
            className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-secondary"
          >
            {(Object.keys(RECURRENCE_LABELS) as TaskRecurrence[]).map((key) => (
              <option key={key} value={key}>
                {RECURRENCE_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Срок (дней от даты)"
          type="number"
          min={0}
          value={String(draft.dueOffsetDays)}
          onChange={(e) => set('dueOffsetDays', Number(e.target.value) || 0)}
        />
      </div>

      {(draft.recurrence === 'every_n_days' || draft.recurrence === 'every_n_months') && (
        <Input
          label={draft.recurrence === 'every_n_days' ? 'Каждые N дней' : 'Каждые N месяцев'}
          type="number"
          min={1}
          value={String(draft.interval)}
          onChange={(e) => set('interval', Math.max(1, Number(e.target.value) || 1))}
        />
      )}

      {draft.recurrence === 'weekly' && (
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => set('weekday', d.value)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                draft.weekday === d.value
                  ? 'bg-secondary text-white'
                  : 'bg-background text-muted'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {draft.recurrence === 'monthly' && (
        <Input
          label="День месяца"
          type="number"
          min={1}
          max={28}
          value={String(draft.dayOfMonth)}
          onChange={(e) =>
            set('dayOfMonth', Math.min(28, Math.max(1, Number(e.target.value) || 1)))
          }
        />
      )}

      <div className="flex flex-wrap gap-2">
        {(Object.keys(TASK_PRIORITIES) as TaskPriority[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => set('priority', key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              draft.priority === key ? 'bg-primary text-white' : 'bg-background text-muted'
            }`}
          >
            {TASK_PRIORITIES[key]}
          </button>
        ))}
      </div>
    </div>
  )
}

function CredentialsSection({ member }: { member: User }) {
  const noLogin = member.hasLogin === false
  const [email, setEmail] = useState(member.email || '')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    setEmail(member.email || '')
    setPassword('')
    setPassword2('')
    setMsg('')
    setErr('')
  }, [member.id, member.email, member.hasLogin])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setErr('')
    setMsg('')

    const nextEmail = email.trim().toLowerCase()
    const emailChanged = nextEmail !== (member.email || '').toLowerCase()
    const passwordSet = password.length > 0

    if (noLogin) {
      if (!nextEmail) {
        setErr('Укажите email (логин)')
        return
      }
      if (password.length < 6) {
        setErr('Пароль минимум 6 символов')
        return
      }
      if (password !== password2) {
        setErr('Пароли не совпадают')
        return
      }
    } else {
      if (!emailChanged && !passwordSet) {
        setErr('Измените email или введите новый пароль')
        return
      }
      if (passwordSet) {
        if (password.length < 6) {
          setErr('Пароль минимум 6 символов')
          return
        }
        if (password !== password2) {
          setErr('Пароли не совпадают')
          return
        }
      }
    }

    setBusy(true)
    try {
      const result = await adminSetUserCredentials({
        userId: member.id,
        email: noLogin || emailChanged ? nextEmail : undefined,
        password: noLogin || passwordSet ? password : undefined,
      })
      setPassword('')
      setPassword2('')
      if (result.loginCreated || noLogin) {
        setMsg('Вход включён. Сотрудник может войти с этим email и паролем.')
      } else {
        const parts: string[] = []
        if (emailChanged) parts.push('логин (email)')
        if (passwordSet) parts.push('пароль')
        setMsg(`Обновлено: ${parts.join(' и ')}. Сотрудник входит с новыми данными.`)
      }
    } catch (error: unknown) {
      console.error(error)
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: string }).code)
          : ''
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: string }).message)
          : ''
      if (code === 'NO_SERVICE_ACCOUNT' || message.includes('SERVICE_ACCOUNT')) {
        setErr(
          'Нужен ключ Firebase Admin: Console → Project settings → Service accounts → Generate new private key. Вставьте JSON в Vercel → Environment Variable FIREBASE_SERVICE_ACCOUNT_JSON и сделайте Redeploy.',
        )
      } else if (code.includes('already-exists') || message.includes('занят')) {
        setErr('Такой email уже занят')
      } else {
        setErr(message.replace(/^Firebase:\s*/i, '') || 'Не удалось сохранить логин/пароль')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-secondary/25 bg-secondary/5 p-3">
      <div>
        <h3 className="text-sm font-semibold text-text">
          {noLogin ? 'Включить вход' : 'Логин и пароль'}
        </h3>
        <p className="mt-1 text-xs text-muted">
          {noLogin
            ? 'Сейчас человек в команде без входа. Задайте email и пароль — сможет войти в CRM.'
            : 'Email — логин для входа. Можно поменять только email, только пароль или оба сразу.'}
        </p>
      </div>
      <form onSubmit={(e) => void handleSave(e)} className="space-y-3">
        <Input
          label="Email (логин)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
          required
        />
        <Input
          label={noLogin ? 'Пароль' : 'Новый пароль'}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={noLogin ? 'Минимум 6 символов' : 'Оставьте пустым, если не меняете'}
          autoComplete="new-password"
          required={noLogin}
        />
        <Input
          label="Повтор пароля"
          type="password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          placeholder="Повторите пароль"
          autoComplete="new-password"
          required={noLogin}
        />
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{err}</p>}
        {msg && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>
        )}
        <Button type="submit" size="sm" disabled={busy}>
          {busy
            ? 'Сохранение...'
            : noLogin
              ? 'Включить вход'
              : 'Сохранить логин / пароль'}
        </Button>
      </form>
    </section>
  )
}
