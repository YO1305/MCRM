import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { Client } from '@/types/client.types'
import type { KpiLeadLog } from '@/types/kpiLead.types'
import { adminCountKpiLead, adminUncountKpiLead } from '@/utils/kpiLeadOverride'

function isBusyError(err: unknown) {
  const e = err as Error & { code?: string }
  const text = `${e?.message || ''} ${e?.code || ''}`
  return /RESOURCE_EXHAUSTED|Quota|перегруж|занят|QUOTA|http\/429|http\/504|http\/502|http\/503|504|502|503/i.test(
    text,
  )
}

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
  const tries = 5

  async function run(kind: 'include' | 'exclude') {
    setBusy(true)
    setErr('')
    let last = ''
    for (let i = 0; i < tries; i += 1) {
      try {
        if (kind === 'exclude') await adminUncountKpiLead({ client, month, log })
        else await adminCountKpiLead({ client, month, log })
        onDone?.()
        setBusy(false)
        return
      } catch (e) {
        last = e instanceof Error ? e.message : 'Не удалось сохранить'
        if (!isBusyError(e) || i === tries - 1) break
        setErr(`База занята, попытка ${i + 2} из ${tries}…`)
        await new Promise((r) => setTimeout(r, 2500 * (i + 1)))
      }
    }
    setErr(
      isBusyError({ message: last, code: '' })
        ? kind === 'exclude'
          ? 'База перегружена. Подождите минуту и нажмите «Убрать из KPI» ещё раз.'
          : 'База перегружена. Подождите минуту и нажмите «Засчитать» ещё раз.'
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
          onClick={() => run('exclude')}
        >
          {busy ? 'Снимаю…' : 'Убрать из KPI'}
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => run('include')}
        >
          {busy ? 'Засчитываю…' : 'Засчитать'}
        </Button>
      )}
      {err ? <p className="max-w-[14rem] text-right text-xs text-rose-600">{err}</p> : null}
    </div>
  )
}
