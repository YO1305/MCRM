import { useCallback, useEffect, useMemo, useState } from 'react'
import { subscribeToDocument, setDocument } from '@/firebase/firestore'
import { defaultPayrollInputs, payrollDocId } from '@/constants/kpiPayroll'
import type { KpiPayrollDoc, KpiPayrollInputs, KpiPayrollRole } from '@/types/kpiPayroll.types'

export function useKpiPayroll(role: KpiPayrollRole, month: string, enabled: boolean) {
  const [saved, setSaved] = useState<KpiPayrollDoc | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled || !month) {
      setSaved(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const id = payrollDocId(role, month)
    return subscribeToDocument<KpiPayrollDoc>(
      'kpi_payroll',
      id,
      (data) => {
        setSaved(data)
        setLoading(false)
      },
      () => {
        setError('Не удалось загрузить расчёт KPI')
        setLoading(false)
      },
    )
  }, [role, month, enabled])

  const save = useCallback(
    async (inputs: KpiPayrollInputs, user: { id: string; name: string }) => {
      setSaving(true)
      setError('')
      try {
        const id = payrollDocId(role, month)
        await setDocument('kpi_payroll', id, {
          ...inputs,
          roleKey: role,
          month,
          savedBy: user.id,
          savedByName: user.name,
        })
      } catch {
        setError('Не удалось сохранить расчёт')
        throw new Error('save failed')
      } finally {
        setSaving(false)
      }
    },
    [role, month],
  )

  const inputs: KpiPayrollInputs = useMemo(() => {
    const base = defaultPayrollInputs(role)
    if (!saved) return base
    return {
      workDaysPlan: saved.workDaysPlan ?? 26,
      workDaysFact: saved.workDaysFact ?? 26,
      smmFact: saved.smmFact ?? 0,
      showroomFact: saved.showroomFact ?? 0,
      dealCounts: { ...base.dealCounts, ...saved.dealCounts },
      repeatBonus: saved.repeatBonus ?? 0,
      instagramTier: saved.instagramTier ?? null,
      onlineSalesUzs: saved.onlineSalesUzs ?? 0,
      instagramDirectFix: saved.instagramDirectFix ?? false,
      dutyDone: { ...base.dutyDone, ...saved.dutyDone },
      leadOverride: saved.leadOverride ?? null,
    }
  }, [saved, role])

  return { inputs, saved, loading, saving, error, save }
}
