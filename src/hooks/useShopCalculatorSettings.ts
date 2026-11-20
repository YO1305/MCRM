import { useCallback, useEffect, useState } from 'react'
import { getDocument, setDocument, subscribeToDocument } from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { DEFAULT_ROUNDING_STEP, DEFAULT_VAT_RATE } from '@/utils/shopPriceCalculator'

const COL = 'shop_calculator_settings'
const DOC_ID = 'default'

export interface ShopCalculatorSettings {
  vatRate: number
  roundingStep: number
}

const FALLBACK: ShopCalculatorSettings = {
  vatRate: DEFAULT_VAT_RATE,
  roundingStep: DEFAULT_ROUNDING_STEP,
}

export function useShopCalculatorSettings() {
  const { user, isRealAdmin } = useAuth()
  const [settings, setSettings] = useState<ShopCalculatorSettings>(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) {
      setSettings(FALLBACK)
      setLoading(false)
      return
    }
    return subscribeToDocument<ShopCalculatorSettings>(
      COL,
      DOC_ID,
      (data) => {
        if (data && Number.isFinite(data.vatRate) && Number.isFinite(data.roundingStep)) {
          setSettings({
            vatRate: data.vatRate,
            roundingStep: data.roundingStep > 0 ? data.roundingStep : DEFAULT_ROUNDING_STEP,
          })
        } else {
          setSettings(FALLBACK)
        }
        setLoading(false)
      },
      () => {
        setSettings(FALLBACK)
        setLoading(false)
      },
    )
  }, [user])

  const saveSettings = useCallback(
    async (next: ShopCalculatorSettings) => {
      if (!isRealAdmin) throw new Error('Ставку НДС меняет только админ')
      if (!(next.vatRate >= 0) || !(next.roundingStep > 0)) {
        throw new Error('Проверьте НДС и шаг округления')
      }
      setSaving(true)
      try {
        const existing = await getDocument<ShopCalculatorSettings>(COL, DOC_ID)
        const payload: Record<string, unknown> = {
          vatRate: next.vatRate,
          roundingStep: next.roundingStep,
        }
        if (!existing) payload.createdAt = Date.now()
        await setDocument(COL, DOC_ID, payload)
      } finally {
        setSaving(false)
      }
    },
    [isRealAdmin],
  )

  return { settings, loading, saving, canEdit: !!isRealAdmin, saveSettings }
}
