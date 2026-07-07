import * as admin from 'firebase-admin';

// Əgər admin artıq initialize olunubsa, onu qaytar
const app = !admin.apps.length 
  ? admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID?.trim(),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.trim(),
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
  : admin.app();

export const adminAuth = admin.auth(app);
export const adminDb = admin.firestore(app);
export const isFirebaseAdminConfigured = Boolean(
  process.env.FIREBASE_PROJECT_ID && 
  process.env.FIREBASE_CLIENT_EMAIL && 
  process.env.FIREBASE_PRIVATE_KEY
);

// Sənin digər funksiyaların (isAdminSession və s.) burada qalsın...
export async function isAdminSession(sessionCookie: string): Promise<boolean> {
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const email = String(decoded.email ?? '').toLowerCase();
    const allowlist = String(process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase());
    return decoded.admin === true || (email ? allowlist.includes(email) : false);
  } catch {
    return false;
  }
}

export async function createAdminSessionCookie(idToken: string): Promise<string> {
  return adminAuth.createSessionCookie(idToken, { expiresIn: 60 * 60 * 24 * 5 * 1000 });
}