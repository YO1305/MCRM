import { useEffect, useState } from 'react'
import {
  subscribeToCollection,
  createDocument,
  updateDocument,
  removeDocument,
} from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import type {
  Contact,
  ContactInput,
  ContactRelation,
  ContactStatus,
} from '@/types/contact.types'
import { normalizePhone } from '@/utils/phone'
import type { ParsedContactRow } from '@/utils/exportContacts'

function sortContacts(data: Contact[]) {
  return [...data].sort((a, b) => {
    const statusOrder = (s: ContactStatus | undefined) => (s === 'active' ? 0 : 1)
    const sa = statusOrder(a.status)
    const sb = statusOrder(b.status)
    if (sa !== sb) return sa - sb
    return a.name.localeCompare(b.name, 'ru')
  })
}

function withDefaults(c: Contact): Contact {
  return {
    ...c,
    status: c.status === 'passive' ? 'passive' : c.status || 'active',
    relation: c.relation || 'contact',
    buysWhat: c.buysWhat || '',
    exhibitionName: c.exhibitionName || '',
    exhibitionDate: c.exhibitionDate || null,
  }
}

export function useContacts(enabled = true) {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !user) {
      setContacts([])
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = subscribeToCollection<Contact>(
      'contacts',
      [],
      (data) => {
        setContacts(sortContacts(data.map(withDefaults)))
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error(err)
        setError('Не удалось загрузить базу клиентов')
        setLoading(false)
      },
    )
    return unsubscribe
  }, [enabled, user])

  function findByPhone(phone: string): Contact | undefined {
    const n = normalizePhone(phone)
    if (!n) return undefined
    return contacts.find((c) => c.phoneNormalized === n)
  }

  async function createContact(input: ContactInput) {
    if (!user) throw new Error('Not authenticated')
    const phone = input.phone.trim()
    const phoneNormalized = normalizePhone(phone)
    if (!phoneNormalized) throw new Error('Phone required')

    const existing = findByPhone(phone)
    if (existing) throw new Error('Контакт с таким телефоном уже есть в базе')

    return createDocument('contacts', {
      name: input.name.trim(),
      phone,
      phoneNormalized,
      company: (input.company || '').trim(),
      email: (input.email || '').trim(),
      country: input.country || null,
      notes: (input.notes || '').trim(),
      source: input.source || null,
      exhibitionName: (input.exhibitionName || '').trim(),
      exhibitionDate: input.exhibitionDate || null,
      status: (input.status || 'passive') as ContactStatus,
      relation: (input.relation || 'contact') as ContactRelation,
      buysWhat: (input.buysWhat || '').trim(),
      lastLeadId: null,
      createdBy: user.id,
      createdByName: user.name,
    })
  }

  async function updateContact(id: string, data: Partial<ContactInput>) {
    const patch: Record<string, unknown> = {}
    if (data.name !== undefined) patch.name = data.name.trim()
    if (data.phone !== undefined) {
      patch.phone = data.phone.trim()
      patch.phoneNormalized = normalizePhone(data.phone)
    }
    if (data.company !== undefined) patch.company = data.company.trim()
    if (data.email !== undefined) patch.email = data.email.trim()
    if (data.country !== undefined) patch.country = data.country
    if (data.notes !== undefined) patch.notes = data.notes.trim()
    if (data.source !== undefined) patch.source = data.source
    if (data.exhibitionName !== undefined) {
      patch.exhibitionName = data.exhibitionName.trim()
    }
    if (data.exhibitionDate !== undefined) patch.exhibitionDate = data.exhibitionDate
    if (data.status !== undefined) patch.status = data.status
    if (data.relation !== undefined) patch.relation = data.relation
    if (data.buysWhat !== undefined) patch.buysWhat = data.buysWhat.trim()
    await updateDocument('contacts', id, patch)
  }

  async function deleteContact(id: string) {
    await removeDocument('contacts', id)
  }

  async function importRows(rows: ParsedContactRow[]) {
    if (!user) throw new Error('Not authenticated')
    let created = 0
    let updated = 0
    const seen = new Map<string, string>()

    for (const c of contacts) {
      if (c.phoneNormalized) seen.set(c.phoneNormalized, c.id)
    }

    for (const row of rows) {
      const phoneNormalized = normalizePhone(row.phone)
      const existingId = seen.get(phoneNormalized)
      const payload: Record<string, unknown> = {
        name: row.name,
        phone: row.phone.trim(),
        phoneNormalized,
        company: row.company,
        email: row.email,
        country: row.country,
        notes: row.notes,
        status: row.status,
        relation: row.relation,
        buysWhat: row.buysWhat,
        exhibitionName: row.exhibitionName || '',
        exhibitionDate: row.exhibitionDate || null,
      }
      if (row.source) payload.source = row.source

      if (existingId) {
        await updateDocument('contacts', existingId, payload)
        updated += 1
      } else {
        const id = await createDocument('contacts', {
          ...payload,
          source: row.source || 'import',
          lastLeadId: null,
          createdBy: user.id,
          createdByName: user.name,
        })
        seen.set(phoneNormalized, id)
        created += 1
      }
    }

    return { created, updated }
  }

  return {
    contacts,
    loading,
    error,
    findByPhone,
    createContact,
    updateContact,
    deleteContact,
    importRows,
  }
}
