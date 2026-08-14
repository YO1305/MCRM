import { collection, query, where, getDocs, limit } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { createDocument, updateDocument } from '@/firebase/firestore'
import { normalizePhone } from '@/utils/phone'
import type { ContactRelation, ContactStatus } from '@/types/contact.types'

export async function findContactIdByPhone(phone: string): Promise<string | null> {
  const phoneNormalized = normalizePhone(phone)
  if (!phoneNormalized) return null
  const q = query(
    collection(db, 'contacts'),
    where('phoneNormalized', '==', phoneNormalized),
    limit(1),
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  return snap.docs[0].id
}

async function resolveContactId(opts: {
  contactId?: string | null
  phone?: string | null
}): Promise<string | null> {
  if (opts.contactId) return opts.contactId
  if (opts.phone) return findContactIdByPhone(opts.phone)
  return null
}

/** Mark contact Active when CRM work starts / continues. Deal → partner. */
export async function markContactActive(opts: {
  contactId?: string | null
  phone?: string | null
  asPartner?: boolean
}): Promise<void> {
  const id = await resolveContactId(opts)
  if (!id) return
  const patch: Record<string, unknown> = { status: 'active' as ContactStatus }
  if (opts.asPartner) patch.relation = 'partner' as ContactRelation
  await updateDocument('contacts', id, patch)
}

/** Create or update contact when a CRM lead is created. Always Active. */
export async function upsertContactFromLead(params: {
  name: string
  phone: string
  company?: string
  email?: string
  country?: string | null
  notes?: string
  source?: string | null
  exhibitionName?: string
  exhibitionDate?: string | null
  leadId: string
  userId: string
  userName: string
  asPartner?: boolean
}): Promise<string | null> {
  const phone = params.phone.trim()
  const phoneNormalized = normalizePhone(phone)
  if (!phoneNormalized) return null

  const existingId = await findContactIdByPhone(phone)
  const relation: ContactRelation = params.asPartner ? 'partner' : 'prospect'

  if (existingId) {
    const patch: Record<string, unknown> = {
      name: params.name.trim(),
      phone,
      phoneNormalized,
      company: (params.company || '').trim(),
      email: (params.email || '').trim(),
      country: params.country || null,
      notes: (params.notes || '').trim(),
      source: params.source || null,
      exhibitionName: (params.exhibitionName || '').trim(),
      exhibitionDate: params.exhibitionDate || null,
      status: 'active' as ContactStatus,
      lastLeadId: params.leadId,
    }
    if (params.asPartner) patch.relation = 'partner'
    await updateDocument('contacts', existingId, patch)
    return existingId
  }

  return createDocument('contacts', {
    name: params.name.trim(),
    phone,
    phoneNormalized,
    company: (params.company || '').trim(),
    email: (params.email || '').trim(),
    country: params.country || null,
    notes: (params.notes || '').trim(),
    source: params.source || null,
    exhibitionName: (params.exhibitionName || '').trim(),
    exhibitionDate: params.exhibitionDate || null,
    status: 'active' as ContactStatus,
    relation,
    buysWhat: '',
    lastLeadId: params.leadId,
    createdBy: params.userId,
    createdByName: params.userName,
  })
}
