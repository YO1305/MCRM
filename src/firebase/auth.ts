import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth } from './config'

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function signOut() {
  return firebaseSignOut(auth)
}

export type { FirebaseUser }
