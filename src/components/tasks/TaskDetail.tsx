import { useEffect, useState } from 'react'
import { ExternalLink, Link2, Paperclip, Plus, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/hooks/useAuth'
import { useTaskComments } from '@/hooks/useTaskComments'
import type { Task, TaskLink, TaskPriority } from '@/types/task.types'
import { TASK_STATUSES, type TaskStatus } from '@/constants/taskStatuses'
import { PRIORITY_BADGE, STATUS_BADGE, TASK_PRIORITIES } from '@/constants/taskMeta'

interface TaskDetailProps {
  task: Task | null
  canDelete?: boolean
  onClose: () => void
  onSave: (
    taskId: string,
    data: {
      title: string
      description: string
      priority: TaskPriority
      startDate: string | null
      dueDate: string | null
      status: TaskStatus
      links: TaskLink[]
    },
  ) => Promise<void>
  onDelete: (taskId: string) => Promise<void>
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

function formatCommentTime(value: unknown) {
  const seconds = (value as { seconds?: number } | null)?.seconds
  if (!seconds) return ''
  return new Date(seconds * 1000).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function TaskDetail({ task, canDelete, onClose, onSave, onDelete }: TaskDetailProps) {
  const { user, isAdmin } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [links, setLinks] = useState<TaskLink[]>([])
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const { comments, loading: commentsLoading, addComment } = useTaskComments(task?.id || null)

  const canConfirm =
    !!task &&
    (user?.id === task.createdBy || isAdmin || user?.position === 'head')

  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setDescription(task.description || '')
    setPriority(task.priority)
    setStartDate(task.startDate || '')
    setDueDate(task.dueDate || '')
    setStatus(task.status)
    setLinks(task.links || [])
    setLinkLabel('')
    setLinkUrl('')
    setCommentText('')
  }, [task])

  if (!task) return null

  function addLink() {
    const url = normalizeUrl(linkUrl)
    if (!url) return
    try {
      new URL(url)
    } catch {
      alert('Введите правильную ссылку')
      return
    }
    setLinks((prev) => [
      ...prev,
      { label: linkLabel.trim() || `Ссылка ${prev.length + 1}`, url },
    ])
    setLinkLabel('')
    setLinkUrl('')
  }

  async function handleSave() {
    if ((status === 'done' || status === 'awaiting_confirm') && comments.length === 0) {
      alert('Сначала добавьте комментарий с результатом — без него задачу нельзя завершить')
      return
    }
    setSaving(true)
    try {
      await onSave(task!.id, {
        title: title.trim(),
        description: description.trim(),
        priority,
        startDate: startDate || null,
        dueDate: dueDate || null,
        status,
        links,
      })
      onClose()
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirm() {
    setSaving(true)
    try {
      await onSave(task!.id, {
        title: title.trim(),
        description: description.trim(),
        priority,
        startDate: startDate || null,
        dueDate: dueDate || null,
        status: 'done',
        links,
      })
      onClose()
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Не удалось подтвердить')
    } finally {
      setSaving(false)
    }
  }

  async function handleReturn() {
    setSaving(true)
    try {
      await onSave(task!.id, {
        title: title.trim(),
        description: description.trim(),
        priority,
        startDate: startDate || null,
        dueDate: dueDate || null,
        status: 'in_progress',
        links,
      })
      onClose()
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Не удалось вернуть')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!task) return
    if (!confirm('Удалить задачу?')) return
    await onDelete(task.id)
    onClose()
  }

  async function handleAddComment() {
    if (!commentText.trim()) return
    setSendingComment(true)
    try {
      await addComment(commentText)
      setCommentText('')
    } catch (err) {
      console.error(err)
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Не удалось добавить комментарий'
      alert(msg.includes('permission') || msg.includes('Permission')
        ? 'Нет прав на комментарий. Обновите страницу и попробуйте снова.'
        : 'Не удалось добавить комментарий')
    } finally {
      setSendingComment(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="presentation"
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-text">Задача</h2>
            <p className="mt-1 text-xs text-muted">
              Кому: <span className="font-medium text-text">{task.assignedToName}</span>
              {' · '}
              поставил {task.createdByName}
              {task.sourceTemplateId ? ' · по шаблону' : ''}
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

        <div className="space-y-4">
          <Input label="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            label="Описание"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Подробности..."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">Статус</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
              >
                {(Object.keys(TASK_STATUSES) as TaskStatus[])
                  .filter((key) => key !== 'awaiting_confirm' || status === 'awaiting_confirm')
                  .map((key) => (
                  <option key={key} value={key}>
                    {TASK_STATUSES[key]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">Приоритет</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
              >
                {(Object.keys(TASK_PRIORITIES) as TaskPriority[]).map((key) => (
                  <option key={key} value={key}>
                    {TASK_PRIORITIES[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Дата начала"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="Дата завершения"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={STATUS_BADGE[status]}>{TASK_STATUSES[status]}</Badge>
            <Badge variant={PRIORITY_BADGE[priority]}>{TASK_PRIORITIES[priority]}</Badge>
            {task.sourceTemplateId && <Badge variant="info">По шаблону</Badge>}
          </div>

          {(task.attachments?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-text">Файлы</p>
              <ul className="space-y-1.5">
                {task.attachments.map((file) => (
                  <li key={file.path || file.url}>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm text-secondary hover:underline"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <span className="shrink-0 text-xs text-muted">{formatSize(file.size)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-text">Комментарии / результат</p>
            <p className="text-xs text-muted">
              Обязательно перед «Готово»: без комментария задачу нельзя завершить. Результат
              попадёт в месячный отчёт.
            </p>
            {task.status === 'awaiting_confirm' && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {canConfirm
                  ? 'Сотрудник отметил готово. Проверьте комментарий и подтвердите.'
                  : 'Отправлено на проверку тому, кто поставил задачу.'}
              </div>
            )}
            {commentsLoading ? (
              <p className="text-xs text-muted">Загрузка...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-muted">Пока нет комментариев</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-background px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-text">{c.authorName}</span>
                      <span className="text-[10px] text-muted">{formatCommentTime(c.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm text-text">{c.text}</p>
                  </li>
                ))}
              </ul>
            )}
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Написать комментарий / результат..."
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={sendingComment || !commentText.trim()}
              onClick={() => void handleAddComment()}
            >
              {sendingComment ? 'Отправка...' : 'Добавить комментарий'}
            </Button>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-text">Прикрепления (ссылки)</p>
            <p className="text-xs text-muted">
              Ссылка на фото или файл в Drive / Disk — для отчёта и удобства.
            </p>
            <div className="grid gap-2 sm:grid-cols-[0.8fr_1.5fr_auto]">
              <Input
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="Название"
              />
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!linkUrl.trim()}
                onClick={addLink}
              >
                <Plus className="h-3.5 w-3.5" />
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
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-secondary hover:underline"
                    >
                      <span className="font-medium text-text">{link.label}</span>
                      <span className="ml-2 text-xs text-muted">{link.url}</span>
                    </a>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted" />
                    <button
                      type="button"
                      className="rounded p-1 text-muted hover:bg-surface hover:text-danger"
                      onClick={() => setLinks((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Убрать ссылку"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {task.status === 'awaiting_confirm' && canConfirm ? (
              <>
                <Button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={saving || !title.trim() || comments.length === 0}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {saving ? '...' : 'Подтвердить выполнение'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleReturn()}
                  disabled={saving}
                >
                  Вернуть в работу
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !title.trim()}
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            {canDelete && (
              <Button
                type="button"
                variant="danger"
                onClick={() => void handleDelete()}
                className="sm:ml-auto"
              >
                Удалить
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
