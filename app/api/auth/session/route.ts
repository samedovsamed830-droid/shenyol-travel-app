import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createAdminSessionCookie, isFirebaseAdminConfigured } from '@/lib/firebase-admin'

const SESSION_COOKIE_NAME = '__session'

export async function POST(request: Request) {
  try {
    if (!isFirebaseAdminConfigured) {
      return NextResponse.json(
        {
          ok: false,
          skipped: true,
          reason: 'Server-side Firebase Admin environment variables are missing.',
        },
        { status: 200 },
      )
    }

    const body = (await request.json()) as { idToken?: string }
    const idToken = body?.idToken?.trim()

    if (!idToken) {
      return NextResponse.json({ error: 'idToken is required.' }, { status: 400 })
    }

    const sessionCookie = await createAdminSessionCookie(idToken)
    const cookieStore = await cookies()

    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 5,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Session cookie could not be created.' }, { status: 401 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  return NextResponse.json({ ok: true })
}
