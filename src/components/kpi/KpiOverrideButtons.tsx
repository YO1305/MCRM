import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { Client } from '@/types/client.types'
import type { KpiLeadLog } from '@/types/kpiLead.types'
import { adminCountKpiLead, adminUncountKpiLead } from '@/utils/kpiLeadOverride'

export function KpiOverrideButtons({
  client,
  month,
  log,
  counted,
}: {
  client: Client
  month: string
  log?: KpiLeadLog | null
  counted: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setErr('')
    try {
      await fn()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {counted ? (
        <Button
          type="button"
          size="sm"
          variant="danger"
          disabled={busy}
          onClick={() => run(() => adminUncountKpiLead({ client, month, log }))}
        >
          {busy ? '…' : 'Убрать из KPI'}
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => run(() => adminCountKpiLead({ client, month, log }))}
        >
          {busy ? '…' : 'Засчитать'}
        </Button>
      )}
      {err ? <p className="max-w-[14rem] text-right text-xs text-rose-600">{err}</p> : null}
    </div>
  )
}
