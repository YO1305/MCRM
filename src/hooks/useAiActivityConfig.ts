import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { setDocument, updateDocument } from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import {
  AI_ACTIVITY_COLLECTION,
  AI_ACTIVITY_DOC_ID,
  DEFAULT_AI_ACTIVITY_CONFIG,
  DEFAULT_ACTIVITY_PROMPT,
  isLegacyActivityPrompt,
  type AiActivityConfig,
} from '@/types/aiActivity.types'

function normalizeConfig(raw: Partial<AiActivityConfig> | undefined): AiActivityConfig {
  return {
    ...DEFAULT_AI_ACTIVITY_CONFIG,
    ...raw,
    minActiveDays: Math.max(1, Number(raw?.minActiveDays ?? DEFAULT_AI_ACTIVITY_CONFIG.minActiveDays) || 10),
    activityPrompt:
      !raw?.activityPrompt || isLegacyActivityPrompt(raw.activityPrompt)
        ? DEFAULT_ACTIVITY_PROMPT
        : raw.activityPrompt,
    isActive: raw?.isActive !== false,
  }
}

export function useAiActivityConfig() {
  const { user } = useAuth()
  const [config, setConfig] = useState<AiActivityConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const ref = doc(db, AI_ACTIVITY_COLLECTION, AI_ACTIVITY_DOC_ID)
    return onSnapshot(
      ref,
      async (snap) => {
        if (!snap.exists()) {
          try {
            await setDocument(AI_ACTIVITY_COLLECTION, AI_ACTIVITY_DOC_ID, {
              ...DEFAULT_AI_ACTIVITY_CONFIG,
              updatedBy: 'system',
            })
          } catch (err) {
            console.error('init ai_config/activity_settings failed', err)
            setConfig(normalizeConfig(undefined))
            setLoading(false)
          }
          return
        }
        setConfig(normalizeConfig(snap.data() as AiActivityConfig))
        setLoading(false)
      },
      (err) => {
        console.error(err)
        setConfig(normalizeConfig(undefined))
        setLoading(false)
      },
    )
  }, [])

  const saveConfig = useCallback(
    async (data: Partial<AiActivityConfig>) => {
      if (!user) throw new Error('Not authenticated')
      await updateDocument(AI_ACTIVITY_COLLECTION, AI_ACTIVITY_DOC_ID, {
        ...data,
        updatedBy: user.name,
      })
    },
    [user],
  )

  return { config, loading, saveConfig }
}
