import { Button } from '@/components/ui/Button'

export function KpiApprovalBar({
  approved,
  approvedByName,
  saving,
  disabled,
  onSave,
  onApprove,
  onUnapprove,
  saveLabel = 'Сохранить расчёт месяца',
}: {
  approved: boolean
  approvedByName?: string
  saving: boolean
  disabled?: boolean
  onSave: () => void
  onApprove: () => void
  onUnapprove: () => void
  saveLabel?: string
}) {
  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      {approved ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Утверждено{approvedByName ? ` · ${approvedByName}` : ''}. Цифра финальная после подписи
          директора. Чтобы править — «Вернуть в черновик».
        </p>
      ) : (
        <p className="text-xs text-muted">
          «Сохранить» — черновик. «Утверждено» — только после подписи директора, дальше цифра не
          меняется.
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {approved ? (
          <Button type="button" variant="ghost" disabled={saving || disabled} onClick={onUnapprove}>
            {saving ? '…' : 'Вернуть в черновик'}
          </Button>
        ) : (
          <>
            <Button type="button" variant="secondary" disabled={saving || disabled} onClick={onSave}>
              {saving ? 'Сохранение…' : saveLabel}
            </Button>
            <Button type="button" disabled={saving || disabled} onClick={onApprove}>
              {saving ? '…' : 'Утверждено'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
