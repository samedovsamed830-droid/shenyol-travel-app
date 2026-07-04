import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

const adminApp = getApps().length
  ? getApps()[0]
  : initializeApp(
      projectId && clientEmail && privateKey
        ? {
            credential: cert({
              projectId,
              clientEmail,
              privateKey,
            }),
          }
        : undefined,
    )

const adminAuth = getAuth(adminApp)
const adminDb = getFirestore(adminApp)

const parseAdminEmails = () =>
  String(process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

export async function isAdminSession(sessionCookie: string): Promise<boolean> {
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
  return adminAuth.createSessionCookie(idToken, {
    expiresIn: 60 * 60 * 24 * 5 * 1000,
  })
}

export { adminDb }
