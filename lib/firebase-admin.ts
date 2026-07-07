import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

const isFirebaseAdminConfigured = Boolean(projectId && clientEmail && privateKey)

const adminApp: App | null = isFirebaseAdminConfigured
  ? getApps().length
    ? getApps()[0]
    : initializeApp(
        cert({
          projectId: projectId!,
          clientEmail: clientEmail!,
          privateKey: privateKey!,
        }),
      )
  : null

const adminAuth: Auth | null = adminApp ? getAuth(adminApp) : null
const adminDb: Firestore | null = adminApp ? getFirestore(adminApp) : null

const parseAdminEmails = () =>
  String(process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

export async function isAdminSession(sessionCookie: string): Promise<boolean> {
  if (!adminAuth) {
    return false
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    const email = String(decoded.email ?? '').toLowerCase()
    const allowlist = parseAdminEmails()
    return decoded.admin === true || (email ? allowlist.includes(email) : false)
  } catch {
    return false
  }
}

export async function createAdminSessionCookie(idToken: string): Promise<string> {
  if (!adminAuth) {
    throw new Error('Server-side Firebase Admin environment variables are missing.')
  }

  return adminAuth.createSessionCookie(idToken, {
    expiresIn: 60 * 60 * 24 * 5 * 1000,
  })
}

export { adminDb, isFirebaseAdminConfigured }
