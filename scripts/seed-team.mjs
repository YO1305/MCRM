/**
 * Creates demo team members (Auth + Firestore profiles).
 *   node --env-file=.env.local scripts/seed-team.mjs
 */
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth'
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

const team = [
  {
    email: 'leads1@bahmal.uz',
    password: 'Bahmal2026!',
    name: 'Старший менеджер по лидам',
    role: 'employee',
    position: 'leads_manager_1',
  },
  {
    email: 'leads2@bahmal.uz',
    password: 'Bahmal2026!',
    name: 'Менеджер по лидам',
    role: 'employee',
    position: 'leads_manager_2',
  },
  {
    email: 'design@bahmal.uz',
    password: 'Bahmal2026!',
    name: 'Дизайнер',
    role: 'employee',
    position: 'designer',
  },
  {
    email: 'dev@bahmal.uz',
    password: 'Bahmal2026!',
    name: 'Менеджер по развитию',
    role: 'employee',
    position: 'dev_manager',
  },
  {
    email: 'assistant@bahmal.uz',
    password: 'Bahmal2026!',
    name: 'Ассистент',
    role: 'employee',
    position: 'assistant',
  },
]

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

for (const member of team) {
  try {
    let cred
    try {
      cred = await createUserWithEmailAndPassword(auth, member.email, member.password)
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? err.code : ''
      if (code !== 'auth/email-already-in-use') throw err
      cred = await signInWithEmailAndPassword(auth, member.email, member.password)
    }

    await updateProfile(cred.user, { displayName: member.name })
    await setDoc(
      doc(db, 'users', cred.user.uid),
      {
        id: cred.user.uid,
        name: member.name,
        email: member.email,
        role: member.role,
        position: member.position,
        isActive: true,
        createdAt: serverTimestamp(),
      },
      { merge: true },
    )
    console.log(`OK ${member.email} (${member.name})`)
    await signOut(auth)
  } catch (err) {
    console.error(`FAIL ${member.email}`, err)
  }
}

console.log('Done. Password for all demo users: Bahmal2026!')
process.exit(0)
