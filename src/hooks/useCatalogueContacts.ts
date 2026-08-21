import { useCallback, useEffect, useState } from 'react'
import { setDocument, subscribeToDocument } from '@/firebase/firestore'
import {
  CATALOGUE_CONTACTS_DOC,
  CATALOGUE_SETTINGS_COLLECTION,
  DEFAULT_CATALOGUE_CONTACTS,
  type CataloguePublicContacts,
} from '@/types/catalogue.types'

function normalize(raw: Partial<CataloguePublicContacts> | null): CataloguePublicContacts {
  return {
    companyName: (raw?.companyName || DEFAULT_CATALOGUE_CONTACTS.companyName).trim(),
    phone: (raw?.phone || DEFAULT_CATALOGUE_CONTACTS.phone).trim(),
    whatsapp: (raw?.whatsapp || '').trim(),
    telegram: (raw?.telegram || '').trim(),
    instagram: (raw?.instagram || '').trim(),
    email: (raw?.email || '').trim(),
    website: (raw?.website || '').trim(),
    address: (raw?.address || '').trim(),
  }
}

export function useCatalogueContacts() {
  const [contacts, setContacts] = useState<CataloguePublicContacts>(DEFAULT_CATALOGUE_CONTACTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return subscribeToDocument<CataloguePublicContacts>(
      CATALOGUE_SETTINGS_COLLECTION,
      CATALOGUE_CONTACTS_DOC,
      (data) => {
        setContacts(normalize(data))
        setLoading(false)
      },
      () => {
        setContacts(DEFAULT_CATALOGUE_CONTACTS)
        setLoading(false)
      },
    )
  }, [])

  const saveContacts = useCallback(async (next: CataloguePublicContacts) => {
    const payload = normalize(next)
    await setDocument(CATALOGUE_SETTINGS_COLLECTION, CATALOGUE_CONTACTS_DOC, payload)
    setContacts(payload)
  }, [])

  return { contacts, loading, saveContacts }
}
