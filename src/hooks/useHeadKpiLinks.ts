import { useMemo } from 'react'
import { useUsers } from '@/hooks/useUsers'
import { useKpiLeads } from '@/hooks/useKpiLeads'
import { useKpiPayroll } from '@/hooks/useKpiPayroll'
import { useKpiDeptPayroll } from '@/hooks/useKpiDeptPayroll'
import { findPayrollManager } from '@/constants/kpiPayroll'
import { leadKpiRatios } from '@/constants/kpiDeptPayroll'
import type { CertificateFlags, TeamLeadPcts } from '@/types/kpiDeptPayroll.types'

export function useHeadKpiLinks(month: string) {
  const { users } = useUsers(true)
  const aygulUser = useMemo(() => findPayrollManager(users, 'aygul'), [users])
  const kunduzUser = useMemo(() => findPayrollManager(users, 'kunduz'), [users])

  const aygulPayroll = useKpiPayroll('aygul', month, true)
  const kunduzPayroll = useKpiPayroll('kunduz', month, true)
  const assistantPayroll = useKpiDeptPayroll('assistant', month)

  const aygulLeads = useKpiLeads(aygulUser?.id || '', month)
  const kunduzLeads = useKpiLeads(kunduzUser?.id || '', month)

  const aygulFacts = aygulPayroll.inputs.leadOverride ?? {
    fabric: aygulLeads.counts.fabric,
    finished: aygulLeads.counts.finished,
    europe: aygulLeads.counts.europe,
  }
  const kunduzFacts = kunduzPayroll.inputs.leadOverride ?? {
    fabric: kunduzLeads.counts.fabric,
    finished: kunduzLeads.counts.finished,
    europe: kunduzLeads.counts.europe,
  }

  const aygulPct = leadKpiRatios(aygulFacts)
  const kunduzPct = leadKpiRatios(kunduzFacts)

  const aygulSaved = Boolean(aygulPayroll.saved)
  const kunduzSaved = Boolean(kunduzPayroll.saved)
  const assistantSaved = assistantPayroll.exists

  const linkedLeads: Partial<TeamLeadPcts> = {}
  if (aygulSaved) {
    linkedLeads.aygulFabric = aygulPct.fabric
    linkedLeads.aygulGp = aygulPct.gp
    linkedLeads.aygulEurope = aygulPct.europe
  }
  if (kunduzSaved) {
    linkedLeads.kunduzFabric = kunduzPct.fabric
    linkedLeads.kunduzGp = kunduzPct.gp
    linkedLeads.kunduzEurope = kunduzPct.europe
  }

  return {
    loading: aygulPayroll.loading || kunduzPayroll.loading || assistantPayroll.loading,
    aygulSaved,
    kunduzSaved,
    assistantSaved,
    linkedLeads,
    linkedCerts: assistantPayroll.assistant.certificates as CertificateFlags,
  }
}
