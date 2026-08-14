/**
 * Fixes admin Firestore profile (UTF-8 safe).
 *   node --env-file=.env.local scripts/fix-admin-profile.mjs
 */
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore'

const email = process.env.ADMIN_EMAIL || 'admin@bahmal.uz'
const password = process.env.ADMIN_PASSWORD || 'BahmalAdmin2026!'
const name = process.env.ADMIN_NAME || 'Начальник отдела'

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

const cred = await signInWithEmailAndPassword(auth, email, password)
await updateProfile(cred.user, { displayName: name })

await setDoc(
  doc(db, 'users', cred.user.uid),
  {
    id: cred.user.uid,
    name,
    email,
    role: 'admin',
    position: 'head',
    isActive: true,
    updatedAt: serverTimestamp(),
  },
  { merge: true },
)

console.log('Admin profile fixed:')
console.log(`  uid: ${cred.user.uid}`)
console.log(`  name: ${name}`)
console.log(`  role: admin / head`)
process.exit(0)
