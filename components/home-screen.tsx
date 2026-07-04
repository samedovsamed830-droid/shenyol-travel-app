'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { Search, Bell } from 'lucide-react'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { ClownMascot } from '@/components/clown-mascot'
import { AboutUsSection } from '@/components/about-us-section'
import { TourCard, type Tour } from '@/components/tour-card'
import { LanguageSwitcher } from '@/components/language-switcher'
import { SiteFooter } from '@/components/site-footer'
import { useI18n } from '@/lib/i18n'
import { app, auth, db, isFirebaseConfigured } from '@/lib/firebase'
import { normalizeTourBuses } from '@/lib/seat-layout'
import { cn } from '@/lib/utils'

const defaultTours: Tour[] = []

const categoryKeys = [
  'home.cat.all',
  'home.cat.mountains',
  'home.cat.sea',
  'home.cat.city',
  'home.cat.nightlife',
]

type AdBanner = {
  id: string
  imageUrl: string
  linkUrl: string
}

type NotificationItem = {
  id: string
  message: string
  createdAtMs: number
}

const NOTIFICATION_LAST_SEEN_KEY = 'shenyol-notifications-last-seen-at'
const FCM_TOKEN_STORAGE_KEY = 'shenyol-fcm-token'
const WEB_PUSH_VAPID_KEY = 'BKzVQSz-oicAN75yOjwZXKDkH3ho6_75yuqVrUOHJHRHaeeQCoNI1QJUDVUJLm1EOTSV4SL85x3Hj_gmbYDa7VI'
const PENDING_RESERVE_TOUR_KEY = 'shenyol-pending-reserve-tour-id'
const PENDING_RESERVE_ACTION_KEY = 'shenyol-pending-reserve-action'

const toMillis = (value: unknown): number => {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis()
  }

  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  return 0
}

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

export function HomeScreen({ onSelectTour }: { onSelectTour: (tour: Tour) => void }) {
  const router = useRouter()
  const { t } = useI18n()
  const [tours, setTours] = useState<Tour[]>(defaultTours)
  const [adBanners, setAdBanners] = useState<AdBanner[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [favoriteTourIds, setFavoriteTourIds] = useState<string[]>([])
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [lastSeenAt, setLastSeenAt] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeBannerIndex, setActiveBannerIndex] = useState(0)
  const [isBannerTransitionEnabled, setIsBannerTransitionEnabled] = useState(true)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const notificationsMenuRef = useRef<HTMLDivElement | null>(null)
  const hasLoadedToursOnceRef = useRef(false)
  const hasDynamicAds = adBanners.length > 0
  const carouselSlides = useMemo(() => {
    if (!hasDynamicAds) return []
    return [...adBanners, adBanners[0]]
  }, [adBanners, hasDynamicAds])
  const visibleBannerIndex = hasDynamicAds ? activeBannerIndex % adBanners.length : 0
  const hasUnreadNotifications = useMemo(
    () => notifications.some((item) => item.createdAtMs > lastSeenAt),
    [notifications, lastSeenAt],
  )
  const favoriteTourIdSet = useMemo(() => new Set(favoriteTourIds), [favoriteTourIds])
  const userInitial = useMemo(() => {
    const source = authUser?.displayName || authUser?.email || ''
    const trimmed = source.trim()
    return trimmed ? trimmed.charAt(0).toUpperCase() : 'U'
  }, [authUser, db])

  useEffect(() => {
    if (!auth) return

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user)
    })

    return () => unsubscribe()
  }, [])

  const setupFcmToken = async (askPermission: boolean) => {
    if (!app || !db || !isFirebaseConfigured || typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return

    try {
      const supported = await isSupported()
      if (!supported) return

      const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js?v=2')
      await swRegistration.update()

      let permission = Notification.permission
      if (askPermission && permission === 'default') {
        permission = await Notification.requestPermission()
      }

      if (permission !== 'granted') return

      const messaging = getMessaging(app)
      const token = await getToken(messaging, {
        vapidKey: WEB_PUSH_VAPID_KEY,
        serviceWorkerRegistration: swRegistration,
      })

      if (!token) return

      const tokenRef = doc(db, 'fcm_tokens', token)
      const tokenSnapshot = await getDoc(tokenRef)

      await setDoc(
        tokenRef,
        {
          token,
          userAgent: navigator.userAgent,
          platform: navigator.platform || '',
          createdAt: tokenSnapshot.exists() ? tokenSnapshot.data().createdAt ?? serverTimestamp() : serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )

      localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token)
    } catch {
      // Notification permission and token generation can fail on unsupported contexts.
    }
  }

  const filteredTours = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase()
    if (!normalized) return tours

    return tours.filter((tour) => {
      const title = tour.title ?? (tour.titleKey ? t(tour.titleKey) : '')
      const location = tour.location ?? (tour.locationKey ? t(tour.locationKey) : '')
      return (
        title.toLowerCase().includes(normalized) ||
        location.toLowerCase().includes(normalized)
      )
    })
  }, [searchQuery, tours, t])

  useEffect(() => {
    const storedSeenAt = typeof window !== 'undefined' ? localStorage.getItem(NOTIFICATION_LAST_SEEN_KEY) : null
    if (!storedSeenAt) return

    const parsed = Number(storedSeenAt)
    if (Number.isFinite(parsed) && parsed > 0) {
      setLastSeenAt(parsed)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (Notification.permission === 'granted') {
      void setupFcmToken(false)
    }
  }, [])

  useEffect(() => {
    if (!db || !isFirebaseConfigured) {
      setNotifications([])
      return
    }

    const unsubscribeNotifications = onSnapshot(
      query(collection(db, 'notifications'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const nextNotifications = snapshot.docs.map((notificationDoc) => {
          const data = notificationDoc.data() as { message?: unknown; createdAt?: unknown }
          return {
            id: notificationDoc.id,
            message: String(data.message ?? '').trim(),
            createdAtMs: toMillis(data.createdAt),
          }
        })

        setNotifications(nextNotifications.filter((item) => item.message))
      },
      () => {
        setNotifications([])
      },
    )

    return () => unsubscribeNotifications()
  }, [])

  useEffect(() => {
    if (!isNotificationsOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (notificationsMenuRef.current && !notificationsMenuRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false)
      }
    }

    window.addEventListener('mousedown', handleOutsideClick)
    return () => window.removeEventListener('mousedown', handleOutsideClick)
  }, [isNotificationsOpen])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotificationsOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  const handleToggleNotifications = () => {
    void setupFcmToken(true)

    setIsNotificationsOpen((prev) => {
      const nextOpen = !prev

      if (nextOpen) {
        const now = Date.now()
        setLastSeenAt(now)
        localStorage.setItem(NOTIFICATION_LAST_SEEN_KEY, String(now))
      }

      return nextOpen
    })
  }

  useEffect(() => {
    if (!db || !isFirebaseConfigured || !authUser) {
      setFavoriteTourIds([])
      return
    }

    const userRef = doc(db, 'users', authUser.uid)
    const unsubscribeFavorites = onSnapshot(userRef, (snapshot) => {
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

    return () => unsubscribeFavorites()
  }, [authUser])

  const handleToggleFavoriteTour = async (tour: Tour) => {
    if (!authUser) {
      router.push('/login')
      return
    }

    if (!db || !isFirebaseConfigured) {
      alert('Firebase konfiqurasiyasi tapilmadi. Favoritler yenilenmedi.')
      return
    }

    const userRef = doc(db, 'users', authUser.uid)
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

  useEffect(() => {
    const firestore = db
    if (firestore && isFirebaseConfigured) {
      let isMounted = true

      const mapSnapshotToTours = (snapshot: { docs: Array<{ id: string; data: () => Partial<Tour> & { name?: string } }> }) => {
        const toursData = snapshot.docs.map((tourDoc) => ({
          id: tourDoc.id,
          ...(tourDoc.data() as Partial<Tour> & { name?: string }),
        }))

        return toursData.map((tour) => {
          const resolvedTitle = tour.title ?? tour.name ?? ''
          const resolvedLocation = tour.location ?? inferLocationFromTitle(resolvedTitle)

          return {
            id: tour.id,
            titleKey: tour.titleKey,
            title: resolvedTitle,
            locationKey: tour.locationKey,
            location: resolvedLocation,
            durationKey: tour.durationKey ?? 'tour.duration.1day',
            duration: tour.duration,
            meetingPoint: typeof tour.meetingPoint === 'string' ? tour.meetingPoint : '',
            date: typeof tour.date === 'string' ? tour.date : '',
            dateLabel: typeof tour.dateLabel === 'string' ? tour.dateLabel : '',
            program: {
              enabled: Boolean(tour.program?.enabled),
              includedItems: normalizeProgramItems(tour.program?.includedItems),
              placesItems: normalizeProgramItems(tour.program?.placesItems),
              scheduleGathering: typeof tour.program?.scheduleGathering === 'string' ? tour.program.scheduleGathering : '',
              scheduleDeparture: typeof tour.program?.scheduleDeparture === 'string' ? tour.program.scheduleDeparture : '',
              scheduleReturn: typeof tour.program?.scheduleReturn === 'string' ? tour.program.scheduleReturn : '',
              notesItems: normalizeProgramItems(tour.program?.notesItems),
            },
            description: tour.description,
            priceEconomy: Number(tour.priceEconomy ?? tour.price ?? 25),
            priceStandard: Number(tour.priceStandard ?? tour.price ?? 40),
            featuresEconomy: Array.isArray(tour.featuresEconomy) ? tour.featuresEconomy.map((item) => String(item)) : [],
            featuresStandard: Array.isArray(tour.featuresStandard) ? tour.featuresStandard.map((item) => String(item)) : [],
            rating: Number(tour.rating ?? 4.9),
            reviews: Number(tour.reviews ?? 0),
            image: tour.image ?? '/images/gabala-tour.png',
            seatsAvailable: Number(tour.seatsAvailable ?? 20),
            bookedSeats: Array.isArray(tour.bookedSeats) ? tour.bookedSeats.map((seat) => String(seat)) : [],
            buses: normalizeTourBuses(
              (tour as Partial<Tour> & { buses?: unknown }).buses,
              Number(tour.seatsAvailable ?? 20),
              tour.bookedSeats,
            ),
          } satisfies Tour
        })
      }

      const loadToursOnce = async () => {
        try {
          const snapshot = await getDocs(collection(firestore, 'tours'))
          if (!isMounted) return
          const mappedTours = mapSnapshotToTours(snapshot as unknown as { docs: Array<{ id: string; data: () => Partial<Tour> & { name?: string } }> })
          hasLoadedToursOnceRef.current = true
          setTours(mappedTours)
        } catch {
          setTours([])
        }
      }

      void loadToursOnce()

      const unsubscribe = onSnapshot(
        collection(firestore, 'tours'),
        (snapshot) => {
          if (snapshot.empty) {
            hasLoadedToursOnceRef.current = true
            setTours([])
            return
          }

          const mappedTours = mapSnapshotToTours(snapshot as unknown as { docs: Array<{ id: string; data: () => Partial<Tour> & { name?: string } }> })

          hasLoadedToursOnceRef.current = true
          setTours(mappedTours)
        },
        () => {
          // Preserve currently rendered tours if the live listener temporarily fails.
        },
      )

      return () => {
        isMounted = false
        unsubscribe()
      }
    }

    setTours(defaultTours)
  }, [])

  useEffect(() => {
    const loadAdsFromStorage = () => {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('shenyol-ads') : null
      if (!stored) {
        setAdBanners([])
        return
      }

      try {
        const parsed = JSON.parse(stored) as Array<Partial<AdBanner> & { id?: string }>
        setAdBanners(
          parsed
            .map((item, index) => ({
              id: String(item.id ?? `local-ad-${index}`),
              imageUrl: String(item.imageUrl ?? ''),
              linkUrl: String(item.linkUrl ?? ''),
            }))
            .filter((ad) => ad.imageUrl),
        )
      } catch {
        setAdBanners([])
      }
    }

    if (!db || !isFirebaseConfigured) {
      loadAdsFromStorage()
      return
    }

    const unsubscribeAds = onSnapshot(
      query(collection(db, 'ads'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const nextAds = snapshot.docs.map((adDoc) => {
          const data = adDoc.data() as Partial<AdBanner>
          return {
            id: adDoc.id,
            imageUrl: String(data.imageUrl ?? ''),
            linkUrl: String(data.linkUrl ?? ''),
          }
        })

        setAdBanners(nextAds.filter((ad) => ad.imageUrl))
      },
      () => {
        loadAdsFromStorage()
      },
    )

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'shenyol-ads') {
        loadAdsFromStorage()
      }
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      unsubscribeAds()
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  useEffect(() => {
    setActiveBannerIndex(0)
    setIsBannerTransitionEnabled(true)
  }, [adBanners.length])

  useEffect(() => {
    if (!hasDynamicAds || adBanners.length <= 1) return

    const intervalId = window.setInterval(() => {
      setActiveBannerIndex((prev) => prev + 1)
    }, 3000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [adBanners.length, hasDynamicAds])

  useEffect(() => {
    if (!hasDynamicAds || activeBannerIndex !== adBanners.length) return

    const timeoutId = window.setTimeout(() => {
      setIsBannerTransitionEnabled(false)
      setActiveBannerIndex(0)
    }, 500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeBannerIndex, adBanners.length, hasDynamicAds])

  useEffect(() => {
    if (isBannerTransitionEnabled) return

    const frameId = window.requestAnimationFrame(() => {
      setIsBannerTransitionEnabled(true)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [isBannerTransitionEnabled])

  useEffect(() => {
    if (typeof window === 'undefined' || tours.length === 0) return

    const pendingAction = window.localStorage.getItem(PENDING_RESERVE_ACTION_KEY)
    const pendingTourId = window.localStorage.getItem(PENDING_RESERVE_TOUR_KEY)

    if (pendingAction !== 'reserve' || !pendingTourId) return

    const targetTour = tours.find((tour) => tour.id === pendingTourId)
    if (!targetTour) return

    onSelectTour(targetTour)
  }, [tours, onSelectTour])

  return (
    <div className="flex min-h-full flex-col gap-5 px-5 pb-32 pt-6">
      {/* header */}
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="relative flex items-center gap-2" ref={notificationsMenuRef}>
            <button
              type="button"
              onClick={handleToggleNotifications}
              aria-label={t('home.notifications')}
              className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-transform active:scale-90"
            >
              <Bell className="size-5" />
              {hasUnreadNotifications ? (
                <span className="absolute right-2 top-2 size-2 rounded-full bg-brand-pink" />
              ) : null}
            </button>
            {isNotificationsOpen ? (
              <div className="absolute right-0 top-12 z-30 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#120a1f] shadow-[0_25px_60px_-30px_rgba(120,50,180,0.65)]">
                <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">
                  Bildirişlər
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map((item) => (
                      <div key={item.id} className="border-b border-white/5 px-4 py-3 text-sm text-[#ddd3ff]">
                        {item.message}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-4 text-sm text-[#b0a6e3]">
                      Hələlik bildiriş yoxdur.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
            {authUser ? (
              <Link
                href="/profile"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5 text-foreground"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-brand-purple text-xs font-bold text-white">
                  {userInitial}
                </span>
                <span className="text-xs font-semibold">Kabinetim</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground"
              >
                Giris et
              </Link>
            )}
            <LanguageSwitcher />
          </div>
        </div>

        <div className="w-full">
          <div className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 shadow-sm shadow-black/10">
            <Search className="size-5 text-muted-foreground" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('home.searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </header>

      {/* hero carousel */}
      {hasDynamicAds ? (
        <section className="animate-fade-up relative mt-4 w-full rounded-3xl border border-white/10 bg-[#120a1f]">
          <div className="relative h-40 overflow-hidden rounded-3xl sm:h-48 md:h-[350px]">
            <div
              className={cn(
                'flex h-full',
                isBannerTransitionEnabled ? 'transition-transform duration-500 ease-in-out' : '',
              )}
              style={{ transform: `translateX(-${activeBannerIndex * 100}%)` }}
            >
              {carouselSlides.map((banner, index) => (
                <a
                  key={`${banner.id}-slide-${index}`}
                  href={banner.linkUrl || '#'}
                  className="relative block h-40 w-full shrink-0 overflow-hidden rounded-3xl sm:h-48 md:h-[350px]"
                >
                  <Image
                    src={banner.imageUrl}
                    alt="Reklam banneri"
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 90vw, 1920px"
                    className="object-cover md:object-contain"
                  />
                </a>
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-2 md:static md:inset-auto md:mt-3">
            {adBanners.map((banner, index) => (
              <span
                key={`${banner.id}-dot`}
                className={cn(
                  'size-2.5 rounded-full transition-all duration-300',
                  visibleBannerIndex === index
                    ? 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.7)]'
                    : 'bg-violet-200/30',
                )}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="animate-fade-up relative mt-4 overflow-hidden rounded-3xl bg-primary px-5 py-5 text-primary-foreground">
          <div aria-hidden className="absolute -right-6 -top-6 size-28 rounded-full bg-brand-pink/40 blur-xl" />
          <div className="relative">
            <div className="relative z-10 max-w-lg">
              <p className="text-sm font-medium opacity-90">{t('home.hero.ready')}</p>
              <h2 className="text-balance font-heading text-2xl font-extrabold leading-tight">
                {t('home.hero.title.a')}{' '}
                <span className="text-brand-yellow">{t('home.hero.title.b')}</span>
              </h2>
            </div>
            <div className="pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 sm:block">
              <ClownMascot size={140} bounce={false} className="shrink-0" />
            </div>
          </div>
        </section>
      )}

      {/* categories */}
      <nav
        aria-label={t('home.categories.title')}
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {categoryKeys.map((cat, i) => (
          <button
            key={cat}
            type="button"
            className={
              i === 0
                ? 'whitespace-nowrap rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background'
                : 'whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors active:bg-secondary'
            }
          >
            {t(cat)}
          </button>
        ))}
      </nav>

      {/* tours */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold">{t('home.featured')}</h2>
          <button type="button" className="text-sm font-semibold text-brand-purple">
            {t('home.seeAll')}
          </button>
        </div>
        {filteredTours.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredTours.map((tour) => (
              <TourCard
                key={tour.id}
                tour={tour}
                onSelect={onSelectTour}
                isFavorite={favoriteTourIdSet.has(tour.id)}
                onToggleFavorite={handleToggleFavoriteTour}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-3xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
            {t('home.noResults')}
          </p>
        )}
      </section>

      <AboutUsSection />

      <SiteFooter />
    </div>
  )
}
