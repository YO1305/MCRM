import { createDocument, removeDocument, updateDocument } from '@/firebase/firestore'
import { resolveKpiCategories } from '@/constants/leadProducts'
import type { Client } from '@/types/client.types'
import type { KpiLeadLog } from '@/types/kpiLead.types'
import { resolveActiveMonthsForMonth } from '@/utils/kpiLeadExplain'

export async function adminCountKpiLead(opts: {
  client: Client
  month: string
  log?: KpiLeadLog | null
}): Promise<void> {
  const { client, month, log } = opts
  if (!log) {
    const cats = resolveKpiCategories(client.country, client.products || [])
    await createDocument('kpi_lead_log', {
      clientId: client.id,
      clientName: client.name || '',
      assignedTo: client.assignedTo || '',
      assignedToName: client.assignedToName || '',
      category: cats[0] || 'fabric',
      categories: cats,
      country: client.country || null,
      month,
      significantMoments: Math.max(3, Number(client.kpiSignificantMoments) || 3),
      stage: client.stage || '',
      activeMonthsCount: resolveActiveMonthsForMonth(client, month),
      source: 'admin',
    })
  }
  await updateDocument('clients', client.id, {
    kpiQualified: true,
    kpiQualifiedMonth: month,
    kpiQualificationReason: 'Админ засчитал лид вручную',
    kpiManualIncluded: true,
    kpiManualMonth: month,
  })
}

export async function adminUncountKpiLead(opts: {
  client: Client
  month: string
  log?: KpiLeadLog | null
}): Promise<void> {
  const { client, month, log } = opts
  if (log?.id) await removeDocument('kpi_lead_log', log.id)
  await updateDocument('clients', client.id, {
    kpiQualified: false,
    kpiQualifiedMonth: month,
    kpiQualificationReason: 'Админ снял лид из KPI вручную',
    kpiManualIncluded: false,
    kpiManualMonth: month,
  })
}
