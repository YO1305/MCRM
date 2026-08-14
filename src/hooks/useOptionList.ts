import { useCallback, useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { setDocument } from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import {
  OPTION_LIST_DEFAULTS,
  type AppOption,
  type OptionListId,
} from '@/constants/optionLists'

export function useOptionList(listId: OptionListId) {
  const { user, isRealAdmin } = useAuth()
  const [custom, setCustom] = useState<AppOption[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setCustom(null)
      setLoading(false)
      return
    }
    const unsub = onSnapshot(
      doc(db, 'app_option_lists', listId),
      (snap) => {
        if (snap.exists() && Array.isArray(snap.data().options)) {
          setCustom(snap.data().options as AppOption[])
        } else {
          setCustom(null)
        }
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsub
  }, [user, listId])

  const options = useMemo(() => {
    if (custom && custom.length > 0) return custom
    return OPTION_LIST_DEFAULTS[listId]
  }, [custom, listId])

  const labelOf = useCallback(
    (value: string | null | undefined) => {
      if (!value) return '—'
      return options.find((o) => o.value === value)?.label || value
    },
    [options],
  )

  const requiresExhibition = useCallback(
    (value: string | null | undefined) => {
      if (!value) return false
      return Boolean(options.find((o) => o.value === value)?.requiresExhibition)
    },
    [options],
  )

  async function saveOptions(next: AppOption[]) {
    if (!user || !isRealAdmin) throw new Error('Только админ')
    await setDocument('app_option_lists', listId, {
      options: next,
      updatedBy: user.id,
    })
  }

  return {
    options,
    loading,
    labelOf,
    requiresExhibition,
    saveOptions,
    canEdit: isRealAdmin,
  }
}
