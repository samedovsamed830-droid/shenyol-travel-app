'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import {
  ArrowLeft,
  CreditCard,
  ShieldCheck,
  Check,
  Lock,
} from 'lucide-react'
import { ClownMascot } from '@/components/clown-mascot'
import { ShowBusTrack } from '@/components/show-bus-track'
import type { Tour } from '@/components/tour-card'
import { auth, db, isFirebaseConfigured } from '@/lib/firebase'
import { normalizeTourBuses } from '@/lib/seat-layout'
import { cn } from '@/lib/utils'

type BookingSnapshot = {
  tourId: string
  tourTitle: string
  busId: string
  busName: string
  tourDate?: string
  tourDateLabel?: string
  tourPrice: number
  unitPrice: number
  packageType: 'economy' | 'standard'
  seatCount: number
  totalPrice: number
  seats: string[]
  passengers: Array<{
    seat: string
    name: string
    surname: string
  }>
  passengerName: string
  phone: string
  bookedAt: string
  ticketCode: string
  userId: string
  userEmail: string
}

type StoredUser = {
  firstName?: string
  lastName?: string
  phone?: string
}

const LAST_BOOKING_KEY = 'shenyol-last-booking'

export function PaymentScreen({
  tour,
  selectedBusId,
  seats,
  selectedPackage,
  contact,
  onBack,
  onRestart,
}: {
  tour: Tour
  selectedBusId: string | null
  seats: string[]
  selectedPackage: 'economy' | 'standard'
  contact: string | null
  onBack: () => void
  onRestart: () => void
}) {
  const router = useRouter()
  const [status, setStatus] = useState<'form' | 'processing' | 'video'>('form')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [storedUser, setStoredUser] = useState<StoredUser | null>(null)
  const [passengers, setPassengers] = useState<Array<{ seat: string; name: string; surname: string }>>([])
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const unitPrice = selectedPackage === 'economy'
    ? Number(tour.priceEconomy ?? tour.price ?? 0)
    : Number(tour.priceStandard ?? tour.price ?? 0)
  const total = seats.length * unitPrice
  const displayTourDate = tour.dateLabel?.trim() || (tour.date ? new Date(tour.date).toLocaleDateString('az-AZ') : '')
  const displayContact = contact ?? storedUser?.phone ?? ''

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16)
    return digits.replace(/(.{4})/g, '$1 ').trim()
  }

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    if (digits.length <= 2) {
      return digits
    }
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }

  const handleCardNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCardNumber(formatCardNumber(event.target.value))
  }

  const handleExpiryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setExpiry(formatExpiry(event.target.value))
  }

  const handleCvcChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 4)
    setCvc(digits)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = window.localStorage.getItem('shenyol-current-user')
      if (!stored) return
      setStoredUser(JSON.parse(stored) as StoredUser)
    } catch {
      setStoredUser(null)
    }
  }, [])

  useEffect(() => {
    setPassengers((prev) =>
      seats.map((seat, index) => {
        const existing = prev.find((item) => item.seat === seat)
        if (existing) return existing

        return {
          seat,
          name: index === 0 ? String(storedUser?.firstName ?? '').trim() : '',
          surname: index === 0 ? String(storedUser?.lastName ?? '').trim() : '',
        }
      }),
    )
  }, [seats, storedUser?.firstName, storedUser?.lastName])

  const handlePassengerChange = (
    seat: string,
    field: 'name' | 'surname',
    value: string,
  ) => {
    setPassengers((prev) =>
      prev.map((item) =>
        item.seat === seat
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    )
  }

  const isPassengerFormValid =
    passengers.length === seats.length &&
    passengers.every((item) => item.name.trim().length > 1 && item.surname.trim().length > 1)

  const isCardValid =
    cardNumber.replace(/\s/g, '').length === 16 &&
    /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry) &&
    cvc.length >= 3

  const isPaymentInputValid = isCardValid

  const canSubmitPayment = seats.length > 0 && isPassengerFormValid && isPaymentInputValid

  const handlePaymentVideoComplete = () => {
    router.push('/ticket')
  }

  useEffect(() => {
    if (status !== 'video') return

    const timeoutId = window.setTimeout(() => {
      router.push('/ticket')
    }, 6200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [status, router])

  const pay = () => {
    if (!canSubmitPayment) return

    setPaymentError(null)
    setStatus('processing')
    ;(async () => {
      if (typeof window !== 'undefined') {
        const normalizedPassengers = seats.map((seat) => {
          const current = passengers.find((item) => item.seat === seat)
          return {
            seat,
            name: String(current?.name ?? '').trim(),
            surname: String(current?.surname ?? '').trim(),
          }
        })

        const firstPassenger = normalizedPassengers[0]
        const passengerName = firstPassenger
          ? `${firstPassenger.name} ${firstPassenger.surname}`.trim()
          : 'Guest Passenger'
        const generatedTicketCode = `SHN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-6)}`

        const booking: BookingSnapshot = {
          tourId: tour.id,
          tourTitle: tour.title ?? 'Selected tour',
          busId: selectedBusId ?? tour.buses?.[0]?.id ?? 'bus_1',
          busName: tour.buses?.find((bus) => bus.id === selectedBusId)?.name ?? 'Avtobus 1',
          tourDate: typeof tour.date === 'string' ? tour.date : '',
          tourDateLabel: typeof tour.dateLabel === 'string' ? tour.dateLabel : '',
          tourPrice: unitPrice,
          unitPrice,
          packageType: selectedPackage,
          seatCount: seats.length,
          totalPrice: total,
          seats,
          passengers: normalizedPassengers,
          passengerName,
          phone: displayContact,
          bookedAt: new Date().toISOString(),
          ticketCode: generatedTicketCode,
          userId: auth?.currentUser?.uid ?? '',
          userEmail: auth?.currentUser?.email ?? '',
        }

        window.localStorage.setItem(LAST_BOOKING_KEY, JSON.stringify(booking))
        window.localStorage.setItem('shenyol-ticket-ready', 'true')

        let bookingPersisted = false
        let shouldTryClientFallback = false

        try {
          const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(booking),
          })

          const result = (await response.json().catch(() => ({}))) as {
            ok?: boolean
            skipped?: boolean
            reason?: string
            error?: string
          }

          if (response.ok && result.ok === true) {
            bookingPersisted = true
          } else if (response.ok && result.skipped) {
            shouldTryClientFallback = true
          } else {
            throw new Error(result.error ?? result.reason ?? 'Booking API write failed')
          }
        } catch (apiError) {
          shouldTryClientFallback = true
          console.error('Booking API write failed:', apiError)
        }

        if (!bookingPersisted && shouldTryClientFallback && db && isFirebaseConfigured) {
          try {
            await addDoc(collection(db, 'bookings'), {
              ...booking,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
            bookingPersisted = true
          } catch (fallbackError) {
            console.error('Booking Firestore fallback failed:', fallbackError)
          }
        }

        if (!bookingPersisted) {
          setStatus('form')
          setPaymentError('Rezervasiya Firestore-a yazilmadi. Zehmet olmasa yeniden cehd edin.')
          return
        }

        if (db && isFirebaseConfigured && seats.length > 0) {
          try {
            const targetBusId = selectedBusId ?? tour.buses?.[0]?.id ?? 'bus_1'
            const snapshot = await getDoc(doc(db, 'tours', tour.id))

            if (snapshot.exists()) {
              const data = snapshot.data() as {
                buses?: unknown
                seatsAvailable?: unknown
                bookedSeats?: unknown
              }

              const buses = normalizeTourBuses(
                data.buses,
                Number(data.seatsAvailable ?? tour.seatsAvailable ?? 20),
                data.bookedSeats,
              )

              const nextBuses = buses.map((bus) =>
                bus.id === targetBusId
                  ? {
                      ...bus,
                      seats: [...new Set([...bus.seats, ...seats])],
                    }
                  : bus,
              )

              const primaryBus = nextBuses[0]

              await updateDoc(doc(db, 'tours', tour.id), {
                buses: nextBuses,
                seatsAvailable: primaryBus?.capacity ?? Number(data.seatsAvailable ?? 20),
                bookedSeats: primaryBus?.seats ?? [],
              })
            }
          } catch {
            // keep checkout flow resilient even if remote sync fails
          }
        }
      }

      setStatus('video')
    })()
  }

  if (status === 'video') {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-black px-0 py-0">
        <video
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={handlePaymentVideoComplete}
          onError={handlePaymentVideoComplete}
          className="h-full min-h-full w-full object-cover"
        >
          <source src="/images/odeme.mp4" type="video/mp4" />
        </video>
      </div>
    )
  }

  if (status === 'processing') {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        <ClownMascot size={140} />
        <div className="w-full max-w-xs space-y-3">
          <ShowBusTrack label="Securing your seats…" />
          <p className="text-sm text-muted-foreground">
            Encrypting payment • Please wait
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col gap-5 px-5 pb-40 pt-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="flex size-10 items-center justify-center rounded-xl border border-border bg-card transition-transform active:scale-90"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="font-heading text-xl font-extrabold">Secure payment</h1>
      </header>

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="font-heading text-lg font-bold">{tour.title}</h2>
        <p className="text-sm text-muted-foreground">{tour.location}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {seats.map((s) => (
            <span
              key={s}
              className="rounded-lg bg-gradient-to-br from-brand-pink to-brand-purple px-2.5 py-1 text-xs font-bold text-primary-foreground"
            >
              {s}
            </span>
          ))}
        </div>
        <div className="mt-4 space-y-2 border-t border-dashed border-border pt-4 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Paket</span>
            <span>{selectedPackage === 'economy' ? 'Ekonom' : 'Standart'}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>
              {seats.length} × {unitPrice} AZN
            </span>
            <span>{total} AZN</span>
          </div>
          {displayContact ? (
            <div className="flex justify-between text-muted-foreground">
              <span>Contact</span>
              <span>{displayContact}</span>
            </div>
          ) : null}
          {displayTourDate ? (
            <div className="flex justify-between text-muted-foreground">
              <span>Tur tarixi</span>
              <span>{displayTourDate}</span>
            </div>
          ) : null}
          <div className="flex justify-between font-heading text-lg font-extrabold">
            <span>Total</span>
            <span className="text-brand-pink">{total} AZN</span>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border border-border bg-card p-5">
        <div>
          <h2 className="font-heading text-lg font-bold">Sərnişin məlumatları</h2>
          <p className="text-sm text-muted-foreground">Hər seçilmiş oturacaq üçün ad və soyad daxil edin.</p>
        </div>
        <div className="space-y-3">
          {seats.map((seat, index) => {
            const passenger = passengers.find((item) => item.seat === seat)

            return (
              <div key={seat} className="rounded-2xl border border-border bg-background p-4">
                <p className="mb-3 text-sm font-semibold text-foreground">{index + 1}. sərnişin • Oturacaq {seat}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold">Ad</span>
                    <input
                      value={passenger?.name ?? ''}
                      onChange={(event) => handlePassengerChange(seat, 'name', event.target.value)}
                      placeholder="Ad"
                      className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold">Soyad</span>
                    <input
                      value={passenger?.surname ?? ''}
                      onChange={(event) => handlePassengerChange(seat, 'surname', event.target.value)}
                      placeholder="Soyad"
                      className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Card number</span>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
            <CreditCard className="size-5 text-brand-purple" />
            <input
              value={cardNumber}
              onChange={handleCardNumberChange}
              inputMode="numeric"
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              autoComplete="cc-number"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </label>
        <div className="flex gap-3">
          <label className="block flex-1">
            <span className="mb-1.5 block text-sm font-semibold">Expiry</span>
            <input
              value={expiry}
              onChange={handleExpiryChange}
              inputMode="numeric"
              placeholder="MM/YY"
              maxLength={5}
              autoComplete="cc-exp"
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <label className="block w-24">
            <span className="mb-1.5 block text-sm font-semibold">CVC</span>
            <input
              value={cvc}
              onChange={handleCvcChange}
              inputMode="numeric"
              placeholder="123"
              maxLength={4}
              autoComplete="cc-csc"
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
      </section>

      {paymentError ? (
        <div className="rounded-2xl border border-[#ff5fa9]/30 bg-[#2b1024] px-4 py-3 text-sm text-[#ff9ac8]">
          {paymentError}
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-8 min-w-[68px] items-center justify-center rounded-md border border-border bg-white px-2 text-[11px] font-extrabold tracking-wide text-[#1a1f71]">
            VISA
          </span>

          <span className="inline-flex h-8 min-w-[92px] items-center justify-center rounded-md border border-border bg-white px-2">
            <svg viewBox="0 0 72 24" aria-hidden="true" className="h-4 w-16">
              <circle cx="27" cy="12" r="8" fill="#eb001b" />
              <circle cx="37" cy="12" r="8" fill="#f79e1b" fillOpacity="0.9" />
              <text x="54" y="15" textAnchor="middle" fontSize="7" fontWeight="700" fill="#222">MC</text>
            </svg>
          </span>

          <span className="inline-flex h-8 min-w-[92px] items-center justify-center rounded-md border border-border bg-white px-2">
            <svg viewBox="0 0 76 24" aria-hidden="true" className="h-4 w-16">
              <circle cx="26" cy="12" r="8" fill="#1f5aa6" />
              <circle cx="36" cy="12" r="8" fill="#00a3e0" fillOpacity="0.95" />
              <text x="56" y="15" textAnchor="middle" fontSize="7" fontWeight="700" fill="#222">Maestro</text>
            </svg>
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Guvenli onlayn odenis (3D Secure xidmeti desteklenir)
        </p>
      </section>

      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5" />
        256-bit encrypted • Powered by Shenyol Pay
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
        <Link href="/terms" className="underline-offset-4 transition hover:text-foreground hover:underline">
          Istifadeci sertleri
        </Link>
        <span className="text-muted-foreground/60">|</span>
        <Link href="/privacy" className="underline-offset-4 transition hover:text-foreground hover:underline">
          Mexfilik siyaseti
        </Link>
        <span className="text-muted-foreground/60">|</span>
        <Link href="/refund" className="underline-offset-4 transition hover:text-foreground hover:underline">
          Geri qaytarma
        </Link>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={pay}
          disabled={!canSubmitPayment}
          className={cn(
            'glass pointer-events-auto touch-manipulation flex w-full max-w-md items-center justify-center gap-2 rounded-3xl border border-border/60 bg-primary/95 px-6 py-4 text-base font-semibold text-primary-foreground shadow-[0_-8px_40px_-12px_rgba(120,50,180,0.4)] transition-transform active:scale-95',
            !canSubmitPayment && 'cursor-not-allowed opacity-60',
          )}
        >
          <ShieldCheck className="size-5" />
          Pay {total} AZN
          <Check className="size-5" />
        </button>
      </div>
    </div>
  )
}
