import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, indexedDBLocalPersistence, initializeAuth, type Auth } from 'firebase/auth'
import { getFirestore, initializeFirestore, setLogLevel, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const requiredFirebaseKeys: Array<keyof typeof firebaseConfig> = [
  'apiKey',
  'authDomain',
  'projectId',
  'messagingSenderId',
  'appId',
]

const missingFirebaseKeys = requiredFirebaseKeys.filter((key) => !firebaseConfig[key])
const isFirebaseConfigured = missingFirebaseKeys.length === 0

if (!isFirebaseConfigured && typeof window !== 'undefined') {
  console.warn(
    `[Firebase] Missing environment variables: ${missingFirebaseKeys.map((key) => `NEXT_PUBLIC_FIREBASE_${key.toUpperCase()}`).join(', ')}`,
  )
}

const app: FirebaseApp | null = isFirebaseConfigured
  ? !getApps().length
    ? initializeApp(firebaseConfig)
    : getApp()
  : null

const auth: Auth | null = (() => {
  if (!app || typeof window === 'undefined') {
    return null
  }

  try {
    return initializeAuth(app, {
      persistence: indexedDBLocalPersistence,
    })
  } catch {
    return getAuth(app)
  }
})()

const db: Firestore | null = (() => {
  if (!app) return null

  setLogLevel('error')

  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    })
  } catch {
    return getFirestore(app)
  }
})()

export { app, auth, db, firebaseConfig, isFirebaseConfigured }
