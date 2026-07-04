import { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isAdminSession } from '@/lib/firebase-admin'

const SESSION_COOKIE_NAME = '__session'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const hasAdminEnv =
    Boolean(process.env.FIREBASE_PROJECT_ID) &&
    Boolean(process.env.FIREBASE_CLIENT_EMAIL) &&
    Boolean(process.env.FIREBASE_PRIVATE_KEY)

  if (!hasAdminEnv) {
    return <>{children}</>
  }

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!sessionCookie) {
    redirect('/')
  }

  const canAccess = await isAdminSession(sessionCookie)
  if (!canAccess) {
    redirect('/')
  }

  return <>{children}</>
}
