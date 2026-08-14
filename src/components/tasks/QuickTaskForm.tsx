import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Link2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useAuth } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'
import type { User } from '@/types/user.types'
import type { TaskLink, TaskPriority } from '@/types/task.types'
import { TASK_PRIORITIES } from '@/constants/taskMeta'
import { POSITION_LABELS } from '@/constants/positions'

interface QuickTaskFormProps {
  users: User[]
  usersLoading?: boolean
  usersError?: string
  /** Без внешней карточки и заголовка — для попапа */
  compact?: boolean
  /** Только себе — без выбора исполнителей */
  selfOnly?: boolean
  onSubmit: (
    input: {
      title: string
      description: string
      priority: TaskPriority
      startDate: string | null
      dueDate: string | null
      links: TaskLink[]
    },
    assignees: { id: string; name: string }[],
  ) => Promise<void>
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysISO(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function QuickTaskForm({
  users,
  usersLoading,
  usersError,
  compact = false,
  selfOnly = false,
  onSubmit,
}: QuickTaskFormProps) {
  const { user, isAdmin } = useAuth()
  const { canCreateTasks } = useRole()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [startDate, setStartDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState(addDaysISO(1))
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [links, setLinks] = useState<TaskLink[]>([])
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const assignableUsers = useMemo(() => {
    if (selfOnly && user) return users.filter((u) => u.id === user.id)
    return isAdmin || canCreateTasks ? users : users.filter((u) => u.id === user?.id)
  }, [selfOnly, isAdmin, canCreateTasks, users, user])

  useEffect(() => {
    if (!user) return
    if (selfOnly || (assignableUsers.length === 1 && assignableUsers[0]?.id === user.id)) {
      setSelectedIds([user.id])
    }
  }, [selfOnly, user, assignableUsers])

  function toggleUser(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function selectAll() {
    setSelectedIds(assignableUsers.map((u) => u.id))
  }

  function clearAssignees() {
    setSelectedIds([])
  }

  function addLink() {
    const url = normalizeUrl(linkUrl)
    if (!url) return
    try {
      new URL(url)
    } catch {
      setError('Введите правильную ссылку')
      return
    }
    setLinks((prev) => [
      ...prev,
      { label: linkLabel.trim() || `Ссылка ${prev.length + 1}`, url },
    ])
    setLinkLabel('')
    setLinkUrl('')
    setError('')
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Введите название задачи')
      return
    }
    const effectiveIds =
      selfOnly && user
        ? [user.id]
        : selectedIds.length
          ? selectedIds
          : []
    if (!effectiveIds.length) {
      setError(selfOnly ? 'Не удалось определить пользователя' : 'Отметьте, кому ставится задача')
      return
    }
    if (startDate && dueDate && dueDate < startDate) {
      setError('Дата завершения не может быть раньше даты начала')
      return
    }

    const assignees = (
      selfOnly && user
        ? [{ id: user.id, name: user.name }]
        : assignableUsers
            .filter((u) => effectiveIds.includes(u.id))
            .map((u) => ({ id: u.id, name: u.name }))
    )

    if (!assignees.length) {
      setError(selfOnly ? 'Не удалось определить пользователя' : 'Отметьте, кому ставится задача')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await onSubmit(
        {
          title: title.trim(),
          description,
          priority,
          startDate: startDate || null,
          dueDate: dueDate || null,
          links,
        },
        assignees,
      )
      setTitle('')
      setDescription('')
      setPriority('normal')
      setStartDate(todayISO())
      setDueDate(addDaysISO(1))
      setSelectedIds(selfOnly && user ? [user.id] : [])
      setLinks([])
      setLinkLabel('')
      setLinkUrl('')
    } catch (err) {
      console.error(err)
      setError('Не удалось создать задачу. Проверьте интернет.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        compact
          ? 'space-y-4'
          : 'space-y-4 rounded-xl border border-gray-100 bg-surface p-4 shadow-sm sm:p-5'
      }
    >
      {!compact && (
        <div>
          <h2 className="text-base font-semibold text-text">Новая задача</h2>
          <p className="mt-0.5 text-xs text-muted">
            Название → сроки подставляются сами → отметьте исполнителя → добавьте ссылки
          </p>
        </div>
      )}

      <Input
        label="Название задачи"
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Например: Подготовить отчёт по лидам"
        autoComplete="off"
        required
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Дата начала"
          type="date"
          name="startDate"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          label="Дата завершения (срок)"
          type="date"
          name="dueDate"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setStartDate(todayISO())
            setDueDate(todayISO())
          }}
          className="rounded-lg bg-background px-2.5 py-1 text-xs font-medium text-muted hover:text-text"
        >
          Сегодня
        </button>
        <button
          type="button"
          onClick={() => {
            setStartDate(todayISO())
            setDueDate(addDaysISO(1))
          }}
          className="rounded-lg bg-background px-2.5 py-1 text-xs font-medium text-muted hover:text-text"
        >
          До завтра
        </button>
        <button
          type="button"
          onClick={() => {
            setStartDate(todayISO())
            setDueDate(addDaysISO(7))
          }}
          className="rounded-lg bg-background px-2.5 py-1 text-xs font-medium text-muted hover:text-text"
        >
          На неделю
        </button>
      </div>

      {!selfOnly && (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-medium text-text">Кому поставлена задача</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs font-medium text-secondary hover:underline"
            >
              Всем
            </button>
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={clearAssignees}
                className="text-xs font-medium text-muted hover:underline"
              >
                Сбросить
              </button>
            )}
          </div>
        </div>

        {usersLoading && assignableUsers.length === 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-background px-3 py-3 text-sm text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
            Загружаем сотрудников...
          </div>
        )}

        {!usersLoading && assignableUsers.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">
            {usersError ||
              'Список сотрудников пуст. Добавьте профили сотрудников в разделе «Настройки».'}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {assignableUsers.map((u) => {
            const active = selectedIds.includes(u.id)
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggleUser(u.id)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  active
                    ? 'border-secondary bg-secondary/10'
                    : 'border-gray-200 bg-background hover:border-gray-300'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    active ? 'border-secondary bg-secondary text-white' : 'border-gray-300 bg-surface'
                  }`}
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-text">{u.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {POSITION_LABELS[u.position]}
                    {active ? ' · назначен' : ''}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {selectedIds.length > 0 && (
          <p className="text-xs text-secondary">
            Назначено: {selectedIds.length}{' '}
            {selectedIds.length === 1 ? 'сотрудник' : 'сотрудника(ов)'}
          </p>
        )}
      </div>
      )}

      {selfOnly && (
        <p className="rounded-lg bg-background px-3 py-2 text-xs text-muted">
          Задача будет назначена вам
          {user?.name ? ` · ${user.name}` : ''}
        </p>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-text">Приоритет</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TASK_PRIORITIES) as TaskPriority[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPriority(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                priority === key
                  ? key === 'high'
                    ? 'bg-danger text-white'
                    : key === 'low'
                      ? 'bg-gray-500 text-white'
                      : 'bg-secondary text-white'
                  : 'bg-background text-muted hover:text-text'
              }`}
            >
              {TASK_PRIORITIES[key]}
            </button>
          ))}
        </div>
      </div>

      <Textarea
        label="Описание (необязательно)"
        name="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Подробности, чеклист, комментарии..."
      />

      <div className="space-y-2">
        <label className="text-sm font-medium text-text">Ссылки на файлы</label>
        <p className="text-xs text-muted">
          Загрузите файл в Google Drive, Яндекс Диск или OneDrive и вставьте открытую ссылку.
        </p>
        <div className="grid gap-2 sm:grid-cols-[0.8fr_1.5fr_auto]">
          <Input
            name="linkLabel"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="Название: Отчёт Excel"
          />
          <Input
            name="linkUrl"
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
          />
          <Button
            type="button"
            variant="secondary"
            onClick={addLink}
            disabled={!linkUrl.trim()}
          >
            <Plus className="h-4 w-4" />
            Добавить
          </Button>
        </div>

        {links.length > 0 && (
          <ul className="space-y-1.5">
            {links.map((link, index) => (
              <li
                key={`${link.url}-${index}`}
                className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm"
              >
                <Link2 className="h-3.5 w-3.5 shrink-0 text-secondary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text">{link.label}</span>
                  <span className="block truncate text-xs text-muted">{link.url}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeLink(index)}
                  className="rounded p-1 text-muted hover:bg-surface hover:text-danger"
                  aria-label="Убрать ссылку"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">Можно добавить несколько ссылок. Хранение в CRM не расходуется.</p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" disabled={submitting} fullWidth size="lg">
        {submitting
          ? 'Создаём...'
          : selfOnly
            ? 'Добавить себе'
            : selectedIds.length > 1
              ? `Поставить задачу · ${selectedIds.length}`
              : 'Поставить задачу'}
      </Button>
    </form>
  )
}
