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
  onDone,
}: {
  client: Client
  month: string
  log?: KpiLeadLog | null
  counted: boolean
  onDone?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setErr('')
    let last = ''
    for (let i = 0; i < 4; i += 1) {
      try {
        await fn()
        onDone?.()
        setBusy(false)
        return
      } catch (e) {
        last = e instanceof Error ? e.message : 'Не удалось сохранить'
        if (!/RESOURCE_EXHAUSTED|Quota|перегруж/i.test(last) || i === 3) break
        setErr('База занята, пробую ещё раз…')
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)))
      }
    }
    setErr(
      /RESOURCE_EXHAUSTED|Quota|перегруж/i.test(last)
        ? 'База перегружена. Подождите минуту и нажмите «Засчитать» ещё раз.'
        : last,
    )
    setBusy(false)
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
