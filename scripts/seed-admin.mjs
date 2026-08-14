/**
 * Creates Auth user + Firestore /users/{uid} profile.
 * Run AFTER Auth (Email/Password) and Firestore are enabled in Console:
 *   node scripts/seed-admin.mjs
 */
import { initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
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

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Missing Firebase env. Load .env.local first.')
  process.exit(1)
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

const cred = await createUserWithEmailAndPassword(auth, email, password)
await updateProfile(cred.user, { displayName: name })

await setDoc(doc(db, 'users', cred.user.uid), {
  id: cred.user.uid,
  name,
  email,
  role: 'admin',
  position: 'head',
  isActive: true,
  createdAt: serverTimestamp(),
})

console.log('Admin created:')
console.log(`  uid: ${cred.user.uid}`)
console.log(`  email: ${email}`)
console.log(`  password: ${password}`)
console.log('Add the same VITE_* vars in Vercel → Project → Settings → Environment Variables')
process.exit(0)
