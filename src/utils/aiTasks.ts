import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { updateDocument } from '@/firebase/firestore'

/** Close open AI tasks when manager already planned next step on the client. */
export async function dismissPendingAiTasksForClient(clientId: string): Promise<number> {
  const q = query(
    collection(db, 'ai_tasks'),
    where('clientId', '==', clientId),
    where('status', '==', 'pending'),
  )
  const snap = await getDocs(q)
  let n = 0
  for (const docSnap of snap.docs) {
    await updateDocument('ai_tasks', docSnap.id, {
      status: 'done',
      doneAt: new Date().toISOString(),
      dismissReason: 'next_step_planned',
    })
    n += 1
  }
  return n
}

/** Close open AI tasks for a manager on vacation / task pause. */
export async function dismissPendingAiTasksForManager(managerId: string): Promise<number> {
  const q = query(
    collection(db, 'ai_tasks'),
    where('assignedTo', '==', managerId),
    where('status', '==', 'pending'),
  )
  const snap = await getDocs(q)
  let n = 0
  for (const docSnap of snap.docs) {
    await updateDocument('ai_tasks', docSnap.id, {
      status: 'done',
      doneAt: new Date().toISOString(),
      dismissReason: 'manager_on_vacation',
    })
    n += 1
  }
  return n
}
