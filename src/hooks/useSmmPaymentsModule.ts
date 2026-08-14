import { useEffect, useMemo, useState } from 'react'
import { where } from 'firebase/firestore'
import {
  subscribeToCollection,
  createDocument,
  updateDocument,
} from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import type { SmmTeam } from '@/types/smm.types'

export function useSmmTeams() {
  const { user, isAdmin } = useAuth()
  const canManage =
    isAdmin || user?.position === 'leads_manager_1' || user?.position === 'head'

  const [teams, setTeams] = useState<SmmTeam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !canManage) {
      setTeams([])
      setLoading(false)
      return
    }
    return subscribeToCollection<SmmTeam>(
      'smm_teams',
      [],
      (data) => {
        setTeams(
          [...data].sort(
            (a, b) =>
              (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'ru'),
          ),
        )
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [user, canManage])

  const activeTeams = useMemo(
    () => teams.filter((t) => t.isActive !== false),
    [teams],
  )

  async function createTeam(input: {
    name: string
    agency?: string
    contactName?: string
    contactPhone?: string
    isActive?: boolean
  }) {
    if (!user || !canManage) throw new Error('Нет доступа')
    const maxOrder = teams.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), 0)
    return createDocument('smm_teams', {
      name: input.name.trim(),
      agency: (input.agency || '').trim(),
      instagram: '',
      telegram: '',
      facebook: '',
      youtube: '',
      contactName: (input.contactName || '').trim(),
      contactPhone: (input.contactPhone || '').trim(),
      contactNote: '',
      sortOrder: maxOrder + 1,
      isActive: input.isActive !== false,
      createdBy: user.id,
    })
  }

  async function updateTeam(id: string, patch: Partial<SmmTeam>) {
    if (!canManage) throw new Error('Нет доступа')
    const { id: _i, ...rest } = patch as SmmTeam
    void _i
    await updateDocument('smm_teams', id, rest as Record<string, unknown>)
  }

  /** Soft delete */
  async function deleteTeam(id: string) {
    if (!canManage) throw new Error('Нет доступа')
    await updateDocument('smm_teams', id, { isActive: false })
  }

  return {
    teams,
    activeTeams,
    loading,
    canManage,
    createTeam,
    updateTeam,
    deleteTeam,
  }
}

export function useSmmPaymentItems(teamId: string | null) {
  const { user, isAdmin } = useAuth()
  const canManage =
    isAdmin || user?.position === 'leads_manager_1' || user?.position === 'head'

  const [items, setItems] = useState<
    import('@/types/smmPayment.types').SmmPaymentItem[]
  >([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || !canManage || !teamId) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    return subscribeToCollection(
      'smm_payment_items',
      [where('teamId', '==', teamId)],
      (data: import('@/types/smmPayment.types').SmmPaymentItem[]) => {
        setItems([...data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [user, canManage, teamId])

  return { items, loading, canManage }
}

export function useAllSmmPaymentItems() {
  const { user, isAdmin } = useAuth()
  const canManage =
    isAdmin || user?.position === 'leads_manager_1' || user?.position === 'head'
  const [items, setItems] = useState<
    import('@/types/smmPayment.types').SmmPaymentItem[]
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !canManage) {
      setItems([])
      setLoading(false)
      return
    }
    return subscribeToCollection(
      'smm_payment_items',
      [],
      (data: import('@/types/smmPayment.types').SmmPaymentItem[]) => {
        setItems(data)
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [user, canManage])

  return { items, loading }
}
