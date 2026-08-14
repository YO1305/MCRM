import { X } from 'lucide-react'
import { QuickClientForm } from './QuickClientForm'
import type { User } from '@/types/user.types'
import type { ClientInput } from '@/types/client.types'

interface CreateClientModalProps {
  open: boolean
  users: User[]
  usersLoading?: boolean
  onClose: () => void
  onSubmit: (input: ClientInput, assignee: { id: string; name: string }) => Promise<void>
}

export function CreateClientModal({
  open,
  users,
  usersLoading,
  onClose,
  onSubmit,
}: CreateClientModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} role="presentation" />
      <div className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-surface px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-lg font-bold text-text">Новый клиент</h2>
            <p className="text-xs text-muted">Заполните → назначьте менеджера → сохраните</p>
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
          <QuickClientForm
            users={users}
            usersLoading={usersLoading}
            compact
            onSubmit={async (input, assignee) => {
              await onSubmit(input, assignee)
              onClose()
            }}
          />
        </div>
      </div>
    </div>
  )
}
