import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Env values may contain stray whitespace when pasted into Vercel — always trim.
function env(value: string | undefined): string {
  return (value ?? '').trim()
}

export const firebaseConfig = {
  apiKey: env(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: env(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: env(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: env(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: env(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: env(import.meta.env.VITE_FIREBASE_APP_ID),
  measurementId: env(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID),
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Long polling is more reliable on some networks than WebChannel.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
})

export const storage = getStorage(app)
