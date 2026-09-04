import { useCallback, useEffect, useState } from 'react'
import { deleteField, serverTimestamp } from 'firebase/firestore'
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
  const [approved, setApproved] = useState(false)
  const [approvedByName, setApprovedByName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setExists(false)
    setApproved(false)
    setApprovedByName('')
    void getDocument<KpiDeptPayrollDoc>('kpi_payroll', docId(role, month)).then((data) => {
      if (cancelled) return
      setExists(Boolean(data))
      setApproved(data?.payrollStatus === 'approved')
      setApprovedByName(data?.approvedByName || '')
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
    async (
      headOverride?: HeadPayrollInput,
      opts?: { mode?: 'draft' | 'approve' | 'unapprove'; user?: { id: string; name: string } },
    ) => {
      setSaving(true)
      setError('')
      const mode = opts?.mode || 'draft'
      try {
        const nextApproved = mode === 'approve' || (mode !== 'unapprove' && approved)
        const payload: Record<string, unknown> = { role, month }
        if (role === 'head') {
          const next = headOverride ?? head
          payload.head = next
          setHead(next)
        }
        if (role === 'designer') payload.designer = designer
        if (role === 'assistant') payload.assistant = assistant
        payload.payrollStatus = nextApproved ? 'approved' : 'draft'
        if (mode === 'approve') {
          payload.approvedAt = serverTimestamp()
          payload.approvedBy = opts?.user?.id || ''
          payload.approvedByName = opts?.user?.name || ''
        } else if (mode === 'unapprove') {
          payload.approvedAt = deleteField()
          payload.approvedBy = deleteField()
          payload.approvedByName = deleteField()
        }
        await setDocument('kpi_payroll', docId(role, month), payload)
        setExists(true)
        setApproved(nextApproved)
        if (mode === 'approve') setApprovedByName(opts?.user?.name || '')
        if (mode === 'unapprove') setApprovedByName('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось сохранить')
        throw err
      } finally {
        setSaving(false)
      }
    },
    [role, month, head, designer, assistant, approved],
  )

  return {
    head,
    setHead,
    designer,
    setDesigner,
    assistant,
    setAssistant,
    loading,
    saving,
    error,
    save,
    exists,
    approved,
    approvedByName,
  }
}
