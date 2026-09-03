import { useCallback, useEffect, useMemo, useState } from 'react'
import { where } from 'firebase/firestore'
import {
  subscribeToCollection,
  createDocument,
  updateDocument,
  setDocumentIfMissing,
  removeDocument,
} from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import type {
  SmmPayment,
  SmmPaymentCycle,
  SmmPaymentItem,
  SmmPaymentItemInput,
  SmmCurrency,
} from '@/types/smmPayment.types'
import { computeAmountUZS } from '@/types/smmPayment.types'
import type { SmmTeam } from '@/types/smm.types'
import { exportSmmPaymentsExcel } from '@/utils/exportSmmPayments'
import { getCurrentMonth } from '@/utils/dates'

export function useSmmPaymentItemsActions() {
  const { user, isAdmin } = useAuth()
  const canManage =
    isAdmin || user?.position === 'leads_manager_1' || user?.position === 'head'

  async function createItem(input: SmmPaymentItemInput) {
    if (!user || !canManage) throw new Error('Нет доступа')
    const currency: SmmCurrency = input.currency || 'UZS'
    const amount = Number(input.amount) || 0
    const usdRate = currency === 'USD' ? Number(input.usdRate) || 0 : null
    await createDocument('smm_payment_items', {
      teamId: input.teamId,
      label: input.label.trim(),
      amount,
      currency,
      usdRate,
      amountUZS: computeAmountUZS(amount, currency, usdRate),
      order: input.order ?? 0,
      isActive: input.isActive !== false,
      createdBy: user.id,
    })
  }

  async function updateItem(id: string, patch: Partial<SmmPaymentItem>) {
    if (!canManage) throw new Error('Нет доступа')
    const next: Record<string, unknown> = { ...patch }
    delete next.id
    if (
      patch.amount != null ||
      patch.currency != null ||
      patch.usdRate !== undefined
    ) {
      // caller should pass full computed fields; recompute if possible
    }
    await updateDocument('smm_payment_items', id, next)
  }

  async function saveItemFields(
    id: string | null,
    data: {
      teamId: string
      label: string
      amount: number
      currency: SmmCurrency
      usdRate: number | null
      order: number
      isActive: boolean
    },
  ) {
    if (!user || !canManage) throw new Error('Нет доступа')
    const amountUZS = computeAmountUZS(data.amount, data.currency, data.usdRate)
    const payload = {
      teamId: data.teamId,
      label: data.label.trim(),
      amount: data.amount,
      currency: data.currency,
      usdRate: data.currency === 'USD' ? data.usdRate : null,
      amountUZS,
      order: data.order,
      isActive: data.isActive,
    }
    if (id) {
      await updateDocument('smm_payment_items', id, payload)
    } else {
      await createDocument('smm_payment_items', {
        ...payload,
        createdBy: user.id,
      })
    }
  }

  async function deleteItem(id: string) {
    if (!canManage) throw new Error('Нет доступа')
    await updateDocument('smm_payment_items', id, { isActive: false })
  }

  return { canManage, createItem, updateItem, saveItemFields, deleteItem }
}

export function useSmmPayments(month: string, cycle: SmmPaymentCycle) {
  const { user, isAdmin } = useAuth()
  const canManage =
    isAdmin || user?.position === 'leads_manager_1' || user?.position === 'head'

  const [payments, setPayments] = useState<SmmPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !canManage || !month) {
      setPayments([])
      setLoading(false)
      return
    }
    setLoading(true)
    return subscribeToCollection<SmmPayment>(
      'smm_payments',
      [where('period', '==', month)],
      (data) => {
        setPayments(
          data
            .filter((p) => p.paymentCycle === cycle)
            .sort(
              (a, b) =>
                a.teamName.localeCompare(b.teamName, 'ru') ||
                a.itemLabel.localeCompare(b.itemLabel, 'ru'),
            ),
        )
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [user, canManage, month, cycle])

  async function generatePayments(
    teams: SmmTeam[],
    items: SmmPaymentItem[],
  ): Promise<{ created: number; skipped: number }> {
    if (!user || !canManage) throw new Error('Нет доступа')
    const activeTeams = teams.filter((t) => t.isActive !== false)
    const activeItems = items.filter((i) => i.isActive !== false)
    let created = 0
    let skipped = 0

    for (const team of activeTeams) {
      const teamItems = activeItems.filter((i) => i.teamId === team.id)
      for (const item of teamItems) {
        const id = `${month}_${cycle}_${item.id}`
        const existed = await setDocumentIfMissing('smm_payments', id, {
          teamId: team.id,
          itemId: item.id,
          itemLabel: item.label,
          teamName: team.name,
          agencyName: team.agency || '',
          amount: item.amountUZS,
          currency: item.currency,
          period: month,
          paymentCycle: cycle,
          status: 'pending',
          paidAt: null,
          paidBy: null,
          note: null,
        })
        if (existed) created += 1
        else skipped += 1
      }
    }
    return { created, skipped }
  }

  async function markPaid(id: string, note?: string) {
    if (!user || !canManage) throw new Error('Нет доступа')
    await updateDocument('smm_payments', id, {
      status: 'paid',
      paidAt: new Date().toISOString(),
      paidBy: user.name,
      note: note?.trim() || null,
    })
  }

  async function markPending(id: string) {
    if (!canManage) throw new Error('Нет доступа')
    await updateDocument('smm_payments', id, {
      status: 'pending',
      paidAt: null,
      paidBy: null,
    })
  }

  async function deletePayment(id: string) {
    if (!user || !canManage) throw new Error('Нет доступа')
    await removeDocument('smm_payments', id)
  }

  async function exportExcel() {
    await exportSmmPaymentsExcel(payments, month, cycle)
  }

  const summary = useMemo(() => {
    const pending = payments
      .filter((p) => p.status === 'pending')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const paid = payments
      .filter((p) => p.status === 'paid')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const teamIds = new Set(payments.map((p) => p.teamId))
    return {
      teams: teamIds.size,
      items: payments.length,
      pending,
      paid,
      remaining: pending,
      allPaid: payments.length > 0 && payments.every((p) => p.status === 'paid'),
    }
  }, [payments])

  return {
    payments,
    loading,
    canManage,
    generatePayments,
    markPaid,
    markPending,
    deletePayment,
    exportExcel,
    summary,
  }
}

export function useSmmPaymentsHistory() {
  const { user, isAdmin } = useAuth()
  const canManage =
    isAdmin || user?.position === 'leads_manager_1' || user?.position === 'head'
  const [payments, setPayments] = useState<SmmPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !canManage) {
      setPayments([])
      setLoading(false)
      return
    }
    return subscribeToCollection<SmmPayment>(
      'smm_payments',
      [],
      (data) => {
        setPayments(
          [...data].sort((a, b) => {
            const pc = (b.period || '').localeCompare(a.period || '')
            if (pc) return pc
            return (a.paymentCycle || '').localeCompare(b.paymentCycle || '')
          }),
        )
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [user, canManage])

  async function deletePayment(id: string) {
    if (!user || !canManage) throw new Error('Нет доступа')
    await removeDocument('smm_payments', id)
  }

  async function deletePayments(ids: string[]) {
    if (!user || !canManage) throw new Error('Нет доступа')
    await Promise.all(ids.map((id) => removeDocument('smm_payments', id)))
  }

  return { payments, loading, canManage, deletePayment, deletePayments }
}

/** Client-side reminder on 10th / 25th for leads_manager_1 (+ self if admin viewing). */
export function useSmmPaymentReminder() {
  const { user, viewAsUser } = useAuth()
  const { users } = useUsers(!!user)

  const run = useCallback(async () => {
    if (!user || viewAsUser) return
    const day = new Date().getDate()
    if (day !== 10 && day !== 25) return
    if (user.position !== 'leads_manager_1' && user.role !== 'admin') return

    const cycle: SmmPaymentCycle = day === 10 ? 'first' : 'second'
    const month = getCurrentMonth()
    const cycleLabel = cycle === 'first' ? '10-го' : '25-го'

    const targets = users.filter(
      (u) => u.isActive !== false && u.position === 'leads_manager_1',
    )
    const list = targets.length ? targets : [user]

    await Promise.all(
      list.map((u) =>
        setDocumentIfMissing(
          'notifications',
          `smm_pay_reminder_${month}_${cycle}_${u.id}`.replace(/[^a-zA-Z0-9:_-]/g, '_'),
          {
            userId: u.id,
            type: 'smm_payment_reminder',
            title: 'SMM оплата',
            body: `Сегодня ${cycleLabel} числа — заполните таблицу SMM оплаты и отправьте в финансовый отдел.`,
            taskId: null,
            dedupeKey: `smm_pay_reminder_${month}_${cycle}`,
            link: `/smm-payments?month=${month}&cycle=${cycle}`,
            read: false,
          },
        ),
      ),
    )
  }, [user, viewAsUser, users])

  return { run }
}
