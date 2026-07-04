import { FieldValue } from 'firebase-admin/firestore'
import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export const runtime = 'nodejs'

type IncomingPassenger = {
  seat?: unknown
  name?: unknown
  surname?: unknown
}

type IncomingBooking = {
  tourId?: unknown
  tourTitle?: unknown
  busId?: unknown
  busName?: unknown
  tourDate?: unknown
  tourDateLabel?: unknown
  unitPrice?: unknown
  packageType?: unknown
  seatCount?: unknown
  totalPrice?: unknown
  phone?: unknown
  bookedAt?: unknown
  ticketCode?: unknown
  passengers?: unknown
  userId?: unknown
  userEmail?: unknown
}

const isConfigured =
  Boolean(process.env.FIREBASE_PROJECT_ID) &&
  Boolean(process.env.FIREBASE_CLIENT_EMAIL) &&
  Boolean(process.env.FIREBASE_PRIVATE_KEY)

export async function POST(request: Request) {
  try {
    if (!isConfigured) {
      return NextResponse.json(
        {
          ok: false,
          skipped: true,
          reason: 'Server-side Firebase Admin environment variables are missing.',
        },
        { status: 200 },
      )
    }

    const body = (await request.json()) as IncomingBooking

    const tourId = String(body.tourId ?? '').trim()
    const tourTitle = String(body.tourTitle ?? '').trim()
    const busId = String(body.busId ?? '').trim()
    const busName = String(body.busName ?? '').trim()
    const phone = String(body.phone ?? '').trim()
    const bookedAt = String(body.bookedAt ?? '').trim() || new Date().toISOString()
    const ticketCode = String(body.ticketCode ?? '').trim()
    const tourDate = String(body.tourDate ?? '').trim()
    const tourDateLabel = String(body.tourDateLabel ?? '').trim()
    const unitPrice = Number(body.unitPrice ?? 0)
    const packageType = String(body.packageType ?? '').trim() || 'economy'
    const seatCount = Number(body.seatCount ?? 0)
    const totalPrice = Number(body.totalPrice ?? 0)

    const userId = String(body.userId ?? '').trim()
    const userEmail = String(body.userEmail ?? '').trim()

    const parsedPassengers = Array.isArray(body.passengers)
      ? body.passengers
          .map((passenger) => {
            const source = passenger as IncomingPassenger
            return {
              seat: String(source.seat ?? '').trim(),
              name: String(source.name ?? '').trim(),
              surname: String(source.surname ?? '').trim(),
            }
          })
          .filter((passenger) => passenger.seat && passenger.name && passenger.surname)
      : []

    if (!tourId || !tourTitle || !busId || parsedPassengers.length === 0 || !ticketCode) {
      return NextResponse.json({ error: 'Missing required booking fields.' }, { status: 400 })
    }

    const bookingPayload = {
      tourId,
      tourTitle,
      busId,
      busName,
      tourDate,
      tourDateLabel,
      unitPrice,
      packageType,
      seatCount,
      totalPrice,
      phone,
      bookedAt,
      ticketCode,
      passengers: parsedPassengers,
      userId,
      userEmail,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    const created = await adminDb.collection('bookings').add(bookingPayload)

    return NextResponse.json({ ok: true, id: created.id }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Booking could not be created.' }, { status: 500 })
  }
}
