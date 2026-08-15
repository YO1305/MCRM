import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import {
  createSubdocument,
  setDocument,
  updateDocument,
} from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import {
  AI_CONFIG_COLLECTION,
  AI_CONFIG_DOC_ID,
  DEFAULT_AI_CONFIG,
  type AiConfig,
  type AiConfigChangeLog,
} from '@/types/aiConfig.types'
import { subscribeToSubcollection } from '@/firebase/firestore'

function normalizeConfig(raw: Partial<AiConfig> | undefined): AiConfig {
  return {
    ...DEFAULT_AI_CONFIG,
    ...raw,
    enabledForManagers: Array.isArray(raw?.enabledForManagers)
      ? raw!.enabledForManagers
      : [],
    promptTemplate: raw?.promptTemplate || DEFAULT_AI_CONFIG.promptTemplate,
  }
}

function truncateValue(field: string, value: unknown): unknown {
  if (field === 'promptTemplate' && typeof value === 'string') {
    return value.length > 120 ? `${value.slice(0, 120)}…` : value
  }
  return value
}

export function useAiConfig() {
  const { user } = useAuth()
  const [config, setConfig] = useState<AiConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [changeLog, setChangeLog] = useState<AiConfigChangeLog[]>([])

  useEffect(() => {
    setLoading(true)
    const ref = doc(db, AI_CONFIG_COLLECTION, AI_CONFIG_DOC_ID)
    return onSnapshot(
      ref,
      async (snap) => {
        if (!snap.exists()) {
          try {
            await setDocument(AI_CONFIG_COLLECTION, AI_CONFIG_DOC_ID, {
              ...DEFAULT_AI_CONFIG,
              updatedBy: 'system',
            })
          } catch (err) {
            console.error('init ai_config failed', err)
            setConfig(normalizeConfig(undefined))
            setLoading(false)
          }
          return
        }
        setConfig(normalizeConfig({ id: snap.id, ...(snap.data() as AiConfig) }))
        setLoading(false)
      },
      (err) => {
        console.error(err)
        setConfig(normalizeConfig(undefined))
        setLoading(false)
      },
    )
  }, [])

  useEffect(() => {
    return subscribeToSubcollection<AiConfigChangeLog>(
      AI_CONFIG_COLLECTION,
      AI_CONFIG_DOC_ID,
      'change_log',
      (data) => {
        const sorted = [...data].sort((a, b) => {
          const at = (a.changedAt as { seconds?: number } | null)?.seconds ?? 0
          const bt = (b.changedAt as { seconds?: number } | null)?.seconds ?? 0
          return bt - at
        })
        setChangeLog(sorted.slice(0, 50))
      },
    )
  }, [])

  const saveConfig = useCallback(
    async (data: Partial<AiConfig>) => {
      if (!user) throw new Error('Not authenticated')
      const prev = config || normalizeConfig(undefined)
      const next = { ...prev, ...data }

      await updateDocument(AI_CONFIG_COLLECTION, AI_CONFIG_DOC_ID, {
        ...data,
        updatedBy: user.name,
      })

      const keys = Object.keys(data) as (keyof AiConfig)[]
      for (const field of keys) {
        if (field === 'updatedAt' || field === 'updatedBy' || field === 'id') continue
        const oldValue = prev[field]
        const newValue = next[field]
        if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue
        try {
          await createSubdocument(AI_CONFIG_COLLECTION, AI_CONFIG_DOC_ID, 'change_log', {
            field,
            oldValue: truncateValue(String(field), oldValue),
            newValue: truncateValue(String(field), newValue),
            changedBy: user.name,
          })
        } catch (err) {
          console.error('ai config changelog failed', err)
        }
      }
    },
    [config, user],
  )

  const resetToDefaults = useCallback(async () => {
    await saveConfig({ ...DEFAULT_AI_CONFIG })
  }, [saveConfig])

  return {
    config,
    loading,
    changeLog,
    saveConfig,
    resetToDefaults,
  }
}
