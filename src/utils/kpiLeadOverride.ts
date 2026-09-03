import { overrideKpiLead } from '@/firebase/callable'
import type { Client } from '@/types/client.types'
import type { KpiLeadLog } from '@/types/kpiLead.types'

export async function adminCountKpiLead(opts: {
  client: Client
  month: string
  log?: KpiLeadLog | null
}): Promise<void> {
  await overrideKpiLead({
    action: 'include',
    clientId: opts.client.id,
    month: opts.month,
  })
}

export async function adminUncountKpiLead(opts: {
  client: Client
  month: string
  log?: KpiLeadLog | null
}): Promise<void> {
  await overrideKpiLead({
    action: 'exclude',
    clientId: opts.client.id,
    month: opts.month,
  })
}
