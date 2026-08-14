import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { setDocument } from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import {
  COUNTRIES,
  setLiveCountries,
  type CountryOption,
} from '@/constants/leadProducts'

const LIST_ID = 'countries'

function normalize(raw: unknown[]): CountryOption[] {
  return raw
    .map((item) => {
      const o = item as Partial<CountryOption> & { value?: string; label?: string }
      const code = (o.code || o.value || '').trim().toUpperCase()
      const name = (o.name || o.label || '').trim()
      if (!code || !name) return null
      return {
        code,
        name,
        europe: Boolean(o.europe),
        builtin: Boolean(o.builtin),
      } satisfies CountryOption
    })
    .filter(Boolean) as CountryOption[]
}

/** Live countries list (Firestore + defaults). Updates getCountries() cache. */
export function useCountriesList() {
  const { user, isRealAdmin } = useAuth()
  const [countries, setCountries] = useState<CountryOption[]>(COUNTRIES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setCountries(COUNTRIES)
      setLiveCountries(null)
      setLoading(false)
      return
    }
    const unsub = onSnapshot(
      doc(db, 'app_option_lists', LIST_ID),
      (snap) => {
        if (snap.exists() && Array.isArray(snap.data().options)) {
          const parsed = normalize(snap.data().options)
          const next = parsed.length ? parsed : COUNTRIES
          setCountries(next)
          setLiveCountries(next)
        } else {
          setCountries(COUNTRIES)
          setLiveCountries(null)
        }
        setLoading(false)
      },
      () => {
        setCountries(COUNTRIES)
        setLiveCountries(null)
        setLoading(false)
      },
    )
    return unsub
  }, [user])

  async function saveCountries(next: CountryOption[]) {
    if (!user || !isRealAdmin) throw new Error('Только админ')
    const cleaned = next.map((c) => ({
      code: c.code.trim().toUpperCase(),
      name: c.name.trim(),
      europe: Boolean(c.europe),
      builtin: Boolean(c.builtin),
    }))
    await setDocument('app_option_lists', LIST_ID, {
      options: cleaned.map((c) => ({
        value: c.code,
        label: c.name,
        code: c.code,
        name: c.name,
        europe: c.europe || undefined,
        builtin: c.builtin || undefined,
      })),
      updatedBy: user.id,
    })
    setCountries(cleaned)
    setLiveCountries(cleaned)
  }

  return { countries, loading, saveCountries, canEdit: !!isRealAdmin }
}
