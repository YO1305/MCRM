import { X } from 'lucide-react'
import { QuickTaskForm } from '@/components/tasks/QuickTaskForm'
import type { User } from '@/types/user.types'
import type { TaskLink, TaskPriority } from '@/types/task.types'

interface CreateTaskModalProps {
  open: boolean
  users: User[]
  usersLoading?: boolean
  usersError?: string
  /** Employee creating a personal task — no team assignee picker */
  selfOnly?: boolean
  onClose: () => void
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

export function CreateTaskModal({
  open,
  users,
  usersLoading,
  usersError,
  selfOnly = false,
  onClose,
  onSubmit,
}: CreateTaskModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="presentation"
      />
      <div className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-surface px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-lg font-bold text-text">
              {selfOnly ? 'Добавить себе задачу' : 'Поставить задачу'}
            </h2>
            <p className="text-xs text-muted">
              {selfOnly
                ? 'Если сказали устно — зафиксируйте здесь название и срок'
                : 'Заполните → отметьте сотрудников → сохраните'}
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

        <div className="p-4 sm:p-5">
          <QuickTaskForm
            users={users}
            usersLoading={usersLoading}
            usersError={usersError}
            selfOnly={selfOnly}
            compact
            onSubmit={async (input, assignees) => {
              await onSubmit(input, assignees)
              onClose()
            }}
          />
        </div>
      </div>
    </div>
  )
}
