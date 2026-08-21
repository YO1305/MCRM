import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  getDocs,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './config'

export async function getDocument<T>(collectionName: string, id: string): Promise<T | null> {
  const snap = await getDoc(doc(db, collectionName, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as T
}

export function subscribeToDocument<T>(
  collectionName: string,
  id: string,
  callback: (data: T | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, collectionName, id),
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null)
        return
      }
      callback({ id: snapshot.id, ...snapshot.data() } as T)
    },
    (error) => onError?.(error),
  )
}

export function subscribeToCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[],
  callback: (data: T[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, collectionName), ...constraints)
  return onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T)
      callback(data)
    },
    (error) => onError?.(error),
  )
}

export function subscribeToSubcollection<T>(
  collectionName: string,
  docId: string,
  subcollection: string,
  callback: (data: T[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, collectionName, docId, subcollection))
  return onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T)
      callback(data)
    },
    (error) => onError?.(error),
  )
}

export async function createDocument<T extends Record<string, unknown>>(
  collectionName: string,
  data: T,
): Promise<string> {
  const ref = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function createSubdocument<T extends Record<string, unknown>>(
  collectionName: string,
  docId: string,
  subcollection: string,
  data: T,
): Promise<string> {
  const ref = await addDoc(collection(db, collectionName, docId, subcollection), {
    ...data,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function queryCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[],
): Promise<T[]> {
  const snap = await getDocs(query(collection(db, collectionName), ...constraints))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)
}

/** Create-or-skip by fixed id (for notification dedupe). */
export async function setDocumentIfMissing(
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  const ref = doc(db, collectionName, id)
  const existing = await getDoc(ref)
  if (existing.exists()) return false
  await setDoc(ref, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return true
}

export async function setDocument(
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  await setDoc(
    doc(db, collectionName, id),
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function updateDocument(
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  await updateDoc(doc(db, collectionName, id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function removeDocument(collectionName: string, id: string): Promise<void> {
  await deleteDoc(doc(db, collectionName, id))
}

export type { DocumentData }
