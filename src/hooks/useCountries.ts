import { useEffect, useState } from 'react'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { setDocument } from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import {
  COUNTRIES,
  makeCountryCode,
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

  function toDocOptions(list: CountryOption[]) {
    // Firestore rejects `undefined` in nested maps. Always write booleans.
    return list.map((c) => ({
      value: c.code,
      label: c.name,
      code: c.code,
      name: c.name,
      europe: Boolean(c.europe),
      builtin: Boolean(c.builtin),
    }))
  }

  async function addCountry(rawName: string, europe = false): Promise<CountryOption> {
    if (!user) throw new Error('Нужно войти в систему')
    const name = rawName.trim()
    if (name.length < 2) throw new Error('Введите название страны')

    const snap = await getDoc(doc(db, 'app_option_lists', LIST_ID))
    let current = countries
    if (snap.exists() && Array.isArray(snap.data().options)) {
      const parsed = normalize(snap.data().options)
      if (parsed.length) current = parsed
    }

    const existing = current.find(
      (c) => c.name.toLowerCase() === name.toLowerCase() || c.code.toLowerCase() === name.toLowerCase(),
    )
    if (existing) return existing

    const code = makeCountryCode(name, new Set(current.map((c) => c.code)))
    const created: CountryOption = { code, name, europe, builtin: false }
    const next = [...current, created]
    await setDocument('app_option_lists', LIST_ID, {
      options: toDocOptions(next),
      updatedBy: user.id,
    })
    setCountries(next)
    setLiveCountries(next)
    return created
  }

  async function saveCountries(next: CountryOption[]) {
    if (!user || !isRealAdmin) throw new Error('Только админ')
    const cleaned = next.map((c) => ({
      code: c.code.trim().toUpperCase(),
      name: c.name.trim(),
      europe: Boolean(c.europe),
      builtin: Boolean(c.builtin),
    }))
    await setDocument('app_option_lists', LIST_ID, {
      options: toDocOptions(cleaned),
      updatedBy: user.id,
    })
    setCountries(cleaned)
    setLiveCountries(cleaned)
  }

  return { countries, loading, addCountry, saveCountries, canEdit: !!isRealAdmin }
}
