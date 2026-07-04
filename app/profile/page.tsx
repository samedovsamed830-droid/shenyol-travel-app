'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { arrayRemove, arrayUnion, collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { Download } from 'lucide-react'
import { auth, db, isFirebaseConfigured } from '@/lib/firebase'
import { TourCard, type Tour } from '@/components/tour-card'
import { normalizeTourBuses } from '@/lib/seat-layout'
import { I18nProvider } from '@/lib/i18n'

type ProfileData = {
  firstName: string
  lastName: string
  phone: string
}

type Booking = {
  id: string
  tourId: string
  tourTitle: string
  tourDate: string
  tourDateLabel: string
  packageType: string
  passengers: Array<{ seat: string; name: string; surname: string }>
  ticketCode: string
  unitPrice: number
  totalPrice: number
  busName: string
  phone: string
  bookedAt: string
}

/**
 * Robust date parser. Always returns a Date at LOCAL midnight so it can be
 * compared directly with todayMidnight (which is also local midnight).
 * Handles:
 *   - Firestore Timestamp objects
 *   - YYYY-MM-DD  (HTML <input type="date"> output)
 *   - YYYY-MM-DDTHH:MM:SS… (ISO datetime — strips time, uses local date)
 *   - DD.MM.YYYY  (Azerbaijani display format)
 */
const parseBookingDate = (value: unknown): Date | null => {
  if (!value) return null

  // Firestore Timestamp
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    const d = (value as { toDate: () => Date }).toDate()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }

  const str = String(value).trim()
  if (!str) return null

  // YYYY-MM-DD or YYYY-MM-DDTHH:MM… — parse as LOCAL midnight to avoid UTC offset
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const [, y, m, d] = iso
    return new Date(Number(y), Number(m) - 1, Number(d))
  }

  // DD.MM.YYYY
  const dmy = str.match(/^(\d{2})\.(\d{2})\.(\d{4})/)
  if (dmy) {
    const [, d, m, y] = dmy
    return new Date(Number(y), Number(m) - 1, Number(d))
  }

  // Last-resort fallback — normalise to local midnight to stay consistent
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  }

  return null
}

type TabId = 'tickets' | 'favorites'

const PENDING_RESERVE_TOUR_KEY = 'shenyol-pending-reserve-tour-id'
const PENDING_RESERVE_ACTION_KEY = 'shenyol-pending-reserve-action'

const adminEmailAllowlist = String(process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)

const inferLocationFromTitle = (title: string): string => {
  if (!title.trim()) return 'Azərbaycan'
  return 'Azərbaycan'
}

const normalizeProgramItems = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

const normalizeTourFromFirestore = (tourId: string, data: Partial<Tour> & { name?: string }): Tour => {
  const resolvedTitle = data.title ?? data.name ?? ''
  const resolvedLocation = data.location ?? inferLocationFromTitle(resolvedTitle)

  return {
    id: tourId,
    titleKey: data.titleKey,
    title: resolvedTitle,
    locationKey: data.locationKey,
    location: resolvedLocation,
    durationKey: data.durationKey ?? 'tour.duration.1day',
    duration: data.duration,
    meetingPoint: typeof data.meetingPoint === 'string' ? data.meetingPoint : '',
    date: typeof data.date === 'string' ? data.date : '',
    dateLabel: typeof data.dateLabel === 'string' ? data.dateLabel : '',
    program: {
      enabled: Boolean(data.program?.enabled),
      includedItems: normalizeProgramItems(data.program?.includedItems),
      placesItems: normalizeProgramItems(data.program?.placesItems),
      scheduleGathering: typeof data.program?.scheduleGathering === 'string' ? data.program.scheduleGathering : '',
      scheduleDeparture: typeof data.program?.scheduleDeparture === 'string' ? data.program.scheduleDeparture : '',
      scheduleReturn: typeof data.program?.scheduleReturn === 'string' ? data.program.scheduleReturn : '',
      notesItems: normalizeProgramItems(data.program?.notesItems),
    },
    description: data.description,
    priceEconomy: Number(data.priceEconomy ?? data.price ?? 25),
    priceStandard: Number(data.priceStandard ?? data.price ?? 40),
    featuresEconomy: Array.isArray(data.featuresEconomy) ? data.featuresEconomy.map((item) => String(item)) : [],
    featuresStandard: Array.isArray(data.featuresStandard) ? data.featuresStandard.map((item) => String(item)) : [],
    rating: Number(data.rating ?? 4.9),
    reviews: Number(data.reviews ?? 0),
    image: data.image ?? '/images/gabala-tour.png',
    seatsAvailable: Number(data.seatsAvailable ?? 20),
    bookedSeats: Array.isArray(data.bookedSeats) ? data.bookedSeats.map((seat) => String(seat)) : [],
    buses: normalizeTourBuses(
      (data as Partial<Tour> & { buses?: unknown }).buses,
      Number(data.seatsAvailable ?? 20),
      data.bookedSeats,
    ),
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [profile, setProfile] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    phone: '',
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('tickets')
  const [favoriteTourIds, setFavoriteTourIds] = useState<string[]>([])
  const [allTours, setAllTours] = useState<Tour[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])

  useEffect(() => {
    if (!auth) {
      router.replace('/login')
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        router.replace('/login')
        return
      }

      setUser(nextUser)
      try {
        const tokenResult = await nextUser.getIdTokenResult(true)
        const hasAdminClaim = Boolean(tokenResult.claims.admin)
        const email = String(nextUser.email ?? '').toLowerCase()
        const hasAllowlistedEmail = email ? adminEmailAllowlist.includes(email) : false
        setIsAdmin(hasAdminClaim || hasAllowlistedEmail)

        if (hasAdminClaim || hasAllowlistedEmail) {
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken: tokenResult.token }),
          })
        }
      } catch {
        const email = String(nextUser.email ?? '').toLowerCase()
        setIsAdmin(email ? adminEmailAllowlist.includes(email) : false)
      }

      if (db) {
        const snapshot = await getDoc(doc(db, 'users', nextUser.uid))
        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<ProfileData> & { favorites?: unknown }
          setProfile({
            firstName: String(data.firstName ?? ''),
            lastName: String(data.lastName ?? ''),
            phone: String(data.phone ?? ''),
          })
          setFavoriteTourIds(Array.isArray(data.favorites) ? data.favorites.map((item) => String(item)).filter(Boolean) : [])
        }
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  useEffect(() => {
    if (!db || !isFirebaseConfigured || !user) return

    const userRef = doc(db, 'users', user.uid)
    const unsubscribeUser = onSnapshot(userRef, (snapshot) => {
      if (!snapshot.exists()) {
        setFavoriteTourIds([])
        return
      }

      const data = snapshot.data() as { favorites?: unknown }
      const nextFavorites = Array.isArray(data.favorites)
        ? data.favorites.map((item) => String(item)).filter(Boolean)
        : []

      setFavoriteTourIds(nextFavorites)
    })

    return () => unsubscribeUser()
  }, [user])

  useEffect(() => {
    if (!db || !isFirebaseConfigured) {
      setAllTours([])
      return
    }

    const unsubscribeTours = onSnapshot(collection(db, 'tours'), (snapshot) => {
      const mapped = snapshot.docs.map((tourDoc) =>
        normalizeTourFromFirestore(tourDoc.id, tourDoc.data() as Partial<Tour> & { name?: string }),
      )
      setAllTours(mapped)
    })

    return () => unsubscribeTours()
  }, [])

  useEffect(() => {
    if (!db || !isFirebaseConfigured || !user) {
      setBookings([])
      return
    }

    const bookingsQuery = query(collection(db, 'bookings'), where('userId', '==', user.uid))
    const unsubscribeBookings = onSnapshot(bookingsQuery, (snapshot) => {
      const mapped = snapshot.docs.map((bookingDoc) => {
        const data = bookingDoc.data() as Partial<Booking>
        return {
          id: bookingDoc.id,
          tourId: String(data.tourId ?? ''),
          tourTitle: String(data.tourTitle ?? ''),
          tourDate: String(data.tourDate ?? ''),
          tourDateLabel: String(data.tourDateLabel ?? ''),
          packageType: String(data.packageType ?? 'economy'),
          passengers: Array.isArray(data.passengers) ? data.passengers as Booking['passengers'] : [],
          ticketCode: String(data.ticketCode ?? ''),
          unitPrice: Number(data.unitPrice ?? data.totalPrice ?? 0),
          totalPrice: Number(data.totalPrice ?? 0),
          busName: String(data.busName ?? ''),
          phone: String(data.phone ?? ''),
          bookedAt: String(data.bookedAt ?? ''),
        } satisfies Booking
      })
      setBookings(mapped)
    })

    return () => unsubscribeBookings()
  }, [user])

  const todayMidnight = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const activeBookings = useMemo(
    () =>
      bookings.filter((b) => {
        const d = parseBookingDate(b.tourDate)
        return !d || d >= todayMidnight
      }),
    [bookings, todayMidnight],
  )

  const pastBookings = useMemo(
    () =>
      bookings.filter((b) => {
        const d = parseBookingDate(b.tourDate)
        return d !== null && d < todayMidnight
      }),
    [bookings, todayMidnight],
  )

  const favoriteTourIdSet = useMemo(() => new Set(favoriteTourIds), [favoriteTourIds])

  const favoriteTours = useMemo(() => {
    if (favoriteTourIds.length === 0) return []

    const tourById = new Map(allTours.map((tour) => [tour.id, tour]))
    return favoriteTourIds
      .map((id) => tourById.get(id))
      .filter((tour): tour is Tour => Boolean(tour))
  }, [allTours, favoriteTourIds])

  const fullName = useMemo(() => {
    const candidate = `${profile.firstName} ${profile.lastName}`.trim()
    return candidate || user?.displayName || 'Istifadeci'
  }, [profile.firstName, profile.lastName, user?.displayName])

  const handleToggleFavorite = async (tour: Tour) => {
    if (!db || !isFirebaseConfigured || !user) return

    const userRef = doc(db, 'users', user.uid)
    const currentlyFavorite = favoriteTourIdSet.has(tour.id)

    setFavoriteTourIds((prev) =>
      currentlyFavorite
        ? prev.filter((id) => id !== tour.id)
        : [...new Set([...prev, tour.id])],
    )

    try {
      await setDoc(
        userRef,
        {
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )

      await updateDoc(userRef, {
        favorites: currentlyFavorite ? arrayRemove(tour.id) : arrayUnion(tour.id),
        updatedAt: serverTimestamp(),
      })
    } catch {
      setFavoriteTourIds((prev) =>
        currentlyFavorite
          ? [...new Set([...prev, tour.id])]
          : prev.filter((id) => id !== tour.id),
      )
    }
  }

  const handleSignOut = async () => {
    if (!auth) return
    await fetch('/api/auth/session', {
      method: 'DELETE',
    })
    await signOut(auth)
    router.push('/login')
  }

  const handleOpenTicket = (booking: Booking) => {
    if (typeof window === 'undefined') return
    const storedBooking = {
      tourId: booking.tourId,
      tourTitle: booking.tourTitle,
      tourDate: booking.tourDate,
      tourDateLabel: booking.tourDateLabel,
      tourPrice: booking.unitPrice,
      unitPrice: booking.unitPrice,
      packageType: booking.packageType as 'economy' | 'standard',
      seatCount: booking.passengers.length,
      totalPrice: booking.totalPrice,
      seats: booking.passengers.map((p) => p.seat),
      passengers: booking.passengers,
      passengerName: booking.passengers[0]
        ? `${booking.passengers[0].name} ${booking.passengers[0].surname}`.trim()
        : '',
      phone: booking.phone,
      bookedAt: booking.bookedAt,
      ticketCode: booking.ticketCode,
    }
    window.localStorage.setItem('shenyol-last-booking', JSON.stringify(storedBooking))
    router.push('/ticket')
  }

  const handleReserveFavoriteTour = (tour: Tour) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PENDING_RESERVE_TOUR_KEY, tour.id)
      window.localStorage.setItem(PENDING_RESERVE_ACTION_KEY, 'reserve')
    }
    router.push('/')
  }

  if (loading) {
    return (
      <I18nProvider>
        <main className='flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#0b0610] via-[#1b0f2f] to-[#12071d] px-4 py-10'>
          <p className='text-sm text-[#d6cfe8]'>Kabinet yuklenir...</p>
        </main>
      </I18nProvider>
    )
  }

  return (
    <I18nProvider>
      <main className='min-h-dvh bg-gradient-to-br from-[#0b0610] via-[#1b0f2f] to-[#12071d] px-4 py-8 text-white sm:px-6'>
        <div className='mx-auto w-full max-w-5xl space-y-6'>
          <header className='rounded-[2rem] border border-white/10 bg-[#130a22]/90 p-6 shadow-[0_40px_120px_-45px_rgba(151,71,255,0.7)]'>
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <p className='text-xs uppercase tracking-[0.32em] text-[#aa95ff]'>Shenyol Travel</p>
              <h1 className='mt-2 text-3xl font-semibold'>Musteri Kabineti</h1>
              <p className='mt-2 text-sm text-[#c4b7ef]'>Xos geldin, {fullName}</p>
            </div>
            <div className='flex gap-2'>
              {isAdmin ? (
                <Link
                  href='/admin'
                  className='rounded-2xl bg-gradient-to-r from-[#ef4444] via-[#f97316] to-[#ec4899] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_40px_-18px_rgba(239,68,68,0.8)]'
                >
                  Admin Panele Giris
                </Link>
              ) : null}
              <Link href='/' className='rounded-2xl border border-white/10 bg-[#1a1030] px-4 py-2 text-sm font-semibold text-[#ddd3ff]'>
                Ana sehife
              </Link>
              <button
                type='button'
                onClick={handleSignOut}
                className='rounded-2xl bg-[#ff2e7a]/20 px-4 py-2 text-sm font-semibold text-[#ff9bc7]'
              >
                Hesabdan cix
              </button>
            </div>
          </div>
        </header>

          <section className='grid gap-6 lg:grid-cols-3'>
            <article className='lg:col-span-1 rounded-[2rem] border border-white/10 bg-[#130a22]/90 p-6'>
            <h2 className='text-lg font-semibold'>Istifadeci melumatlari</h2>
            <div className='mt-4 space-y-3 text-sm text-[#d6cfe8]'>
              <div className='rounded-2xl bg-[#1a1030] px-3 py-2'>Ad: {profile.firstName || '-'}</div>
              <div className='rounded-2xl bg-[#1a1030] px-3 py-2'>Soyad: {profile.lastName || '-'}</div>
              <div className='rounded-2xl bg-[#1a1030] px-3 py-2'>Email: {user?.email || '-'}</div>
              <div className='rounded-2xl bg-[#1a1030] px-3 py-2'>Telefon: {profile.phone || '-'}</div>
              <div className='rounded-2xl bg-[#1a1030] px-3 py-2'>Favoritlerin sayi: {favoriteTourIds.length}</div>
            </div>
          </article>

            <article className='lg:col-span-2 rounded-[2rem] border border-white/10 bg-[#130a22]/90 p-6'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <h2 className='text-lg font-semibold'>Kabinet bolmeleri</h2>
              <div className='inline-flex rounded-2xl border border-white/10 bg-[#1a1030] p-1'>
                <button
                  type='button'
                  onClick={() => setActiveTab('tickets')}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === 'tickets' ? 'bg-brand-purple text-white' : 'text-[#c4b7ef] hover:bg-white/5'
                  }`}
                >
                  Aktiv Turlarim
                </button>
                <button
                  type='button'
                  onClick={() => setActiveTab('favorites')}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === 'favorites' ? 'bg-brand-pink text-white' : 'text-[#c4b7ef] hover:bg-white/5'
                  }`}
                >
                  Beyenilen Turlar
                </button>
              </div>
            </div>

            {activeTab === 'tickets' ? (
              <div className='mt-4 space-y-3'>
                {activeBookings.length > 0 ? (
                  activeBookings.map((booking) => {
                    const seatsList = booking.passengers.map((p) => p.seat).join(', ')
                    const parsedD = parseBookingDate(booking.tourDate)
                    const displayDate = booking.tourDateLabel || (parsedD ? parsedD.toLocaleDateString('az-AZ') : '—')
                    const packageLabel = booking.packageType === 'standard' ? 'Standart' : 'Ekonom'
                    return (
                      <div key={booking.id} className='rounded-2xl border border-[#8b5cf6]/35 bg-[#1a1030] p-4'>
                        <div className='flex items-start justify-between gap-3'>
                          <div className='min-w-0'>
                            <p className='text-sm font-semibold text-white'>{booking.tourTitle}</p>
                            <p className='mt-1 text-sm text-[#d6cfe8]'>
                              Tarix: {displayDate} • Paket: {packageLabel} • Oturacaq: {seatsList || '—'}
                            </p>
                            <p className='mt-1 text-xs text-[#aa95ff]'>Bilet kodu: {booking.ticketCode}</p>
                          </div>
                          <button
                            type='button'
                            onClick={() => handleOpenTicket(booking)}
                            title='Bileti yüklə'
                            className='flex shrink-0 items-center gap-1.5 rounded-xl bg-[#8b5cf6]/20 px-3 py-1.5 text-xs font-semibold text-[#c4b7ef] transition hover:bg-[#8b5cf6]/40'
                          >
                            <Download className='h-3.5 w-3.5' />
                            Bileti Yüklə
                          </button>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className='rounded-2xl border border-dashed border-white/15 bg-[#1a1030] p-6 text-sm text-[#c4b7ef]'>
                    Helelik heç bir aktiv turunuz yoxdur.
                  </div>
                )}
              </div>
            ) : (
              <div className='mt-4 space-y-4'>
                {favoriteTours.length > 0 ? (
                  favoriteTours.map((tour) => (
                    <TourCard
                      key={tour.id}
                      tour={tour}
                      onSelect={handleReserveFavoriteTour}
                      isFavorite={favoriteTourIdSet.has(tour.id)}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))
                ) : (
                  <div className='rounded-2xl border border-dashed border-white/15 bg-[#1a1030] p-6 text-sm text-[#c4b7ef]'>
                    Helelik favori tur yoxdur. Ana sehifede tur kartindaki urek ikonuna basaraq favorit elave edin.
                  </div>
                )}
              </div>
            )}
            </article>
          </section>

          <section className='rounded-[2rem] border border-white/10 bg-[#130a22]/90 p-6'>
            <h2 className='text-lg font-semibold'>Kecmis Turlarim</h2>
            <div className='mt-4 grid gap-3 sm:grid-cols-2'>
              {pastBookings.length > 0 ? (
                pastBookings.map((booking) => {
                  const parsedD = parseBookingDate(booking.tourDate)
                  const displayDate = booking.tourDateLabel || (parsedD ? parsedD.toLocaleDateString('az-AZ') : '—')
                  return (
                    <div key={booking.id} className='rounded-2xl border border-white/10 bg-[#1a1030] p-4'>
                      <div className='flex items-start justify-between gap-3'>
                        <div className='min-w-0'>
                          <p className='text-sm font-semibold text-white'>{booking.tourTitle}</p>
                          <p className='mt-1 text-sm text-[#c4b7ef]'>Tarix: {displayDate} • Tamamlanib</p>
                          <p className='mt-1 text-xs text-[#aa95ff]'>Bilet kodu: {booking.ticketCode}</p>
                        </div>
                        <button
                          type='button'
                          onClick={() => handleOpenTicket(booking)}
                          title='Bileti yüklə'
                          className='flex shrink-0 items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#c4b7ef] transition hover:bg-white/10'
                        >
                          <Download className='h-3.5 w-3.5' />
                          Bileti Yüklə
                        </button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className='col-span-2 rounded-2xl border border-dashed border-white/15 bg-[#1a1030] p-6 text-sm text-[#c4b7ef]'>
                  Helelik heç bir kecmis turunuz yoxdur.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </I18nProvider>
  )
}
