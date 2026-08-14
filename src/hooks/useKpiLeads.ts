import { useEffect, useMemo, useState } from 'react'
import { where } from 'firebase/firestore'
import { subscribeToCollection } from '@/firebase/firestore'
import type { KpiLeadCounts, KpiLeadLog, LeadCategory } from '@/types/kpiLead.types'
import { getCurrentMonth } from '@/utils/dates'

function leadCategories(lead: KpiLeadLog): LeadCategory[] {
  if (lead.categories?.length) return lead.categories
  return lead.category ? [lead.category] : []
}

/**
 * Real-time KPI lead counts for a manager (or all) for a given month.
 * Europe / fabric / finished: one lead can contribute to fabric+finished if both products.
 * total = unique leads (documents).
 */
export function useKpiLeads(userId: string, month: string = getCurrentMonth()) {
  const [leads, setLeads] = useState<KpiLeadLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLeads([])
      setLoading(false)
      return
    }

    setLoading(true)
    const constraints =
      userId === 'all'
        ? [where('month', '==', month)]
        : [where('assignedTo', '==', userId), where('month', '==', month)]

    const unsubscribe = subscribeToCollection<KpiLeadLog>(
      'kpi_lead_log',
      constraints,
      (data) => {
        setLeads(data)
        setLoading(false)
      },
      () => setLoading(false),
    )

    return unsubscribe
  }, [userId, month])

  const counts: KpiLeadCounts = useMemo(() => {
    let fabric = 0
    let finished = 0
    let europe = 0
    for (const lead of leads) {
      const cats = leadCategories(lead)
      if (cats.includes('fabric')) fabric += 1
      if (cats.includes('finished')) finished += 1
      if (cats.includes('europe')) europe += 1
    }
    return { fabric, finished, europe, total: leads.length }
  }, [leads])

  return { counts, leads, loading }
}
