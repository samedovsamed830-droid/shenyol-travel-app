import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, initializeFirestore, setLogLevel } from 'firebase/firestore'

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
    `[Firebase] Missing environment variables: ${missingFirebaseKeys
      .map((key) => `NEXT_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`)
      .join(', ')}`,
  )
}

const app = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null

const db = (() => {
  if (!app) return null

  // Suppress verbose transport warnings during temporary network changes.
  setLogLevel('error')

  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    })
  } catch {
    return getFirestore(app)
  }
})()
const auth = app ? getAuth(app) : null

export { app, auth, db, firebaseConfig, isFirebaseConfigured }
