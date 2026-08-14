import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { setDocument } from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import {
  DEFAULT_CRM_STAGES,
  mergeBuiltinClosedStages,
  setLiveCrmStages,
  stageOptionIsClosed,
  type CrmStageOption,
  type StageCloseKind,
} from '@/constants/clientStages'
import { slugifyOption } from '@/constants/optionLists'

const LIST_ID = 'client_stages'

function normalize(raw: unknown[]): CrmStageOption[] {
  return raw
    .map((item, idx) => {
      const o = item as Partial<CrmStageOption>
      const value = (o.value || '').trim()
      const label = (o.label || '').trim()
      if (!value || !label) return null
      return {
        value,
        label,
        order: typeof o.order === 'number' ? o.order : (idx + 1) * 10,
        active: o.active !== false,
        countsAsKpiLead: Boolean(o.countsAsKpiLead),
        kpiBucket: o.kpiBucket === 'lead' || o.kpiBucket === 'deal' ? o.kpiBucket : 'none',
        isRejected: Boolean(o.isRejected),
        isFailed: Boolean(o.isFailed),
        isAbandoned: Boolean(o.isAbandoned),
        builtin: Boolean(o.builtin),
      } satisfies CrmStageOption
    })
    .filter(Boolean) as CrmStageOption[]
}

export function closeKindOf(s: CrmStageOption): StageCloseKind {
  if (s.isRejected) return 'rejected'
  if (s.isFailed) return 'failed'
  if (s.isAbandoned) return 'abandoned'
  return 'none'
}

export function applyCloseKind(
  s: CrmStageOption,
  kind: StageCloseKind,
): CrmStageOption {
  return {
    ...s,
    isRejected: kind === 'rejected',
    isFailed: kind === 'failed',
    isAbandoned: kind === 'abandoned',
  }
}

export function useClientStages() {
  const { user, isRealAdmin } = useAuth()
  const [stages, setStages] = useState<CrmStageOption[]>(DEFAULT_CRM_STAGES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setStages(DEFAULT_CRM_STAGES)
      setLiveCrmStages(null)
      setLoading(false)
      return
    }
    const unsub = onSnapshot(
      doc(db, 'app_option_lists', LIST_ID),
      (snap) => {
        if (snap.exists() && Array.isArray(snap.data().options)) {
          const parsed = normalize(snap.data().options)
          const next = mergeBuiltinClosedStages(parsed.length ? parsed : DEFAULT_CRM_STAGES)
          setStages(next)
          setLiveCrmStages(next)
        } else {
          setStages(DEFAULT_CRM_STAGES)
          setLiveCrmStages(null)
        }
        setLoading(false)
      },
      () => {
        setStages(DEFAULT_CRM_STAGES)
        setLiveCrmStages(null)
        setLoading(false)
      },
    )
    return unsub
  }, [user])

  const funnel = useMemo(
    () =>
      [...stages]
        .filter((s) => s.active && !stageOptionIsClosed(s))
        .sort((a, b) => a.order - b.order),
    [stages],
  )

  const closed = useMemo(
    () =>
      [...stages]
        .filter((s) => s.active && stageOptionIsClosed(s))
        .sort((a, b) => a.order - b.order),
    [stages],
  )

  const pipeline = useMemo(
    () => [...stages].filter((s) => s.active).sort((a, b) => a.order - b.order),
    [stages],
  )

  function labelOf(value: string | null | undefined) {
    if (!value) return '—'
    return stages.find((s) => s.value === value)?.label || value
  }

  async function saveStages(next: CrmStageOption[]) {
    if (!user || !isRealAdmin) throw new Error('Только админ')
    const cleaned = next.map((s, idx) => ({
      ...s,
      value: s.value.trim() || slugifyOption(s.label),
      label: s.label.trim(),
      order: typeof s.order === 'number' ? s.order : (idx + 1) * 10,
      active: s.active !== false,
      countsAsKpiLead: Boolean(s.countsAsKpiLead),
      kpiBucket:
        s.kpiBucket === 'lead' || s.kpiBucket === 'deal' ? s.kpiBucket : ('none' as const),
      isRejected: Boolean(s.isRejected),
      isFailed: Boolean(s.isFailed),
      isAbandoned: Boolean(s.isAbandoned),
      builtin: Boolean(s.builtin),
    }))
    for (const s of cleaned) {
      if (s.countsAsKpiLead && s.kpiBucket === 'none') s.kpiBucket = 'lead'
    }
    await setDocument('app_option_lists', LIST_ID, {
      options: cleaned,
      updatedBy: user.id,
    })
    setStages(cleaned)
    setLiveCrmStages(cleaned)
  }

  return {
    stages,
    funnel,
    closed,
    pipeline,
    loading,
    labelOf,
    saveStages,
    canEdit: !!isRealAdmin,
  }
}
