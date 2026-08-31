import { useCallback, useEffect, useState } from 'react'
import { getDocument, setDocument } from '@/firebase/firestore'
import {
  defaultAssistantInput,
  defaultDesignerInput,
  defaultHeadInput,
} from '@/constants/kpiDeptPayroll'
import type {
  AssistantPayrollInput,
  DesignerPayrollInput,
  HeadPayrollInput,
  KpiDeptPayrollDoc,
  KpiDeptRole,
} from '@/types/kpiDeptPayroll.types'

function docId(role: KpiDeptRole, month: string) {
  return `${role}_${month}`
}

export function useKpiDeptPayroll(role: KpiDeptRole, month: string) {
  const [head, setHead] = useState<HeadPayrollInput>(defaultHeadInput)
  const [designer, setDesigner] = useState<DesignerPayrollInput>(defaultDesignerInput)
  const [assistant, setAssistant] = useState<AssistantPayrollInput>(defaultAssistantInput)
  const [exists, setExists] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setExists(false)
    void getDocument<KpiDeptPayrollDoc>('kpi_payroll', docId(role, month)).then((data) => {
      if (cancelled) return
      setExists(Boolean(data))
      if (role === 'head') setHead(data?.head ? { ...defaultHeadInput(), ...data.head } : defaultHeadInput())
      if (role === 'designer') {
        setDesigner(data?.designer ? { ...defaultDesignerInput(), ...data.designer } : defaultDesignerInput())
      }
      if (role === 'assistant') {
        setAssistant(
          data?.assistant ? { ...defaultAssistantInput(), ...data.assistant } : defaultAssistantInput(),
        )
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [role, month])

  const save = useCallback(
    async (headOverride?: HeadPayrollInput) => {
      setSaving(true)
      setError('')
      try {
        const payload: Record<string, unknown> = { role, month }
        if (role === 'head') {
          const next = headOverride ?? head
          payload.head = next
          setHead(next)
        }
        if (role === 'designer') payload.designer = designer
        if (role === 'assistant') payload.assistant = assistant
        await setDocument('kpi_payroll', docId(role, month), payload)
        setExists(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось сохранить')
        throw err
      } finally {
        setSaving(false)
      }
    },
    [role, month, head, designer, assistant],
  )

  return { head, setHead, designer, setDesigner, assistant, setAssistant, loading, saving, error, save, exists }
}
