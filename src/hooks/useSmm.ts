import { useEffect, useMemo, useState } from 'react'
import {
  subscribeToCollection,
  createDocument,
  updateDocument,
  removeDocument,
} from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import type { SmmContentFact, SmmContentItem, SmmTeam } from '@/types/smm.types'
import { getCurrentMonth, todayISO } from '@/utils/dates'

export function useSmm() {
  const { user, isAdmin } = useAuth()
  const canManage =
    isAdmin || user?.position === 'head' || user?.position === 'leads_manager_1'

  const [teams, setTeams] = useState<SmmTeam[]>([])
  const [items, setItems] = useState<SmmContentItem[]>([])
  const [facts, setFacts] = useState<SmmContentFact[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !canManage) {
      setTeams([])
      setItems([])
      setFacts([])
      setLoading(false)
      return
    }
    setLoading(true)
    const u1 = subscribeToCollection<SmmTeam>('smm_teams', [], (data) => {
      setTeams(
        [...data].sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'ru'),
        ),
      )
    })
    const u2 = subscribeToCollection<SmmContentItem>('smm_content_items', [], (data) => {
      setItems(
        [...data].sort((a, b) => a.title.localeCompare(b.title, 'ru')),
      )
      setLoading(false)
    }, () => setLoading(false))
    const u3 = subscribeToCollection<SmmContentFact>('smm_content_facts', [], setFacts)
    return () => {
      u1()
      u2()
      u3()
    }
  }, [user, canManage])

  const factTotalByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const f of facts) {
      map.set(f.contentItemId, (map.get(f.contentItemId) || 0) + (Number(f.count) || 0))
    }
    return map
  }, [facts])

  function factForItem(itemId: string) {
    return factTotalByItem.get(itemId) || 0
  }

  function isClosed(item: SmmContentItem) {
    return factForItem(item.id) >= (item.planCount || 0) && (item.planCount || 0) > 0
  }

  // ——— Teams ———
  async function createTeam(input: {
    name: string
    instagram?: string
    telegram?: string
    facebook?: string
    youtube?: string
    contactName?: string
    contactPhone?: string
    contactNote?: string
  }) {
    if (!user || !canManage) throw new Error('Нет доступа')
    const maxOrder = teams.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), 0)
    await createDocument('smm_teams', {
      name: input.name.trim(),
      agency: '',
      instagram: (input.instagram || '').trim(),
      telegram: (input.telegram || '').trim(),
      facebook: (input.facebook || '').trim(),
      youtube: (input.youtube || '').trim(),
      contactName: (input.contactName || '').trim(),
      contactPhone: (input.contactPhone || '').trim(),
      contactNote: (input.contactNote || '').trim(),
      sortOrder: maxOrder + 1,
      isActive: true,
      createdBy: user.id,
    })
  }

  async function updateTeam(id: string, patch: Partial<SmmTeam>) {
    if (!canManage) throw new Error('Нет доступа')
    const { id: _i, ...rest } = patch as SmmTeam
    void _i
    await updateDocument('smm_teams', id, rest as Record<string, unknown>)
  }

  async function deleteTeam(id: string) {
    if (!canManage) throw new Error('Нет доступа')
    const relatedItems = items.filter((i) => i.teamId === id)
    const relatedFacts = facts.filter((f) => f.teamId === id)
    await Promise.all([
      ...relatedFacts.map((f) => removeDocument('smm_content_facts', f.id)),
      ...relatedItems.map((i) => removeDocument('smm_content_items', i.id)),
      removeDocument('smm_teams', id),
    ])
  }

  // ——— Content plan ———
  async function addContentItem(input: {
    teamId: string
    monthKey: string
    title: string
    planCount: number
  }) {
    if (!user || !canManage) throw new Error('Нет доступа')
    const team = teams.find((t) => t.id === input.teamId)
    if (!team) throw new Error('Команда не найдена')
    const title = input.title.trim()
    if (!title) throw new Error('Укажите название')
    await createDocument('smm_content_items', {
      teamId: team.id,
      teamName: team.name,
      monthKey: input.monthKey || getCurrentMonth(),
      title,
      planCount: Math.max(0, Number(input.planCount) || 0),
      createdBy: user.id,
    })
  }

  async function updateContentItem(id: string, patch: Partial<SmmContentItem>) {
    if (!canManage) throw new Error('Нет доступа')
    const { id: _i, ...rest } = patch as SmmContentItem
    void _i
    await updateDocument('smm_content_items', id, rest as Record<string, unknown>)
  }

  async function deleteContentItem(id: string) {
    if (!canManage) throw new Error('Нет доступа')
    const related = facts.filter((f) => f.contentItemId === id)
    await Promise.all(related.map((f) => removeDocument('smm_content_facts', f.id)))
    await removeDocument('smm_content_items', id)
  }

  async function addFact(input: {
    contentItemId: string
    publishedAt?: string
    count: number
    note?: string
  }) {
    if (!user || !canManage) throw new Error('Нет доступа')
    const item = items.find((i) => i.id === input.contentItemId)
    if (!item) throw new Error('Пункт не найден')
    const count = Math.max(1, Number(input.count) || 1)
    await createDocument('smm_content_facts', {
      contentItemId: item.id,
      teamId: item.teamId,
      monthKey: item.monthKey,
      publishedAt: input.publishedAt || todayISO(),
      count,
      note: (input.note || '').trim(),
      createdBy: user.id,
      createdByName: user.name,
    })
  }

  async function updateFact(id: string, patch: Partial<SmmContentFact>) {
    if (!canManage) throw new Error('Нет доступа')
    const { id: _i, ...rest } = patch as SmmContentFact
    void _i
    await updateDocument('smm_content_facts', id, rest as Record<string, unknown>)
  }

  async function deleteFact(id: string) {
    if (!canManage) throw new Error('Нет доступа')
    await removeDocument('smm_content_facts', id)
  }

  return {
    teams,
    items,
    facts,
    loading,
    canManage,
    factForItem,
    isClosed,
    createTeam,
    updateTeam,
    deleteTeam,
    addContentItem,
    updateContentItem,
    deleteContentItem,
    addFact,
    updateFact,
    deleteFact,
  }
}
