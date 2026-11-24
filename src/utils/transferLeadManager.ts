import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { canAccessSection } from '@/constants/access'
import type { Client } from '@/types/client.types'
import type { User } from '@/types/user.types'

const BATCH_LIMIT = 400

export function userCanReceiveCrmLeads(user: User): boolean {
  if (user.isActive === false) return false
  return canAccessSection('crm', {
    isAdmin: user.role === 'admin',
    position: user.position,
    enabledSections: user.enabledSections,
  })
}

async function docsBy(
  collectionName: string,
  field: string,
  value: string,
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const snap = await getDocs(query(collection(db, collectionName), where(field, '==', value)))
  return snap.docs
}

async function commitUpdates(
  items: { collection: string; id: string; data: Record<string, unknown> }[],
) {
  for (let i = 0; i < items.length; i += BATCH_LIMIT) {
    const chunk = items.slice(i, i + BATCH_LIMIT)
    const batch = writeBatch(db)
    const stamp = serverTimestamp()
    for (const item of chunk) {
      batch.update(doc(db, item.collection, item.id), {
        ...item.data,
        updatedAt: stamp,
      })
    }
    await batch.commit()
  }
}

/**
 * Move a lead to another manager and rewrite that manager's attribution
 * (history, KPI, calls, AI tasks, contact createdBy) so KPI/CRM look as if
 * the new manager owned the work. Sales-manager fields stay as they are.
 */
export async function transferLeadManager(
  client: Client,
  to: { id: string; name: string },
): Promise<void> {
  const fromId = client.assignedTo
  const toId = to.id.trim()
  const toName = to.name.trim()
  if (!fromId || !toId || !toName) throw new Error('Не выбран менеджер')
  if (fromId === toId) throw new Error('Лид уже у этого менеджера')

  const [history, kpiLogs, callLogs, aiTasks] = await Promise.all([
    docsBy('client_history', 'clientId', client.id),
    docsBy('kpi_lead_log', 'clientId', client.id),
    docsBy('call_logs', 'clientId', client.id),
    docsBy('ai_tasks', 'clientId', client.id),
  ])

  const updates: { collection: string; id: string; data: Record<string, unknown> }[] = [
    {
      collection: 'clients',
      id: client.id,
      data: {
        assignedTo: toId,
        assignedToName: toName,
        ...(client.createdBy === fromId
          ? { createdBy: toId, createdByName: toName }
          : {}),
      },
    },
  ]

  for (const snap of history) {
    const authorId = snap.data().authorId as string | undefined
    if (authorId && authorId !== fromId) continue
    updates.push({
      collection: 'client_history',
      id: snap.id,
      data: { authorId: toId, authorName: toName },
    })
  }

  for (const snap of kpiLogs) {
    updates.push({
      collection: 'kpi_lead_log',
      id: snap.id,
      data: { assignedTo: toId, assignedToName: toName },
    })
  }

  for (const snap of callLogs) {
    const authorId = snap.data().authorId as string | undefined
    if (authorId && authorId !== fromId) continue
    updates.push({
      collection: 'call_logs',
      id: snap.id,
      data: { authorId: toId, authorName: toName },
    })
  }

  for (const snap of aiTasks) {
    updates.push({
      collection: 'ai_tasks',
      id: snap.id,
      data: { assignedTo: toId, assignedToName: toName },
    })
  }

  if (client.contactId) {
    const contactSnap = await getDoc(doc(db, 'contacts', client.contactId))
    if (contactSnap.exists() && contactSnap.data().createdBy === fromId) {
      updates.push({
        collection: 'contacts',
        id: contactSnap.id,
        data: { createdBy: toId, createdByName: toName },
      })
    }
  }

  await commitUpdates(updates)
}
