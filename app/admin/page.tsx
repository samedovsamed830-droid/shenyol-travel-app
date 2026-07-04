'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  Edit,
  Home,
  Megaphone,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { auth, db, isFirebaseConfigured } from '@/lib/firebase'
import {
  createSeatLayout,
  createTourBus,
  normalizeSeatIds,
  normalizeTourBuses,
  sortSeatIdsByLayout,
  type TourBus,
} from '@/lib/seat-layout'

const adminEmailAllowlist = String(process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)

type TourItem = {
  id: string
  name: string
  priceEconomy: number
  priceStandard: number
  price?: number
  featuresEconomy: string[]
  featuresStandard: string[]
  date: string
  dateLabel?: string
  program?: {
    enabled?: boolean
    includedItems?: string[]
    placesItems?: string[]
    scheduleGathering?: string
    scheduleDeparture?: string
    scheduleReturn?: string
    notesItems?: string[]
  }
  duration: string
  location: string
  meetingPoint: string
  seatsAvailable: number
  description: string
  image: string
  bookedSeats: string[]
  buses: TourBus[]
}

type Booking = {
  id: string
  name: string
  phone: string
  tour: string
  seat: string
  date: string
  price: string
  packageType?: 'economy' | 'standard'
  totalPrice?: number
  purchaseDate?: string
}

type Registration = {
  id: string
  firstName: string
  lastName: string
  phone: string
  createdAt: string
}

type AdItem = {
  id: string
  imageUrl: string
  linkUrl: string
}

type NotificationAdminItem = {
  id: string
  message: string
  createdAtMs: number
}

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'tours', label: 'Turlar', icon: BarChart3 },
  { id: 'ads', label: 'Reklamlar', icon: Megaphone },
  { id: 'customers', label: 'Müştərilər', icon: Users },
] as const

type TabId = (typeof tabs)[number]['id']

const normalizeBookedSeats = (value: unknown): string[] => {
  return normalizeSeatIds(value)
}

const normalizeFeatureList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

const normalizeProgramList = (value: unknown): string[] => {
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

const normalizeTour = (raw: Partial<TourItem> & { id: string }): TourItem => {
  const buses = normalizeTourBuses(raw.buses, Number(raw.seatsAvailable ?? 20), raw.bookedSeats)
  const primaryBus = buses[0]

  return {
    id: raw.id,
    name: raw.name ?? 'Yeni Tur',
    priceEconomy: Number(raw.priceEconomy ?? raw.price ?? 25),
    priceStandard: Number(raw.priceStandard ?? raw.price ?? 40),
    featuresEconomy: normalizeFeatureList(raw.featuresEconomy),
    featuresStandard: normalizeFeatureList(raw.featuresStandard),
    date: raw.date ?? '',
    dateLabel: raw.dateLabel ?? '',
    program: {
      enabled: Boolean(raw.program?.enabled),
      includedItems: normalizeProgramList(raw.program?.includedItems),
      placesItems: normalizeProgramList(raw.program?.placesItems),
      scheduleGathering: String(raw.program?.scheduleGathering ?? ''),
      scheduleDeparture: String(raw.program?.scheduleDeparture ?? ''),
      scheduleReturn: String(raw.program?.scheduleReturn ?? ''),
      notesItems: normalizeProgramList(raw.program?.notesItems),
    },
    duration: raw.duration ?? '1 gün',
    location: raw.location ?? 'Azərbaycan',
    meetingPoint: String(raw.meetingPoint ?? ''),
    seatsAvailable: primaryBus?.capacity ?? Number(raw.seatsAvailable ?? 20),
    description: raw.description ?? '',
    image: raw.image ?? '/images/gabala-tour.png',
    bookedSeats: primaryBus?.seats ?? normalizeBookedSeats(raw.bookedSeats),
    buses,
  }
}

const buildProgramPayload = (program: TourItem['program']) => {
  const includedItems = normalizeProgramList(program?.includedItems)
  const placesItems = normalizeProgramList(program?.placesItems)
  const notesItems = normalizeProgramList(program?.notesItems)
  const scheduleGathering = String(program?.scheduleGathering ?? '').trim()
  const scheduleDeparture = String(program?.scheduleDeparture ?? '').trim()
  const scheduleReturn = String(program?.scheduleReturn ?? '').trim()
  const enabled = Boolean(program?.enabled)

  const hasAnyData =
    enabled ||
    includedItems.length > 0 ||
    placesItems.length > 0 ||
    notesItems.length > 0 ||
    Boolean(scheduleGathering) ||
    Boolean(scheduleDeparture) ||
    Boolean(scheduleReturn)

  if (!hasAnyData) return undefined

  return {
    enabled,
    includedItems,
    placesItems,
    scheduleGathering,
    scheduleDeparture,
    scheduleReturn,
    notesItems,
  }
}

const uploadImageToServer = async (file: File): Promise<string> => {
  const formData = new FormData()
  formData.append('image', file)

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })

  const result = (await response.json()) as {
    url?: string
    error?: string
  }

  if (!response.ok) {
    throw new Error(result.error ?? 'Şəkil serverə yüklənə bilmədi.')
  }

  if (!result.url) {
    throw new Error('Şəkil linki alınmadı.')
  }

  return result.url
}

export default function AdminPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [tours, setTours] = useState<TourItem[]>([])
  const [adItems, setAdItems] = useState<AdItem[]>([])
  const [notifications, setNotifications] = useState<NotificationAdminItem[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [selectedMonth, setSelectedMonth] = useState('Ümumi Baxış')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDistrict, setFilterDistrict] = useState('Bütün Rayonlar')
  const [filterDate, setFilterDate] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSeatManagerOpen, setIsSeatManagerOpen] = useState(false)
  const [editingTour, setEditingTour] = useState<TourItem | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [editingSeatCapacity, setEditingSeatCapacity] = useState(20)
  const [editingBookedSeats, setEditingBookedSeats] = useState<string[]>([])
  const [editingBuses, setEditingBuses] = useState<TourBus[]>([])
  const [editingSelectedBusId, setEditingSelectedBusId] = useState<string>('bus_1')
  const [isSeatSaving, setIsSeatSaving] = useState(false)
  const [seatStatusMessage, setSeatStatusMessage] = useState<string | null>(null)
  const [isTourLoading, setIsTourLoading] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [editingPriceEconomy, setEditingPriceEconomy] = useState('25')
  const [editingPriceStandard, setEditingPriceStandard] = useState('40')
  const [editingFeaturesEconomy, setEditingFeaturesEconomy] = useState('')
  const [editingFeaturesStandard, setEditingFeaturesStandard] = useState('')
  const [editingDate, setEditingDate] = useState('')
  const [editingDateLabel, setEditingDateLabel] = useState('')
  const [editingProgramEnabled, setEditingProgramEnabled] = useState(false)
  const [editingProgramIncludedItems, setEditingProgramIncludedItems] = useState('')
  const [editingProgramPlacesItems, setEditingProgramPlacesItems] = useState('')
  const [editingProgramGathering, setEditingProgramGathering] = useState('')
  const [editingProgramDeparture, setEditingProgramDeparture] = useState('')
  const [editingProgramReturn, setEditingProgramReturn] = useState('')
  const [editingProgramNotesItems, setEditingProgramNotesItems] = useState('')
  const [editingDuration, setEditingDuration] = useState('1 gün')
  const [editingLocation, setEditingLocation] = useState('Azərbaycan')
  const [editingMeetingPoint, setEditingMeetingPoint] = useState('')
  const [editingSeatCapacityInput, setEditingSeatCapacityInput] = useState('20')
  const [adImageUrl, setAdImageUrl] = useState('')
  const [adLinkUrl, setAdLinkUrl] = useState('')
  const [isAdSaving, setIsAdSaving] = useState(false)
  const [notificationText, setNotificationText] = useState('')
  const [isNotificationSending, setIsNotificationSending] = useState(false)
  const [editingNotificationId, setEditingNotificationId] = useState<string | null>(null)
  const [editingNotificationText, setEditingNotificationText] = useState('')
  const [notificationSavingId, setNotificationSavingId] = useState<string | null>(null)
  const [notificationDeletingId, setNotificationDeletingId] = useState<string | null>(null)
  const hasLoadedToursOnceRef = useRef(false)
  const editingSelectedBusIdRef = useRef('bus_1')

  const activeEditingBus = useMemo(() => {
    if (editingBuses.length === 0) return null
    return editingBuses.find((bus) => bus.id === editingSelectedBusId) ?? editingBuses[0]
  }, [editingBuses, editingSelectedBusId])

  const seatLayout = useMemo(() => createSeatLayout(activeEditingBus?.capacity ?? editingSeatCapacity), [activeEditingBus?.capacity, editingSeatCapacity])

  useEffect(() => {
    editingSelectedBusIdRef.current = editingSelectedBusId
  }, [editingSelectedBusId])

  useEffect(() => {
    if (!auth) {
      router.replace('/login')
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/login')
        return
      }

      const email = String(user.email ?? '').toLowerCase()
      const allowlisted = email ? adminEmailAllowlist.includes(email) : false

      let hasAdminClaim = false
      try {
        const tokenResult = await user.getIdTokenResult(true)
        hasAdminClaim = Boolean(tokenResult.claims.admin)
      } catch {
        hasAdminClaim = false
      }

      if (!hasAdminClaim && !allowlisted) {
        router.replace('/profile')
      }
    })

    return () => unsubscribe()
  }, [router])

  useEffect(() => {
    if (isEditOpen && editingTour) {
      setImagePreview(editingTour.image)
      setEditingName(editingTour.name)
      setEditingPriceEconomy(String(editingTour.priceEconomy))
      setEditingPriceStandard(String(editingTour.priceStandard))
      setEditingFeaturesEconomy(editingTour.featuresEconomy.join(', '))
      setEditingFeaturesStandard(editingTour.featuresStandard.join(', '))
      setEditingDate(editingTour.date)
      setEditingDateLabel(editingTour.dateLabel ?? '')
      setEditingProgramEnabled(Boolean(editingTour.program?.enabled))
      setEditingProgramIncludedItems((editingTour.program?.includedItems ?? []).join('\n'))
      setEditingProgramPlacesItems((editingTour.program?.placesItems ?? []).join('\n'))
      setEditingProgramGathering(editingTour.program?.scheduleGathering ?? '')
      setEditingProgramDeparture(editingTour.program?.scheduleDeparture ?? '')
      setEditingProgramReturn(editingTour.program?.scheduleReturn ?? '')
      setEditingProgramNotesItems((editingTour.program?.notesItems ?? []).join('\n'))
      setEditingDuration(editingTour.duration)
      setEditingLocation(editingTour.location)
      setEditingMeetingPoint(editingTour.meetingPoint)
      const normalizedBuses = normalizeTourBuses(editingTour.buses, editingTour.seatsAvailable || 20, editingTour.bookedSeats)
      const firstBus = normalizedBuses[0]
      const firstCapacity = firstBus?.capacity ?? editingTour.seatsAvailable ?? 20
      setEditingBuses(normalizedBuses)
      setEditingSelectedBusId(firstBus?.id ?? 'bus_1')
      setEditingSeatCapacity(firstCapacity)
      setEditingSeatCapacityInput(String(firstCapacity))
      setEditingBookedSeats(firstBus?.seats ?? normalizeBookedSeats(editingTour.bookedSeats))
      setSeatStatusMessage(null)
    }
    if (isAddOpen && !isEditOpen) {
      setImagePreview(null)
      setEditingName('')
      setEditingPriceEconomy('25')
      setEditingPriceStandard('40')
      setEditingFeaturesEconomy('')
      setEditingFeaturesStandard('')
      setEditingDate('')
      setEditingDateLabel('')
      setEditingProgramEnabled(false)
      setEditingProgramIncludedItems('')
      setEditingProgramPlacesItems('')
      setEditingProgramGathering('')
      setEditingProgramDeparture('')
      setEditingProgramReturn('')
      setEditingProgramNotesItems('')
      setEditingDuration('1 gün')
      setEditingLocation('Azərbaycan')
      setEditingMeetingPoint('')
      setEditingSeatCapacity(20)
      setEditingSeatCapacityInput('20')
      setEditingBookedSeats([])
      setEditingBuses([createTourBus(1, 20)])
      setEditingSelectedBusId('bus_1')
      setSeatStatusMessage(null)
    }
  }, [isEditOpen, isAddOpen, editingTour?.id])

  useEffect(() => {
    if (!isEditOpen) return
    setEditingBookedSeats((prev) =>
      sortSeatIdsByLayout(
        prev.filter((seat) => seatLayout.seatIdSet.has(seat)),
        seatLayout.seatIds,
      ),
    )
  }, [isEditOpen, seatLayout])

  useEffect(() => {
    if (!isEditOpen || !editingTour || !db || !isFirebaseConfigured) return

    const tourId = editingTour.id
    setIsTourLoading(true)

    const unsubscribe = onSnapshot(
      doc(db, 'tours', tourId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setIsTourLoading(false)
          return
        }

        const remote = snapshot.data() as Partial<TourItem>

        setEditingTour((prev) => {
          if (!prev || prev.id !== tourId) return prev

          const mergedBuses = normalizeTourBuses(remote.buses ?? prev.buses, Number(remote.seatsAvailable ?? prev.seatsAvailable ?? 20), remote.bookedSeats ?? prev.bookedSeats)
          const mergedTour: TourItem = {
            ...prev,
            name: String(remote.name ?? prev.name),
            priceEconomy: Number(remote.priceEconomy ?? remote.price ?? prev.priceEconomy),
            priceStandard: Number(remote.priceStandard ?? remote.price ?? prev.priceStandard),
            featuresEconomy: normalizeFeatureList(remote.featuresEconomy ?? prev.featuresEconomy),
            featuresStandard: normalizeFeatureList(remote.featuresStandard ?? prev.featuresStandard),
            date: String(remote.date ?? prev.date),
            dateLabel: String(remote.dateLabel ?? prev.dateLabel ?? ''),
            program: {
              enabled: Boolean(remote.program?.enabled ?? prev.program?.enabled),
              includedItems: normalizeProgramList(remote.program?.includedItems ?? prev.program?.includedItems),
              placesItems: normalizeProgramList(remote.program?.placesItems ?? prev.program?.placesItems),
              scheduleGathering: String(remote.program?.scheduleGathering ?? prev.program?.scheduleGathering ?? ''),
              scheduleDeparture: String(remote.program?.scheduleDeparture ?? prev.program?.scheduleDeparture ?? ''),
              scheduleReturn: String(remote.program?.scheduleReturn ?? prev.program?.scheduleReturn ?? ''),
              notesItems: normalizeProgramList(remote.program?.notesItems ?? prev.program?.notesItems),
            },
            duration: String(remote.duration ?? prev.duration),
            location: String(remote.location ?? prev.location),
            meetingPoint: String(remote.meetingPoint ?? prev.meetingPoint ?? ''),
            seatsAvailable: mergedBuses[0]?.capacity ?? Math.max(1, Number(remote.seatsAvailable ?? prev.seatsAvailable ?? 20)),
            description: String(remote.description ?? prev.description),
            image: String(remote.image ?? prev.image),
            bookedSeats: mergedBuses[0]?.seats ?? normalizeBookedSeats(remote.bookedSeats ?? prev.bookedSeats),
            buses: mergedBuses,
          }

          setTours((currentTours) => currentTours.map((tour) => (tour.id === tourId ? mergedTour : tour)))
          setImagePreview(mergedTour.image)
          setEditingName(mergedTour.name)
          setEditingPriceEconomy(String(mergedTour.priceEconomy))
          setEditingPriceStandard(String(mergedTour.priceStandard))
          setEditingFeaturesEconomy(mergedTour.featuresEconomy.join(', '))
          setEditingFeaturesStandard(mergedTour.featuresStandard.join(', '))
          setEditingDate(mergedTour.date)
          setEditingDateLabel(mergedTour.dateLabel ?? '')
          setEditingProgramEnabled(Boolean(mergedTour.program?.enabled))
          setEditingProgramIncludedItems((mergedTour.program?.includedItems ?? []).join('\n'))
          setEditingProgramPlacesItems((mergedTour.program?.placesItems ?? []).join('\n'))
          setEditingProgramGathering(mergedTour.program?.scheduleGathering ?? '')
          setEditingProgramDeparture(mergedTour.program?.scheduleDeparture ?? '')
          setEditingProgramReturn(mergedTour.program?.scheduleReturn ?? '')
          setEditingProgramNotesItems((mergedTour.program?.notesItems ?? []).join('\n'))
          setEditingDuration(mergedTour.duration)
          setEditingLocation(mergedTour.location)
          setEditingMeetingPoint(mergedTour.meetingPoint)
          const currentSelectedBusId = editingSelectedBusIdRef.current
          const preferredBusId = mergedBuses.some((bus) => bus.id === currentSelectedBusId)
            ? currentSelectedBusId
            : mergedBuses[0]?.id ?? 'bus_1'
          const selectedBus = mergedBuses.find((bus) => bus.id === preferredBusId) ?? mergedBuses[0]

          setEditingBuses(mergedBuses)
          setEditingSelectedBusId(preferredBusId)
          setEditingSeatCapacity(selectedBus?.capacity ?? mergedTour.seatsAvailable)
          setEditingSeatCapacityInput(String(selectedBus?.capacity ?? mergedTour.seatsAvailable))

          const liveLayout = createSeatLayout(selectedBus?.capacity ?? mergedTour.seatsAvailable)
          setEditingBookedSeats(
            sortSeatIdsByLayout(
              (selectedBus?.seats ?? mergedTour.bookedSeats).filter((seat) => liveLayout.seatIdSet.has(seat)),
              liveLayout.seatIds,
            ),
          )

          return mergedTour
        })

        setIsTourLoading(false)
      },
      () => {
        setSeatStatusMessage('Firestore canlı dinləmədə xəta yarandı. Lokal məlumat göstərilir.')
        setIsTourLoading(false)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [isEditOpen, editingTour?.id])

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result)
        } else {
          reject(new Error('Failed to read file'))
        }
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

  const readImageDimensions = (file: File): Promise<{ width: number; height: number }> =>
    new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file)
      const image = new window.Image()

      image.onload = () => {
        const width = image.naturalWidth
        const height = image.naturalHeight
        URL.revokeObjectURL(objectUrl)
        resolve({ width, height })
      }

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Sekil olcusu oxuna bilmedi.'))
      }

      image.src = objectUrl
    })

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const dataUrl = await readFileAsDataUrl(file)
    setImagePreview(dataUrl)
  }

  const handleAdImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const supportedTypes = new Set([
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif',
      ])

      if (!supportedTypes.has(file.type)) {
        setSeatStatusMessage('Bu format desteklenmir. Zehmet olmasa JPG, PNG, WEBP ve ya GIF secin.')
        return
      }

      const { width, height } = await readImageDimensions(file)
      if (width < 1920 || height < 1080) {
        setSeatStatusMessage('Sekil Full HD deyil, amma yuklenir. En yaxshi netice ucun 1920x1080 ve daha boyuk sekil secin.')
      }

      setIsAdSaving(true)
      const imageUrl = await uploadImageToServer(file)
      setAdImageUrl(imageUrl)
      setSeatStatusMessage('Sekil Full HD keyfiyyetle yuklendi ve link yarandi.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Şəkil yüklənərkən xəta baş verdi.'
      setSeatStatusMessage(message)
    } finally {
      setIsAdSaving(false)
    }
  }

  useEffect(() => {
    const firestore = db
    if (firestore && isFirebaseConfigured) {
      let isMounted = true

      const loadToursOnce = async () => {
        try {
          const snapshot = await getDocs(collection(firestore, 'tours'))
          if (!isMounted) return

          const toursData = snapshot.docs.map((tourDoc) => ({
            id: tourDoc.id,
            ...(tourDoc.data() as Partial<TourItem>),
          }))

          const nextTours = toursData.map((tour) =>
            normalizeTour(tour as Partial<TourItem> & { id: string }),
          )

          hasLoadedToursOnceRef.current = true
          setTours(nextTours)
        } catch {
          setSeatStatusMessage('Turlar Firestore-dan ilkin alınarkən xəta baş verdi.')
        }
      }

      void loadToursOnce()

      const unsubscribeTours = onSnapshot(
        collection(firestore, 'tours'),
        (snapshot) => {
          if (snapshot.empty) {
            hasLoadedToursOnceRef.current = true
            setTours([])
            return
          }

          const toursData = snapshot.docs.map((tourDoc) => ({
            id: tourDoc.id,
            ...(tourDoc.data() as Partial<TourItem>),
          }))

          const nextTours = toursData.map((tour) =>
            normalizeTour(tour as Partial<TourItem> & { id: string }),
          )

          if (nextTours.length === 0) {
            return
          }

          hasLoadedToursOnceRef.current = true
          setTours(nextTours)
        },
        () => {
          setSeatStatusMessage('Turlar Firestore-dan canlı alınarkən xəta baş verdi. Mövcud siyahı qorundu.')
        },
      )

      const unsubscribeAds = onSnapshot(
        query(collection(firestore, 'ads'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          const nextAds = snapshot.docs.map((adDoc) => {
            const data = adDoc.data() as Partial<AdItem>
            return {
              id: adDoc.id,
              imageUrl: String(data.imageUrl ?? ''),
              linkUrl: String(data.linkUrl ?? ''),
            }
          })
          setAdItems(nextAds)
        },
        () => {
          setSeatStatusMessage('Reklamlar Firestore-dan canlı alınarkən xəta baş verdi.')
        },
      )

      const unsubscribeNotifications = onSnapshot(
        query(collection(firestore, 'notifications'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          const nextNotifications = snapshot.docs
            .map((notificationDoc) => {
              const data = notificationDoc.data() as { message?: unknown; createdAt?: unknown }
              return {
                id: notificationDoc.id,
                message: String(data.message ?? '').trim(),
                createdAtMs: toMillis(data.createdAt),
              }
            })
            .filter((item) => item.message)

          setNotifications(nextNotifications)
        },
        () => {
          setSeatStatusMessage('Bildirişlər Firestore-dan canlı alınarkən xəta baş verdi.')
        },
      )

      const unsubscribeUsers = onSnapshot(
        collection(firestore, 'users'),
        (snapshot) => {
          const nextRegistrations = snapshot.docs.map((userDoc) => {
            const data = userDoc.data() as {
              firstName?: unknown
              lastName?: unknown
              phone?: unknown
              createdAt?: unknown
            }

            const createdAtMs = toMillis(data.createdAt)

            return {
              id: userDoc.id,
              firstName: String(data.firstName ?? ''),
              lastName: String(data.lastName ?? ''),
              phone: String(data.phone ?? ''),
              createdAt: createdAtMs > 0 ? new Date(createdAtMs).toISOString() : new Date(0).toISOString(),
            } satisfies Registration
          })

          setRegistrations(nextRegistrations)
        },
        () => {
          setSeatStatusMessage('İstifadəçilər Firestore-dan canlı alınarkən xəta baş verdi.')
          setRegistrations([])
        },
      )

      const unsubscribeBookings = onSnapshot(
        query(collection(firestore, 'bookings'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          const nextBookings: Booking[] = []

          snapshot.docs.forEach((bookingDoc) => {
            const data = bookingDoc.data() as {
              tourTitle?: unknown
              passengers?: unknown
              phone?: unknown
              packageType?: unknown
              totalPrice?: unknown
              unitPrice?: unknown
              bookedAt?: unknown
              createdAt?: unknown
            }

            const passengers = Array.isArray(data.passengers)
              ? data.passengers
                  .map((passenger) => {
                    const source = passenger as { seat?: unknown; name?: unknown; surname?: unknown }
                    return {
                      seat: String(source.seat ?? '').trim(),
                      name: String(source.name ?? '').trim(),
                      surname: String(source.surname ?? '').trim(),
                    }
                  })
                  .filter((passenger) => passenger.seat)
              : []

            const bookedAtMs = toMillis(data.bookedAt) || toMillis(data.createdAt)
            const bookedAtDate = bookedAtMs > 0 ? new Date(bookedAtMs) : new Date()
            const purchaseDate = bookedAtDate.toLocaleDateString('az-AZ')

            const totalPrice = Number(data.totalPrice ?? 0)
            const unitPrice = Number(data.unitPrice ?? 0)
            const passengerCount = Math.max(passengers.length, 1)
            const perSeatPrice = Number.isFinite(unitPrice) && unitPrice > 0
              ? unitPrice
              : totalPrice > 0
                ? Number((totalPrice / passengerCount).toFixed(2))
                : 0

            passengers.forEach((passenger, index) => {
              const passengerName = `${passenger.name} ${passenger.surname}`.trim()

              nextBookings.push({
                id: `${bookingDoc.id}-${passenger.seat}-${index}`,
                name: passengerName || 'Müştəri',
                phone: String(data.phone ?? ''),
                tour: String(data.tourTitle ?? ''),
                seat: passenger.seat,
                date: purchaseDate,
                price: `${perSeatPrice} AZN`,
                packageType: String(data.packageType ?? '').trim() === 'standard' ? 'standard' : 'economy',
                totalPrice: perSeatPrice,
                purchaseDate,
              })
            })
          })

          setBookings(nextBookings)
        },
        () => {
          setSeatStatusMessage('Rezervasiyalar Firestore-dan canlı alınarkən xəta baş verdi.')
          setBookings([])
        },
      )

      return () => {
        isMounted = false
        unsubscribeTours()
        unsubscribeAds()
        unsubscribeNotifications()
        unsubscribeUsers()
        unsubscribeBookings()
      }
    }

    setAdItems([])
    setNotifications([])
    setRegistrations([])
    setBookings([])
    return undefined
  }, [])

  useEffect(() => {
    localStorage.setItem('shenyol-ads', JSON.stringify(adItems))
  }, [adItems])

  const monthOptions = ['Ümumi Baxış', 'May 2026', 'İyun 2026', 'İyul 2026', 'Avqust 2026', 'Sentyabr 2026']
  const monthMap: Record<string, string> = {
    May: '05',
    'İyun': '06',
    'İyul': '07',
    'Avqust': '08',
    'Sentyabr': '09',
  }

  const parseBookingDateParts = (value: string): { month: string; year: string } | null => {
    if (!value) return null

    const normalized = value.trim()

    const slashMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (slashMatch) {
      return { month: slashMatch[2], year: slashMatch[3] }
    }

    const dotMatch = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
    if (dotMatch) {
      return { month: dotMatch[2], year: dotMatch[3] }
    }

    const parsedDate = new Date(normalized)
    if (!Number.isNaN(parsedDate.getTime())) {
      return {
        month: String(parsedDate.getMonth() + 1).padStart(2, '0'),
        year: String(parsedDate.getFullYear()),
      }
    }

    return null
  }

  const parseBookingDateToIso = (value: string): string | null => {
    if (!value) return null

    const normalized = value.trim()

    const slashMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (slashMatch) {
      const day = slashMatch[1]
      const month = slashMatch[2]
      const year = slashMatch[3]
      return `${year}-${month}-${day}`
    }

    const dotMatch = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
    if (dotMatch) {
      const day = dotMatch[1]
      const month = dotMatch[2]
      const year = dotMatch[3]
      return `${year}-${month}-${day}`
    }

    const parsedDate = new Date(normalized)
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().slice(0, 10)
    }

    return null
  }

  const extractDistrictFromTour = (tourValue: string): string => {
    const normalized = String(tourValue ?? '').trim()
    if (!normalized) return 'Naməlum'

    const districtPart = normalized.split(',')[0]?.trim()
    return districtPart || normalized
  }

  const filteredBookingsByMonth = useMemo(() => {
    if (selectedMonth === 'Ümumi Baxış') {
      return bookings
    }

    const [monthName, year] = selectedMonth.split(' ')
    const monthValue = monthMap[monthName]
    return bookings.filter((booking) => {
      const fullDate = booking.purchaseDate || booking.date
      const parts = parseBookingDateParts(fullDate)
      if (!parts) return false
      return parts.month === monthValue && parts.year === year
    })
  }, [bookings, selectedMonth])

  const monthlyGrowth = ['May', 'İyun', 'İyul', 'Avqust', 'Sentyabr'].map((monthName) => {
    const monthValue = monthMap[monthName]
    return bookings.reduce((count, booking) => {
      const fullDate = booking.purchaseDate || booking.date
      const parts = parseBookingDateParts(fullDate)
      if (!parts) return count
      return parts.month === monthValue && parts.year === '2026' ? count + 1 : count
    }, 0)
  })

  const filteredRegistrationsByMonth = useMemo(() => {
    if (selectedMonth === 'Ümumi Baxış') {
      return registrations
    }

    const [monthName, year] = selectedMonth.split(' ')
    const monthValue = monthMap[monthName]
    return registrations.filter((registration) => {
      const registeredAt = new Date(registration.createdAt)
      if (Number.isNaN(registeredAt.getTime())) return false
      const month = String(registeredAt.getMonth() + 1).padStart(2, '0')
      const registeredYear = String(registeredAt.getFullYear())
      return month === monthValue && registeredYear === year
    })
  }, [registrations, selectedMonth])

  const activeToursCount = tours.length
  const registeredCustomers = filteredBookingsByMonth.length
  const monthlyCustomers = filteredBookingsByMonth.length
  const monthlyIncome = filteredBookingsByMonth.reduce((total, booking) => {
    const value = Number.isFinite(Number(booking.totalPrice))
      ? Number(booking.totalPrice)
      : Number(String(booking.price ?? '').replace(/[^0-9.-]+/g, ''))
    return total + (Number.isFinite(value) ? value : 0)
  }, 0)
  const dashboardRecentBookings = filteredBookingsByMonth

  const districtOptions = ['Bütün Rayonlar', ...new Set(filteredBookingsByMonth.map((booking) => extractDistrictFromTour(booking.tour)))]

  const filteredBookings = useMemo(() => {
    return filteredBookingsByMonth.filter((booking) => {
      const matchesQuery = [booking.name, booking.phone, booking.tour, booking.seat, booking.date]
        .join(' ')
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
      const bookingDistrict = extractDistrictFromTour(booking.tour)
      const matchesDistrict = filterDistrict === 'Bütün Rayonlar' || bookingDistrict === filterDistrict
      const bookingIsoDate = parseBookingDateToIso(booking.purchaseDate || booking.date)
      const matchesDate = !filterDate || bookingIsoDate === filterDate
      return matchesQuery && matchesDistrict && matchesDate
    })
  }, [filteredBookingsByMonth, searchQuery, filterDistrict, filterDate])

  const openEditModal = (tour: TourItem) => {
    const normalizedBuses = normalizeTourBuses(tour.buses, tour.seatsAvailable || 20, tour.bookedSeats)
    const firstBus = normalizedBuses[0]
    const firstCapacity = firstBus?.capacity ?? tour.seatsAvailable ?? 20
    setEditingTour(tour)
    setEditingBuses(normalizedBuses)
    setEditingSelectedBusId(firstBus?.id ?? 'bus_1')
    setEditingSeatCapacity(firstCapacity)
    setEditingBookedSeats(firstBus?.seats ?? normalizeBookedSeats(tour.bookedSeats))
    setEditingName(tour.name)
    setEditingPriceEconomy(String(tour.priceEconomy))
    setEditingPriceStandard(String(tour.priceStandard))
    setEditingFeaturesEconomy(tour.featuresEconomy.join(', '))
    setEditingFeaturesStandard(tour.featuresStandard.join(', '))
    setEditingDate(tour.date)
    setEditingDateLabel(tour.dateLabel ?? '')
    setEditingProgramEnabled(Boolean(tour.program?.enabled))
    setEditingProgramIncludedItems((tour.program?.includedItems ?? []).join('\n'))
    setEditingProgramPlacesItems((tour.program?.placesItems ?? []).join('\n'))
    setEditingProgramGathering(tour.program?.scheduleGathering ?? '')
    setEditingProgramDeparture(tour.program?.scheduleDeparture ?? '')
    setEditingProgramReturn(tour.program?.scheduleReturn ?? '')
    setEditingProgramNotesItems((tour.program?.notesItems ?? []).join('\n'))
    setEditingDuration(tour.duration)
    setEditingLocation(tour.location)
    setEditingMeetingPoint(tour.meetingPoint)
    setEditingSeatCapacityInput(String(firstCapacity))
    setSeatStatusMessage(null)
    setIsEditOpen(true)
    setIsSeatManagerOpen(false)
  }

  const syncBookedSeatsInState = (tourId: string, busId: string, seatIds: string[]) => {
    const normalizedSeats = sortSeatIdsByLayout(
      normalizeBookedSeats(seatIds).filter((seat) => seatLayout.seatIdSet.has(seat)),
      seatLayout.seatIds,
    )

    let nextBusesSnapshot: TourBus[] = []

    setEditingBuses((prevBuses) => {
      const nextBuses = prevBuses.map((bus) =>
        bus.id === busId
          ? {
              ...bus,
              seats: normalizedSeats,
            }
          : bus,
      )
      nextBusesSnapshot = nextBuses
      return nextBuses
    })

    const primaryBus = nextBusesSnapshot[0]

    setTours((prev) =>
      prev.map((tour) =>
        tour.id === tourId
          ? {
              ...tour,
              buses: nextBusesSnapshot,
              seatsAvailable: primaryBus?.capacity ?? tour.seatsAvailable,
              bookedSeats: primaryBus?.seats ?? tour.bookedSeats,
            }
          : tour,
      ),
    )
    setEditingTour((prev) =>
      prev && prev.id === tourId
        ? {
            ...prev,
            buses: nextBusesSnapshot,
            seatsAvailable: primaryBus?.capacity ?? prev.seatsAvailable,
            bookedSeats: primaryBus?.seats ?? prev.bookedSeats,
          }
        : prev,
    )
    setEditingBookedSeats(normalizedSeats)
  }

  const saveBookedSeatsToFirestore = async (tourId: string, busId: string, seatIds: string[]) => {
    if (!db || !isFirebaseConfigured) {
      setSeatStatusMessage('Firebase konfiqurasiyası tapılmadı. Dəyişiklik local yaddaşda saxlanıldı.')
      return
    }

    const normalizedSeats = normalizeBookedSeats(seatIds)
    const nextBuses = editingBuses.map((bus) =>
      bus.id === busId
        ? {
            ...bus,
            seats: normalizedSeats,
          }
        : bus,
    )
    const primaryBus = nextBuses[0]

    await updateDoc(doc(db, 'tours', tourId), {
      buses: nextBuses,
      seatsAvailable: primaryBus?.capacity ?? 20,
      bookedSeats: primaryBus?.seats ?? [],
    })
  }

  const buildUpdatedTourFromEdit = (): TourItem | null => {
    if (!editingTour) return null

    const nextSeats = sortSeatIdsByLayout(
      normalizeBookedSeats(editingBookedSeats).filter((seat) => seatLayout.seatIdSet.has(seat)),
      seatLayout.seatIds,
    )

    const selectedBusId = activeEditingBus?.id ?? editingSelectedBusId
    const baseBuses = editingBuses.length > 0 ? editingBuses : normalizeTourBuses(editingTour.buses, editingTour.seatsAvailable, editingTour.bookedSeats)
    const mergedBuses = baseBuses.map((bus) =>
      bus.id === selectedBusId
        ? {
            ...bus,
            capacity: Math.max(1, Number(editingSeatCapacityInput) || editingSeatCapacity || bus.capacity || 1),
            seats: nextSeats,
          }
        : bus,
    )
    const primaryBus = mergedBuses[0]

    return {
      ...editingTour,
      name: editingName.trim() || editingTour.name,
      priceEconomy: Number(editingPriceEconomy) || editingTour.priceEconomy,
      priceStandard: Number(editingPriceStandard) || editingTour.priceStandard,
      featuresEconomy: normalizeFeatureList(editingFeaturesEconomy),
      featuresStandard: normalizeFeatureList(editingFeaturesStandard),
      date: editingDate || editingTour.date,
      dateLabel: editingDateLabel.trim() || editingTour.dateLabel || '',
      program: {
        enabled: editingProgramEnabled,
        includedItems: normalizeProgramList(editingProgramIncludedItems),
        placesItems: normalizeProgramList(editingProgramPlacesItems),
        scheduleGathering: editingProgramGathering.trim(),
        scheduleDeparture: editingProgramDeparture.trim(),
        scheduleReturn: editingProgramReturn.trim(),
        notesItems: normalizeProgramList(editingProgramNotesItems),
      },
      duration: editingDuration.trim() || editingTour.duration,
      location: editingLocation.trim() || editingTour.location,
      meetingPoint: editingMeetingPoint.trim(),
      seatsAvailable: primaryBus?.capacity ?? Math.max(1, Number(editingSeatCapacityInput) || editingSeatCapacity || 1),
      description: editingTour.description,
      image: imagePreview || editingTour.image,
      bookedSeats: primaryBus?.seats ?? nextSeats,
      buses: mergedBuses,
    }
  }

  const updateTourInFirestore = async (tour: TourItem) => {
    if (!db || !isFirebaseConfigured) {
      setSeatStatusMessage('Firebase konfiqurasiyası tapılmadı. Dəyişiklik local yaddaşda saxlanıldı.')
      return
    }

    const programPayload = buildProgramPayload(tour.program)

    await updateDoc(doc(db, 'tours', tour.id), {
      name: tour.name,
      title: tour.name,
      priceEconomy: tour.priceEconomy,
      priceStandard: tour.priceStandard,
      featuresEconomy: tour.featuresEconomy,
      featuresStandard: tour.featuresStandard,
      date: tour.date,
      dateLabel: tour.dateLabel ?? '',
      ...(programPayload ? { program: programPayload } : {}),
      duration: tour.duration,
      location: tour.location,
      meetingPoint: tour.meetingPoint,
      description: tour.description,
      buses: tour.buses,
      seatsAvailable: tour.seatsAvailable,
      image: tour.image,
      bookedSeats: tour.bookedSeats,
    })
  }

  const toggleAdminSeat = (seatId: string) => {
    setSeatStatusMessage(null)

    if (!editingTour || !activeEditingBus) return

    const next = editingBookedSeats.includes(seatId)
      ? editingBookedSeats.filter((seat) => seat !== seatId)
      : [...editingBookedSeats, seatId]

    const nextSeats = sortSeatIdsByLayout(normalizeBookedSeats(next), seatLayout.seatIds)

    setEditingBookedSeats(nextSeats)

    syncBookedSeatsInState(editingTour.id, activeEditingBus.id, nextSeats)

    if (db && isFirebaseConfigured) {
      const nextBuses = editingBuses.map((bus) =>
        bus.id === activeEditingBus.id
          ? {
              ...bus,
              seats: nextSeats,
            }
          : bus,
      )
      const primaryBus = nextBuses[0]

      updateDoc(doc(db, 'tours', editingTour.id), {
        buses: nextBuses,
        seatsAvailable: primaryBus?.capacity ?? 20,
        bookedSeats: primaryBus?.seats ?? [],
      }).catch(() => {
        setSeatStatusMessage('Seat yenilənməsi Firestore-a yazılarkən xəta baş verdi.')
      })
    } else {
      setSeatStatusMessage('Firebase konfiqurasiyası tapılmadı. Dəyişiklik local yaddaşda saxlanıldı.')
    }
  }

  const handleClearAllSeats = async () => {
    if (!editingTour || !activeEditingBus) return

    setIsSeatSaving(true)
    try {
      syncBookedSeatsInState(editingTour.id, activeEditingBus.id, [])
      await saveBookedSeatsToFirestore(editingTour.id, activeEditingBus.id, [])
      setSeatStatusMessage('Bütün yerlər boşaldıldı və yeniləndi.')
    } catch {
      setSeatStatusMessage('Yerlər boşaldılarkən xəta baş verdi.')
    } finally {
      setIsSeatSaving(false)
    }
  }

  const handleSelectEditingBus = (busId: string) => {
    const bus = editingBuses.find((item) => item.id === busId)
    if (!bus) return

    const layout = createSeatLayout(bus.capacity)
    setEditingSelectedBusId(bus.id)
    setEditingSeatCapacity(bus.capacity)
    setEditingSeatCapacityInput(String(bus.capacity))
    setEditingBookedSeats(sortSeatIdsByLayout(bus.seats.filter((seat) => layout.seatIdSet.has(seat)), layout.seatIds))
  }

  const handleAddBus = async (capacity: number) => {
    if (!editingTour) return

    const index = editingBuses.reduce((maxValue, bus) => {
      const numeric = Number(bus.id.replace('bus_', ''))
      if (Number.isFinite(numeric)) {
        return Math.max(maxValue, Math.floor(numeric))
      }
      return maxValue
    }, 0) + 1
    const newBus = createTourBus(index, capacity)
    const nextBuses = [...editingBuses, newBus]
    const primaryBus = nextBuses[0]

    setEditingBuses(nextBuses)
    setEditingSelectedBusId(newBus.id)
    setEditingSeatCapacity(newBus.capacity)
    setEditingSeatCapacityInput(String(newBus.capacity))
    setEditingBookedSeats([])

    setEditingTour((prev) =>
      prev && prev.id === editingTour.id
        ? {
            ...prev,
            buses: nextBuses,
            seatsAvailable: primaryBus?.capacity ?? prev.seatsAvailable,
            bookedSeats: primaryBus?.seats ?? prev.bookedSeats,
          }
        : prev,
    )

    setTours((prev) =>
      prev.map((tour) =>
        tour.id === editingTour.id
          ? {
              ...tour,
              buses: nextBuses,
              seatsAvailable: primaryBus?.capacity ?? tour.seatsAvailable,
              bookedSeats: primaryBus?.seats ?? tour.bookedSeats,
            }
          : tour,
      ),
    )

    if (!db || !isFirebaseConfigured) {
      setSeatStatusMessage('Firebase konfiqurasiyası tapılmadı. Yeni avtobus lokal əlavə edildi.')
      return
    }

    try {
      await updateDoc(doc(db, 'tours', editingTour.id), {
        buses: nextBuses,
        seatsAvailable: primaryBus?.capacity ?? 20,
        bookedSeats: primaryBus?.seats ?? [],
      })
      setSeatStatusMessage(`${newBus.name} əlavə edildi.`)
    } catch {
      setSeatStatusMessage('Yeni avtobus Firestore-a yazılarkən xəta baş verdi.')
    }
  }

  const handleDeleteBus = async () => {
    if (!editingTour || !activeEditingBus) return

    if (editingBuses.length <= 1) {
      setSeatStatusMessage('Ən azı bir avtobus qalmalıdır.')
      return
    }

    const nextBuses = editingBuses.filter((bus) => bus.id !== activeEditingBus.id)
    const nextActiveBus = nextBuses[0]
    const nextLayout = createSeatLayout(nextActiveBus?.capacity ?? 20)
    const primaryBus = nextBuses[0]

    setEditingBuses(nextBuses)
    setEditingSelectedBusId(nextActiveBus?.id ?? 'bus_1')
    setEditingSeatCapacity(nextActiveBus?.capacity ?? 20)
    setEditingSeatCapacityInput(String(nextActiveBus?.capacity ?? 20))
    setEditingBookedSeats(
      sortSeatIdsByLayout(
        (nextActiveBus?.seats ?? []).filter((seat) => nextLayout.seatIdSet.has(seat)),
        nextLayout.seatIds,
      ),
    )

    setEditingTour((prev) =>
      prev && prev.id === editingTour.id
        ? {
            ...prev,
            buses: nextBuses,
            seatsAvailable: primaryBus?.capacity ?? prev.seatsAvailable,
            bookedSeats: primaryBus?.seats ?? prev.bookedSeats,
          }
        : prev,
    )

    setTours((prev) =>
      prev.map((tour) =>
        tour.id === editingTour.id
          ? {
              ...tour,
              buses: nextBuses,
              seatsAvailable: primaryBus?.capacity ?? tour.seatsAvailable,
              bookedSeats: primaryBus?.seats ?? tour.bookedSeats,
            }
          : tour,
      ),
    )

    if (!db || !isFirebaseConfigured) {
      setSeatStatusMessage('Firebase konfiqurasiyası tapılmadı. Avtobus lokal silindi.')
      return
    }

    try {
      await updateDoc(doc(db, 'tours', editingTour.id), {
        buses: nextBuses,
        seatsAvailable: primaryBus?.capacity ?? 20,
        bookedSeats: primaryBus?.seats ?? [],
      })
      setSeatStatusMessage(`${activeEditingBus.name} silindi.`)
    } catch {
      setSeatStatusMessage('Avtobus Firestore-dan silinərkən xəta baş verdi.')
    }
  }

  const handleDeleteTour = (tourId: string) => {
    const tourToDelete = tours.find((tour) => tour.id === tourId)
    setTours((prev) => prev.filter((tour) => tour.id !== tourId))

    if (db && isFirebaseConfigured) {
      deleteDoc(doc(db, 'tours', tourId)).catch(() => {
        setSeatStatusMessage('Tur Firestore-dan silinərkən xəta baş verdi.')
      })
    }

    if (tourToDelete) {
      setBookings((prev) => prev.filter((booking) => booking.tour !== tourToDelete.name))
    }
  }

  const resetTourFormStates = () => {
    setImagePreview(null)
    setEditingName('')
    setEditingPriceEconomy('25')
    setEditingPriceStandard('40')
    setEditingFeaturesEconomy('')
    setEditingFeaturesStandard('')
    setEditingDate('')
    setEditingDateLabel('')
    setEditingProgramEnabled(false)
    setEditingProgramIncludedItems('')
    setEditingProgramPlacesItems('')
    setEditingProgramGathering('')
    setEditingProgramDeparture('')
    setEditingProgramReturn('')
    setEditingProgramNotesItems('')
    setEditingDuration('1 gün')
    setEditingLocation('Azərbaycan')
    setEditingMeetingPoint('')
    setEditingSeatCapacity(20)
    setEditingSeatCapacityInput('20')
    setEditingBookedSeats([])
    setEditingBuses([createTourBus(1, 20)])
    setEditingSelectedBusId('bus_1')
  }

  const handleAddTour = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const file = data.get('image') as File | null

    const getText = (field: string) => String(data.get(field) ?? '').trim()
    const name = getText('name')
    const date = getText('date')
    const dateLabel = getText('dateLabel')
    const duration = getText('duration')
    const location = getText('location')
    const meetingPoint = getText('meetingPoint')
    const seatsAvailable = Math.max(1, Number(getText('seatsAvailable')) || 1)
    const priceEconomy = Math.max(0, Number(getText('priceEconomy')) || 0)
    const priceStandard = Math.max(0, Number(getText('priceStandard')) || 0)

    if (!name || !date || !duration || !location) {
      setSeatStatusMessage('Zəhmət olmasa tələb olunan bütün sahələri doldurun.')
      return
    }

    const newTourProgramPayload = buildProgramPayload({
      enabled: getText('programEnabled') === 'on',
      includedItems: normalizeProgramList(getText('programIncludedItems')),
      placesItems: normalizeProgramList(getText('programPlacesItems')),
      scheduleGathering: getText('programGathering'),
      scheduleDeparture: getText('programDeparture'),
      scheduleReturn: getText('programReturn'),
      notesItems: normalizeProgramList(getText('programNotesItems')),
    })

    let imageUrl = '/images/gabala-tour.png'

    if (file && file.size > 0) {
      try {
        imageUrl = await uploadImageToServer(file)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Şəkil yüklənərkən xəta baş verdi.'
        setSeatStatusMessage(message)
        return
      }
    } else if (imagePreview && !imagePreview.startsWith('data:')) {
      imageUrl = imagePreview
    }

    const newTourPayload = {
      buses: [createTourBus(1, seatsAvailable)],
      name,
      title: name,
      priceEconomy,
      priceStandard,
      featuresEconomy: normalizeFeatureList(getText('featuresEconomy')),
      featuresStandard: normalizeFeatureList(getText('featuresStandard')),
      date,
      dateLabel,
      ...(newTourProgramPayload ? { program: newTourProgramPayload } : {}),
      duration,
      location,
      meetingPoint,
      seatsAvailable,
      description: '',
      image: imageUrl,
      bookedSeats: [] as string[],
    }

    if (!db || !isFirebaseConfigured) {
      setSeatStatusMessage('Firebase konfiqurasiyasi tapilmadi. Tur Firestore-a yazilmadi.')
      return
    }

    try {
      const createdRef = await addDoc(collection(db, 'tours'), {
        ...newTourPayload,
      })

      const optimisticTour = normalizeTour({
        id: createdRef.id,
        ...newTourPayload,
      })

      setTours((prev) => [optimisticTour, ...prev.filter((tour) => tour.id !== optimisticTour.id)])
      hasLoadedToursOnceRef.current = true
      setSeatStatusMessage('Tur uğurla əlavə edildi.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Yeni tur Firestore-a yazılarkən xəta baş verdi.'
      setSeatStatusMessage(message)
      return
    }

    setIsAddOpen(false)
    form.reset()
    resetTourFormStates()
  }

  const handleSaveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const updatedTour = buildUpdatedTourFromEdit()
    if (!updatedTour) return

    setIsSeatSaving(true)
    setTours((prev) => prev.map((tour) => (tour.id === updatedTour.id ? updatedTour : tour)))
    setEditingTour(updatedTour)

    try {
      await updateTourInFirestore(updatedTour)
      setSeatStatusMessage('Tur məlumatları uğurla yeniləndi.')
      setIsEditOpen(false)
    } catch {
      setSeatStatusMessage('Tur məlumatları yenilənərkən xəta baş verdi.')
    } finally {
      setIsSeatSaving(false)
    }
  }

  const handleAddAd = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!db || !isFirebaseConfigured) {
      setSeatStatusMessage('Firebase konfiqurasiyası tapılmadı. Reklam Firestore-a yazılmadı.')
      return
    }

    if (!adImageUrl.trim()) {
      setSeatStatusMessage('Reklam üçün qalereyadan şəkil seçin.')
      return
    }

    if (adImageUrl.trim().startsWith('data:')) {
      setSeatStatusMessage('Base64 şəkil qəbul edilmir. Zəhmət olmasa şəkli qalereyadan seçin.')
      return
    }

    setIsAdSaving(true)
    try {
      const payload = {
        imageUrl: adImageUrl.trim(),
        linkUrl: adLinkUrl.trim(),
        createdAt: serverTimestamp(),
      }

      const createdRef = await addDoc(collection(db, 'ads'), payload)

      // Optimistic update for immediate UI feedback; realtime listener will reconcile.
      setAdItems((prev) => [
        {
          id: createdRef.id,
          imageUrl: payload.imageUrl,
          linkUrl: payload.linkUrl,
        },
        ...prev.filter((item) => item.id !== createdRef.id),
      ])

      setAdImageUrl('')
      setAdLinkUrl('')
      setSeatStatusMessage('Reklam banneri uğurla əlavə edildi.')
    } catch {
      setSeatStatusMessage('Reklam banneri əlavə edilərkən xəta baş verdi.')
    } finally {
      setIsAdSaving(false)
    }
  }

  const handleDeleteAd = async (adId: string) => {
    if (!db || !isFirebaseConfigured) {
      setSeatStatusMessage('Firebase konfiqurasiyası tapılmadı. Reklam silinmədi.')
      return
    }

    try {
      await deleteDoc(doc(db, 'ads', adId))
      setSeatStatusMessage('Reklam silindi.')
    } catch {
      setSeatStatusMessage('Reklam silinərkən xəta baş verdi.')
    }
  }

  const handleSendNotification = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!db || !isFirebaseConfigured) {
      setSeatStatusMessage('Firebase konfiqurasiyası tapılmadı. Bildiriş göndərilmədi.')
      return
    }

    if (!notificationText.trim()) {
      setSeatStatusMessage('Zəhmət olmasa bildiriş mətnini daxil edin.')
      return
    }

    setIsNotificationSending(true)
    try {
      await addDoc(collection(db, 'notifications'), {
        message: notificationText.trim(),
        createdAt: serverTimestamp(),
      })
      setNotificationText('')
      setSeatStatusMessage('Bildiriş uğurla göndərildi.')
    } catch {
      setSeatStatusMessage('Bildiriş göndərilərkən xəta baş verdi.')
    } finally {
      setIsNotificationSending(false)
    }
  }

  const startEditingNotification = (item: NotificationAdminItem) => {
    setEditingNotificationId(item.id)
    setEditingNotificationText(item.message)
    setSeatStatusMessage(null)
  }

  const cancelEditingNotification = () => {
    setEditingNotificationId(null)
    setEditingNotificationText('')
  }

  const handleUpdateNotification = async (notificationId: string) => {
    if (!db || !isFirebaseConfigured) {
      setSeatStatusMessage('Firebase konfiqurasiyası tapılmadı. Bildiriş yenilənmədi.')
      return
    }

    const trimmedMessage = editingNotificationText.trim()
    if (!trimmedMessage) {
      setSeatStatusMessage('Bildiriş mətni boş ola bilməz.')
      return
    }

    setNotificationSavingId(notificationId)
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        message: trimmedMessage,
        updatedAt: serverTimestamp(),
      })
      setSeatStatusMessage('Bildiriş yeniləndi.')
      setEditingNotificationId(null)
      setEditingNotificationText('')
    } catch {
      setSeatStatusMessage('Bildiriş yenilənərkən xəta baş verdi.')
    } finally {
      setNotificationSavingId(null)
    }
  }

  const handleDeleteNotification = async (notificationId: string) => {
    if (!db || !isFirebaseConfigured) {
      setSeatStatusMessage('Firebase konfiqurasiyası tapılmadı. Bildiriş silinmədi.')
      return
    }

    setNotificationDeletingId(notificationId)
    try {
      await deleteDoc(doc(db, 'notifications', notificationId))
      setSeatStatusMessage('Bildiriş silindi.')
      if (editingNotificationId === notificationId) {
        setEditingNotificationId(null)
        setEditingNotificationText('')
      }
    } catch {
      setSeatStatusMessage('Bildiriş silinərkən xəta baş verdi.')
    } finally {
      setNotificationDeletingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0610] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-8 lg:flex-row">
        <aside className="w-full rounded-[2rem] border border-white/10 bg-[#120a1a]/80 p-5 shadow-[0_30px_80px_-30px_rgba(120,50,180,0.45)] lg:w-[320px]">
          <div className="mb-8 flex items-center justify-between rounded-3xl bg-[#1f0f33] p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#9b8fc3]">Shenyol Travel</p>
              <h1 className="text-xl font-semibold text-white">Admin Panel</h1>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-brand-pink/10 text-brand-pink">A</div>
          </div>

          <nav className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-3xl px-4 py-3 text-left transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-brand-purple to-brand-pink text-white shadow-[0_15px_40px_-20px_rgba(219,39,119,0.6)]'
                      : 'bg-[#120a1a] text-[#d6cfe8] hover:bg-[#1f0f33]'
                  }`}
                >
                  <Icon className="size-5" />
                  <span className="font-semibold">{tab.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-[#140b23] p-5">
            <p className="text-sm text-[#b5a7e2]">Bələdçi</p>
            <p className="mt-3 text-sm leading-6 text-[#ddd3ff]">
              Buradan turların, sifarişlərin və müştəri statistikalarının idarə edilməsini asanlıqla həyata keçirə bilərsiniz.
            </p>
          </div>
        </aside>

        <section className="flex-1">
          <div className="mb-6 flex flex-col gap-4 rounded-[2rem] bg-[#140b22]/90 p-6 shadow-[0_30px_80px_-30px_rgba(120,50,180,0.45)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[#aa95ff]">Admin Dashboard</p>
                <h2 className="text-3xl font-semibold text-white">Xoş gəlmisiniz, Admin</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-3 rounded-3xl border border-white/10 bg-[#1f0f33] px-4 py-3 text-sm text-[#dcd7ff]">
                  <CalendarDays className="size-4 text-brand-purple" />
                  <select
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    className="bg-transparent text-sm text-[#dcd7ff] outline-none"
                  >
                    {monthOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <div className="inline-flex items-center gap-2 rounded-2xl bg-[#1f0f33] px-4 py-3 text-sm text-[#dcd7ff]">
                  <Search className="size-4 text-brand-yellow" />
                  Axtar
                </div>
              </div>
            </div>
          </div>

          {seatStatusMessage && (
            <div className="mb-6 rounded-3xl border border-white/10 bg-[#150b26]/90 px-5 py-3 text-sm text-[#d6cfe8]">
              {seatStatusMessage}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-[#150b26]/90 p-6 shadow-[0_25px_60px_-30px_rgba(120,50,180,0.35)]">
                <p className="text-sm uppercase tracking-[0.3em] text-[#aa95ff]">Bildiriş Göndər</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Müştəri bildirişi paylaş</h3>
                <form onSubmit={handleSendNotification} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={notificationText}
                    onChange={(event) => setNotificationText(event.target.value)}
                    placeholder="Bildiriş mətni daxil et"
                    className="w-full rounded-3xl border border-white/10 bg-[#120a1f] px-4 py-3 text-sm text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                  />
                  <button
                    type="submit"
                    disabled={isNotificationSending}
                    className="inline-flex min-w-[130px] items-center justify-center rounded-3xl bg-brand-pink px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-purple disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isNotificationSending ? 'Göndərilir...' : 'Göndər'}
                  </button>
                </form>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-[#150b26]/90 p-6 shadow-[0_25px_60px_-30px_rgba(120,50,180,0.35)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-[#aa95ff]">Bildiriş Arxivi</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">Göndərilən bildirişlər</h3>
                  </div>
                  <span className="rounded-2xl bg-[#1f0f33] px-3 py-2 text-xs uppercase tracking-[0.2em] text-[#d6cfe8]">
                    {notifications.length} ədəd
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {notifications.length > 0 ? (
                    notifications.map((item) => {
                      const isEditing = editingNotificationId === item.id
                      const createdAtLabel = item.createdAtMs > 0
                        ? new Date(item.createdAtMs).toLocaleString('az-AZ')
                        : 'Tarix yoxdur'

                      return (
                        <div key={item.id} className="rounded-3xl border border-white/10 bg-[#120a1f] p-4">
                          {isEditing ? (
                            <div className="space-y-3">
                              <textarea
                                value={editingNotificationText}
                                onChange={(event) => setEditingNotificationText(event.target.value)}
                                rows={3}
                                className="w-full resize-y rounded-2xl border border-white/10 bg-[#0e0816] px-4 py-3 text-sm text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                              />
                              <div className="flex flex-wrap justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={cancelEditingNotification}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-[#d6cfe8] transition hover:bg-white/5"
                                >
                                  Ləğv et
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateNotification(item.id)}
                                  disabled={notificationSavingId === item.id}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-pink disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  {notificationSavingId === item.id ? 'Yenilənir...' : 'Yadda saxla'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm leading-6 text-[#d6cfe8]">{item.message}</p>
                              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                <span className="text-xs text-[#9f8fd0]">{createdAtLabel}</span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => startEditingNotification(item)}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-brand-purple/40 px-3 py-2 text-xs font-semibold text-brand-purple transition hover:bg-brand-purple/10"
                                  >
                                    <Edit className="size-3.5" />
                                    Düzəliş et
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteNotification(item.id)}
                                    disabled={notificationDeletingId === item.id}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-[#ff2e7a]/10 px-3 py-2 text-xs font-semibold text-[#ff7eb9] transition hover:bg-[#ff2e7a]/20 disabled:cursor-not-allowed disabled:opacity-70"
                                  >
                                    <Trash2 className="size-3.5" />
                                    {notificationDeletingId === item.id ? 'Silinir...' : 'Sil'}
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 bg-[#120a1f] p-6 text-center text-sm text-[#b0a6e3]">
                      Hələlik göndərilən bildiriş yoxdur.
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Qeydiyyatdan keçən müştəri" value={registeredCustomers} />
                <StatCard label="Aylıq Ümumi Müştəri" value={monthlyCustomers} />
                <StatCard label="Bu Ayın Qazancı" value={`${monthlyIncome} AZN`} />
                <StatCard label="Aktiv Turlar" value={activeToursCount} />
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
                <div className="rounded-[2rem] border border-white/10 bg-[#150b26]/90 p-6 shadow-[0_25px_60px_-30px_rgba(120,50,180,0.35)]">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-[#aa95ff]">Aylıq Trendlər</p>
                      <h3 className="text-xl font-semibold text-white">Müştəri artımı və qazanc</h3>
                    </div>
                    <div className="rounded-2xl bg-brand-purple/10 px-3 py-2 text-sm text-brand-purple">Qrafik</div>
                  </div>
                  <div className="space-y-4">
                    {monthlyGrowth.map((value, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-[#bfb3ff]">
                          <span>{`Ay ${index + 1}`}</span>
                          <span>{value} yeni</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink"
                            style={{ width: `${Math.min(100, value * 3)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[2rem] border border-white/10 bg-[#150b26]/90 p-6 shadow-[0_25px_60px_-30px_rgba(120,50,180,0.35)]">
                  <p className="text-sm uppercase tracking-[0.3em] text-[#aa95ff]">Son Qeydiyyatlar</p>
                  <h3 className="mt-3 text-xl font-semibold text-white">Yeni sifarişlər</h3>
                  <div className="mt-6 space-y-3">
                    {dashboardRecentBookings.length > 0 ? (
                      dashboardRecentBookings.slice(0, 4).map((booking) => (
                        <div key={booking.id} className="rounded-3xl border border-white/10 bg-[#120a1f] p-4">
                          <p className="font-semibold text-white">{booking.name}</p>
                          <p className="text-sm text-[#b0a6e3]">{booking.phone}</p>
                          <p className="mt-2 text-sm text-[#d6cfe8]">{booking.tour} · {booking.seat} · {booking.date}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-3xl border border-dashed border-white/10 bg-[#120a1f] p-6 text-center text-sm text-[#b0a6e3]">
                        Bu ay üzrə heç bir sifariş tapılmadı.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-[#150b26]/90 p-6 shadow-[0_25px_60px_-30px_rgba(120,50,180,0.35)]">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-[#aa95ff]">Qeydiyyatlı İstifadəçilər</p>
                    <h3 className="text-xl font-semibold text-white">Sistemdə qeydiyyatdan keçən müştərilər</h3>
                  </div>
                  <span className="rounded-full bg-[#1f0f33] px-3 py-2 text-xs uppercase tracking-[0.3em] text-[#d6cfe8]">Yeni</span>
                </div>
                <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#120a1f]">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-[#170a28] text-left text-xs uppercase tracking-[0.25em] text-[#9f8de5]">
                      <tr>
                        <th className="px-5 py-4">Ad</th>
                        <th className="px-5 py-4">Soyad</th>
                        <th className="px-5 py-4">Telefon</th>
                        <th className="px-5 py-4">Qeydiyyat tarixi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrations.map((registration) => (
                        <tr key={registration.id} className="border-t border-white/10 hover:bg-white/5">
                          <td className="px-5 py-4">{registration.firstName}</td>
                          <td className="px-5 py-4">{registration.lastName}</td>
                          <td className="px-5 py-4">{registration.phone}</td>
                          <td className="px-5 py-4">{new Date(registration.createdAt).toLocaleDateString('az-AZ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tours' && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-[#150b26]/90 p-6 shadow-[0_25px_60px_-30px_rgba(120,50,180,0.35)] sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-[#aa95ff]">Tur idarəsi</p>
                  <h3 className="text-2xl font-semibold text-white">Mövcud Turlar</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-3xl bg-brand-purple px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-pink"
                >
                  Yeni Tur Əlavə Et
                </button>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                {tours.map((tour) => (
                  <div key={tour.id} className="rounded-[2rem] border border-white/10 bg-[#120a1f] p-5 shadow-[0_25px_60px_-30px_rgba(120,50,180,0.25)]">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                          <p className="text-sm text-[#aa95ff]">{tour.dateLabel || tour.date} · {tour.duration}</p>
                        <h4 className="mt-2 text-xl font-semibold text-white">{tour.name}</h4>
                          <p className="mt-1 text-sm text-[#d6cfe8]">{tour.location}</p>
                        {tour.meetingPoint ? (
                          <p className="mt-1 text-xs text-[#b7adff]">Toplanış: {tour.meetingPoint}</p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#d6cfe8]">
                          <span className="rounded-2xl bg-[#1f0f33] px-3 py-1">Ekonom: {tour.priceEconomy} AZN</span>
                          <span className="rounded-2xl bg-[#1f0f33] px-3 py-1">Standart: {tour.priceStandard} AZN</span>
                        </div>
                        <p className="mt-2 text-xs text-[#9f8fd0]">
                          Ekonom özəllikləri: {tour.featuresEconomy.length || 0} · Standart özəllikləri: {tour.featuresStandard.length || 0}
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[#d6cfe8]">{tour.description}</p>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <div className="rounded-3xl bg-[#1f0f33] px-4 py-3 text-sm text-[#dcd7ff]">Boş yer: {tour.seatsAvailable}</div>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => openEditModal(tour)}
                          className="inline-flex items-center gap-2 rounded-3xl border border-brand-purple/40 bg-transparent px-4 py-2 text-sm font-semibold text-brand-purple transition hover:bg-brand-purple/10"
                        >
                          <Edit className="size-4" />
                          Düzəliş et
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTour(tour.id)}
                          className="inline-flex items-center gap-2 rounded-3xl bg-[#ff2e7a]/10 px-4 py-2 text-sm font-semibold text-[#ff7eb9] transition hover:bg-[#ff2e7a]/20"
                        >
                          <Trash2 className="size-4" />
                          Sil
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'ads' && (
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-[#150b26]/90 p-6 shadow-[0_25px_60px_-30px_rgba(120,50,180,0.35)]">
                <p className="text-sm uppercase tracking-[0.3em] text-[#aa95ff]">Reklam İdarəetməsi</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Reklam Banneri Əlavə Et</h3>
                <form onSubmit={handleAddAd} className="mt-6 grid gap-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="block text-sm text-[#c5bde8]">
                      Qalereyadan şəkil seç
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAdImageFileChange}
                        className="mt-2 w-full rounded-3xl border border-white/10 bg-[#0e0816] px-4 py-3 text-sm text-white file:mr-4 file:rounded-2xl file:border-0 file:bg-brand-purple file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                      />
                    </label>
                    <label className="block text-sm text-[#c5bde8]">
                      Yüklənən şəkil linki
                      <input
                        type="text"
                        value={adImageUrl}
                        readOnly
                        placeholder="Sekil secdikden sonra avtomatik dolacaq"
                        className="mt-2 w-full rounded-3xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white/80 outline-none"
                      />
                    </label>
                    <label className="block text-sm text-[#c5bde8]">
                      Keçid linki
                      <input
                        type="url"
                        value={adLinkUrl}
                        onChange={(event) => setAdLinkUrl(event.target.value)}
                        placeholder="https://..."
                        className="mt-2 w-full rounded-3xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                      />
                    </label>
                  </div>
                  <div className="w-full h-40 sm:h-48 rounded-3xl overflow-hidden relative border border-white/10 bg-[#120a1f]">
                    {adImageUrl.trim() ? (
                      <Image
                        src={adImageUrl}
                        alt="Reklam önbaxışı"
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 100vw, 768px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-[#b0a6e3]">
                        Önizləmə üçün şəkil linki daxil edin
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isAdSaving}
                      className="rounded-3xl bg-brand-pink px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-purple disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isAdSaving ? 'Yadda saxlanır...' : 'Yadda Saxla'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-[#150b26]/90 p-6 shadow-[0_25px_60px_-30px_rgba(120,50,180,0.35)]">
                <h4 className="text-xl font-semibold text-white">Mövcud Reklamlar</h4>
                <div className="mt-4 space-y-3">
                  {adItems.length > 0 ? (
                    adItems.map((ad) => (
                      <div key={ad.id} className="rounded-3xl border border-white/10 bg-[#120a1f] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="relative h-16 w-28 overflow-hidden rounded-xl border border-white/10 bg-[#0e0816]">
                            <Image
                              src={ad.imageUrl}
                              alt="Reklam thumbnail"
                              fill
                              unoptimized
                              sizes="112px"
                              className="object-cover"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteAd(ad.id)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-[#ff2e7a]/10 px-4 py-2 text-sm font-semibold text-[#ff7eb9] transition hover:bg-[#ff2e7a]/20"
                          >
                            <Trash2 className="size-4" />
                            Sil
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 bg-[#120a1f] p-6 text-center text-sm text-[#b0a6e3]">
                      Hələlik reklam əlavə edilməyib.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-[#150b26]/90 p-6 shadow-[0_25px_60px_-30px_rgba(120,50,180,0.35)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-[#aa95ff]">Müştəri məlumatları</p>
                    <h3 className="text-2xl font-semibold text-white">Tam sifariş bazası</h3>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="relative block">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b8aefe]" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Axtar..."
                        className="w-full rounded-3xl border border-white/10 bg-[#120a1f] py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                      />
                    </label>
                    <select
                      value={filterDistrict}
                      onChange={(event) => setFilterDistrict(event.target.value)}
                      className="rounded-3xl border border-white/10 bg-[#120a1f] py-3 px-4 text-sm text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                    >
                      {districtOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(event) => setFilterDate(event.target.value)}
                      className="rounded-3xl border border-white/10 bg-[#120a1f] py-3 px-4 text-sm text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                    />
                  </div>
                </div>
              </div>
              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#120a1f] shadow-[0_25px_60px_-30px_rgba(120,50,180,0.35)]">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-[#170a28] text-left text-xs uppercase tracking-[0.25em] text-[#9f8de5]">
                    <tr>
                      <th className="px-5 py-4">Ad</th>
                      <th className="px-5 py-4">Telefon</th>
                      <th className="px-5 py-4">Tur</th>
                      <th className="px-5 py-4">Alınan paket</th>
                      <th className="px-5 py-4">Məbləğ</th>
                      <th className="px-5 py-4">Oturacaq</th>
                      <th className="px-5 py-4">Tarix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.length > 0 ? (
                      filteredBookings.map((booking) => (
                        <tr key={booking.id} className="border-t border-white/10 hover:bg-white/5">
                          <td className="px-5 py-4">{booking.name}</td>
                          <td className="px-5 py-4">{booking.phone}</td>
                          <td className="px-5 py-4">{booking.tour}</td>
                          <td className="px-5 py-4">
                            {booking.packageType === 'economy'
                              ? 'Ekonom alıb'
                              : booking.packageType === 'standard'
                                ? 'Standart alıb'
                                : '—'}
                          </td>
                          <td className="px-5 py-4">{booking.price || (booking.totalPrice ? `${booking.totalPrice} AZN` : '—')}</td>
                          <td className="px-5 py-4">{booking.seat}</td>
                          <td className="px-5 py-4">{booking.date}</td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t border-white/10">
                        <td colSpan={7} className="px-5 py-6 text-center text-sm text-[#b0a6e3]">
                          Seçilən rayon və tarixə uyğun sifariş tapılmadı.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      {(isAddOpen || isEditOpen) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-4 md:items-center md:py-8">
          <div className="my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col rounded-[2rem] border border-white/10 bg-[#120a1f] p-6 shadow-[0_40px_100px_-40px_rgba(120,50,180,0.65)] md:max-h-[calc(100dvh-4rem)]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[#aa95ff]">{isEditOpen ? 'Turu Düzəliş Et' : 'Yeni Tur Əlavə Et'}</p>
                <h3 className="text-2xl font-semibold text-white">{isEditOpen ? editingTour?.name : 'Yeni Tur'}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false)
                  setIsEditOpen(false)
                }}
                className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-[#1f0f33] text-[#dcd7ff] transition hover:bg-[#2e1848]"
              >
                <X className="size-5" />
              </button>
            </div>
            <form onSubmit={isEditOpen ? handleSaveEdit : handleAddTour} className="grid gap-5 overflow-y-auto pr-1">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-[#c5bde8]">
                  Turun adı
                  <input
                    name="name"
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    required
                    className="mt-2 w-full rounded-3xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                  />
                </label>
                <label className="block text-sm text-[#c5bde8]">
                  Ekonom Qiymət (AZN)
                  <input
                    type="number"
                    name="priceEconomy"
                    min={0}
                    value={editingPriceEconomy}
                    onChange={(event) => setEditingPriceEconomy(event.target.value)}
                    required
                    className="mt-2 w-full rounded-3xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                  />
                </label>
                <label className="block text-sm text-[#c5bde8]">
                  Standart Qiymət (AZN)
                  <input
                    type="number"
                    name="priceStandard"
                    min={0}
                    value={editingPriceStandard}
                    onChange={(event) => setEditingPriceStandard(event.target.value)}
                    required
                    className="mt-2 w-full rounded-3xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                  />
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-[#c5bde8]">
                  Ekonom Özəllikləri
                  <textarea
                    name="featuresEconomy"
                    value={editingFeaturesEconomy}
                    onChange={(event) => setEditingFeaturesEconomy(event.target.value)}
                    rows={3}
                    placeholder="Su xidməti, Standart oturacaq"
                    className="mt-2 w-full rounded-3xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                  />
                </label>
                <label className="block text-sm text-[#c5bde8]">
                  Standart Özəllikləri
                  <textarea
                    name="featuresStandard"
                    value={editingFeaturesStandard}
                    onChange={(event) => setEditingFeaturesStandard(event.target.value)}
                    rows={3}
                    placeholder="Nahar daxil, VIP oturacaq, Hədiyyəli bilet"
                    className="mt-2 w-full rounded-3xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                  />
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-[#c5bde8]">
                  Tarix
                  <input
                    type="date"
                    name="date"
                    value={editingDate}
                    onChange={(event) => setEditingDate(event.target.value)}
                    required
                    className="mt-2 w-full rounded-3xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                  />
                </label>
                <label className="block text-sm text-[#c5bde8]">
                  Tarix etiketi (ayın tarixi)
                  <input
                    type="text"
                    name="dateLabel"
                    value={editingDateLabel}
                    onChange={(event) => setEditingDateLabel(event.target.value)}
                    placeholder="məs: 15 Avqust"
                    className="mt-2 w-full rounded-3xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                  />
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-[#c5bde8]">
                  Müddət
                  <input
                    type="text"
                    name="duration"
                    value={editingDuration}
                    onChange={(event) => setEditingDuration(event.target.value)}
                    placeholder="məs: 3 gün"
                    required
                    className="mt-2 w-full rounded-3xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                  />
                </label>
                <label className="block text-sm text-[#c5bde8]">
                  Bölgə
                  <input
                    type="text"
                    name="location"
                    value={editingLocation}
                    onChange={(event) => setEditingLocation(event.target.value)}
                    placeholder="məs: Şəki, Azərbaycan"
                    required
                    className="mt-2 w-full rounded-3xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                  />
                </label>
                <label className="block text-sm text-[#c5bde8]">
                  Toplanış yeri
                  <input
                    type="text"
                    name="meetingPoint"
                    value={editingMeetingPoint}
                    onChange={(event) => setEditingMeetingPoint(event.target.value)}
                    placeholder="məs: Gənclik m/s qarşısı"
                    className="mt-2 w-full rounded-3xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                  />
                </label>
                <label className="block text-sm text-[#c5bde8]">
                  Boş yer sayı
                  <input
                    type="number"
                    name="seatsAvailable"
                    min={1}
                    value={editingSeatCapacityInput}
                    onChange={(event) => {
                      const raw = event.target.value
                      setEditingSeatCapacityInput(raw)
                      const parsed = Number(raw)
                      if (raw !== '' && Number.isFinite(parsed) && parsed > 0) {
                        const nextCapacity = Math.floor(parsed)
                        setEditingSeatCapacity(nextCapacity)
                        if (isEditOpen && activeEditingBus) {
                          setEditingBuses((prev) =>
                            prev.map((bus) => (bus.id === activeEditingBus.id ? { ...bus, capacity: nextCapacity } : bus)),
                          )
                        }
                      }
                    }}
                    onBlur={() => {
                      const parsed = Number(editingSeatCapacityInput)
                      const next = Math.max(1, Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : editingSeatCapacity)
                      setEditingSeatCapacity(next)
                      setEditingSeatCapacityInput(String(next))
                      if (isEditOpen && activeEditingBus) {
                        const nextLayout = createSeatLayout(next)
                        setEditingBuses((prev) =>
                          prev.map((bus) =>
                            bus.id === activeEditingBus.id
                              ? {
                                  ...bus,
                                  capacity: next,
                                  seats: sortSeatIdsByLayout(
                                    bus.seats.filter((seat) => nextLayout.seatIdSet.has(seat)),
                                    nextLayout.seatIds,
                                  ),
                                }
                              : bus,
                          ),
                        )
                      }
                    }}
                    required
                    className="mt-2 w-full rounded-3xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                  />
                </label>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#0f0919] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Tur Proqramı və Şərtlər Bloku</p>
                    <p className="text-xs text-[#b7abd8]">Bu blok aktiv olsa, tur detallarında standart premium görünüş ilə açılacaq.</p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-[#1b1030] px-3 py-2 text-xs text-[#d9d1f3]">
                    <input
                      type="checkbox"
                      name="programEnabled"
                      checked={editingProgramEnabled}
                      onChange={(event) => setEditingProgramEnabled(event.target.checked)}
                      className="size-4 accent-brand-pink"
                    />
                    Aktiv et
                  </label>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <label className="block text-sm text-[#c5bde8]">
                    Toplanış planı
                    <input
                      type="text"
                      name="programGathering"
                      value={editingProgramGathering}
                      onChange={(event) => setEditingProgramGathering(event.target.value)}
                      placeholder="məs: 01:00 - 01:30 | Gənclik m/s qarşısı"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                    />
                  </label>
                  <label className="block text-sm text-[#c5bde8]">
                    Yola düşmə
                    <input
                      type="text"
                      name="programDeparture"
                      value={editingProgramDeparture}
                      onChange={(event) => setEditingProgramDeparture(event.target.value)}
                      placeholder="məs: 01:30"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                    />
                  </label>
                  <label className="block text-sm text-[#c5bde8]">
                    Geri dönüş
                    <input
                      type="text"
                      name="programReturn"
                      value={editingProgramReturn}
                      onChange={(event) => setEditingProgramReturn(event.target.value)}
                      placeholder="məs: 23:00 - 23:30"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <label className="block text-sm text-[#c5bde8]">
                    Qiymətə daxildir (hər sətir 1 bənd)
                    <textarea
                      name="programIncludedItems"
                      value={editingProgramIncludedItems}
                      onChange={(event) => setEditingProgramIncludedItems(event.target.value)}
                      rows={6}
                      placeholder="Komfortlu nəqliyyat\nPeşəkar bələdçi"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                    />
                  </label>
                  <label className="block text-sm text-[#c5bde8]">
                    Gəziləcək məkanlar (hər sətir 1 bənd)
                    <textarea
                      name="programPlacesItems"
                      value={editingProgramPlacesItems}
                      onChange={(event) => setEditingProgramPlacesItems(event.target.value)}
                      rows={6}
                      placeholder="Mamırlı Şəlaləsi\nKürmük Kilsəsi"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                    />
                  </label>
                  <label className="block text-sm text-[#c5bde8]">
                    Vacib qeydlər (hər sətir 1 bənd)
                    <textarea
                      name="programNotesItems"
                      value={editingProgramNotesItems}
                      onChange={(event) => setEditingProgramNotesItems(event.target.value)}
                      rows={6}
                      placeholder="10+1 kampaniyası\n0-5 yaş ödənişsiz"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0e0816] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
                    />
                  </label>
                </div>
              </div>

              {isEditOpen && editingTour && (
                <div className="rounded-3xl border border-white/10 bg-[#0e0816] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-[#aa95ff]">Oturacaq İdarəetmə</p>
                      <p className="mt-1 text-sm text-[#c5bde8]">
                        {activeEditingBus?.name ?? 'Avtobus 1'} · Dolu: {editingBookedSeats.length} / {editingSeatCapacity}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSeatManagerOpen(true)}
                      className="rounded-2xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-pink"
                    >
                      Oturacaqları İdarə Et
                    </button>
                  </div>
                </div>
              )}
              <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
                <div className="rounded-3xl border border-dashed border-white/10 bg-[#120a1f] p-4 text-center text-sm text-[#b7adff]">
                  <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#1f0f33] text-brand-purple">
                    <CreditCard className="size-6" />
                  </div>
                  <p className="font-semibold text-white">Şəkil yükləmə</p>
                  <input
                    type="file"
                    name="image"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="mt-4 w-full cursor-pointer rounded-3xl border border-white/10 bg-[#0e0816] px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-brand-purple file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                  />
                </div>
                <div className="rounded-3xl border border-white/10 bg-[#0e0816] p-4">
                  <p className="text-sm uppercase tracking-[0.3em] text-[#aa95ff]">Hazır görüntü</p>
                  <div className="relative mt-4 h-40 rounded-[1.5rem] bg-[#1f0f33] p-4">
                    {imagePreview ? (
                      <Image
                        src={imagePreview}
                        alt="Seçilmiş tur şəkli"
                        fill
                        sizes="(max-width: 1024px) 100vw, 40vw"
                        className="rounded-[1.25rem] object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-[#b7adff]">
                        Şəkil burada göstəriləcək
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false)
                    setIsEditOpen(false)
                    setIsSeatManagerOpen(false)
                  }}
                  className="rounded-3xl bg-[#1f0f33] px-6 py-3 text-sm font-semibold text-[#c5bde8] transition hover:bg-[#2e1848]"
                >
                  İmtina
                </button>
                <button
                  type="submit"
                  className="rounded-3xl bg-brand-pink px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-purple"
                >
                  Saxla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditOpen && isSeatManagerOpen && editingTour && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-8">
          <div className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-[#120a1f] p-6 shadow-[0_40px_100px_-40px_rgba(120,50,180,0.65)] max-h-[80vh] overflow-y-auto">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[#aa95ff]">Oturacaq İdarəetmə</p>
                <h3 className="text-2xl font-semibold text-white">{editingTour.name}</h3>
                <p className="mt-1 text-sm text-[#c5bde8]">
                  {activeEditingBus?.name ?? 'Avtobus 1'} · Dolu: {editingBookedSeats.length} / {editingSeatCapacity}
                </p>
                <p className="mt-1 text-xs text-[#978ac9]">
                  {seatLayout.isSprinter ? 'Sprinter sxemi: sol 2 + koridor + sağ 1 + arxa 4' : 'Avtobus sxemi: sol 2 + sağ 2 + koridor + arxa 6'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSeatManagerOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-[#1f0f33] text-[#dcd7ff] transition hover:bg-[#2e1848]"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {editingBuses.map((bus) => {
                const isActive = bus.id === activeEditingBus?.id
                return (
                  <button
                    key={bus.id}
                    type="button"
                    onClick={() => handleSelectEditingBus(bus.id)}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-brand-purple text-white'
                        : 'bg-[#1f0f33] text-[#dcd7ff] hover:bg-[#2e1848]'
                    }`}
                  >
                    {bus.name}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => {
                  void handleAddBus(20)
                }}
                className="rounded-2xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/30"
              >
                + Avtobus (20)
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleAddBus(50)
                }}
                className="rounded-2xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/30"
              >
                + Avtobus (50)
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDeleteBus()
                }}
                disabled={editingBuses.length <= 1}
                className="rounded-2xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Aktiv Avtobusu Sil
              </button>
              <button
                type="button"
                onClick={handleClearAllSeats}
                disabled={isSeatSaving}
                className="rounded-2xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Bütün Yerləri Boşalt
              </button>
            </div>

            {seatStatusMessage && (
              <p className="mt-3 rounded-2xl border border-white/10 bg-[#120a1f] px-3 py-2 text-sm text-[#d6cfe8]">
                {seatStatusMessage}
              </p>
            )}

            {isTourLoading && (
              <p className="mt-3 rounded-2xl border border-white/10 bg-[#120a1f] px-3 py-2 text-sm text-[#d6cfe8]">
                Firestore-dan ən son tur məlumatları yüklənir...
              </p>
            )}

            <div className="mx-auto mt-4 w-full max-w-[420px] rounded-[1.8rem] border-2 border-white/10 bg-[#120a1f] p-4">
              <div className="mb-4 flex items-center justify-between border-b border-dashed border-white/10 pb-3 text-xs uppercase tracking-[0.25em] text-[#aa95ff]">
                <span>Sükan</span>
                <span>Koridor</span>
              </div>

              <div className="space-y-2">
                {seatLayout.rows.map(({ rowNumber, left, right }) => (
                  <div
                    key={rowNumber}
                    className={
                      seatLayout.isSprinter
                        ? 'grid grid-cols-[1fr_0.8fr_1fr_1fr] items-center gap-1'
                        : 'grid grid-cols-[1fr_1fr_0.7fr_1fr_1fr] items-center gap-1'
                    }
                  >
                    {seatLayout.isSprinter ? (
                      <>
                        {[0, 1].map((index) => {
                          const letter = left[index]
                          if (!letter) return <div key={`left-empty-${rowNumber}-${index}`} className="h-9" />

                          const seatId = `${rowNumber}${letter}`
                          const isBooked = editingBookedSeats.includes(seatId)
                          return (
                            <button
                              key={seatId}
                              type="button"
                              onClick={() => toggleAdminSeat(seatId)}
                              className={`flex h-9 items-center justify-center rounded-lg border text-xs font-semibold transition ${
                                isBooked
                                  ? 'border-red-500 bg-red-500/90 text-white hover:bg-red-500'
                                  : 'border-emerald-500 bg-emerald-500/90 text-white hover:bg-emerald-500'
                              }`}
                            >
                              {seatId}
                            </button>
                          )
                        })}

                        <div className="flex h-9 items-center justify-center rounded-lg border border-dashed border-white/10 text-[10px] text-transparent">
                          {rowNumber}
                        </div>

                        {right[0] ? (
                          (() => {
                            const seatId = `${rowNumber}${right[0]}`
                            const isBooked = editingBookedSeats.includes(seatId)
                            return (
                              <button
                                key={seatId}
                                type="button"
                                onClick={() => toggleAdminSeat(seatId)}
                                className={`flex h-9 items-center justify-center rounded-lg border text-xs font-semibold transition ${
                                  isBooked
                                    ? 'border-red-500 bg-red-500/90 text-white hover:bg-red-500'
                                    : 'border-emerald-500 bg-emerald-500/90 text-white hover:bg-emerald-500'
                                }`}
                              >
                                {seatId}
                              </button>
                            )
                          })()
                        ) : (
                          <div className="h-9" />
                        )}
                      </>
                    ) : (
                      <>
                        {[0, 1].map((index) => {
                          const letter = left[index]
                          if (!letter) return <div key={`left-empty-${rowNumber}-${index}`} className="h-9" />

                          const seatId = `${rowNumber}${letter}`
                          const isBooked = editingBookedSeats.includes(seatId)
                          return (
                            <button
                              key={seatId}
                              type="button"
                              onClick={() => toggleAdminSeat(seatId)}
                              className={`flex h-9 items-center justify-center rounded-lg border text-xs font-semibold transition ${
                                isBooked
                                  ? 'border-red-500 bg-red-500/90 text-white hover:bg-red-500'
                                  : 'border-emerald-500 bg-emerald-500/90 text-white hover:bg-emerald-500'
                              }`}
                            >
                              {seatId}
                            </button>
                          )
                        })}

                        <div className="flex h-9 items-center justify-center rounded-lg border border-dashed border-white/10 text-[10px] text-[#8f84b8]">
                          {rowNumber}
                        </div>

                        {[0, 1].map((index) => {
                          const letter = right[index]
                          if (!letter) return <div key={`right-empty-${rowNumber}-${index}`} className="h-9" />

                          const seatId = `${rowNumber}${letter}`
                          const isBooked = editingBookedSeats.includes(seatId)
                          return (
                            <button
                              key={seatId}
                              type="button"
                              onClick={() => toggleAdminSeat(seatId)}
                              className={`flex h-9 items-center justify-center rounded-lg border text-xs font-semibold transition ${
                                isBooked
                                  ? 'border-red-500 bg-red-500/90 text-white hover:bg-red-500'
                                  : 'border-emerald-500 bg-emerald-500/90 text-white hover:bg-emerald-500'
                              }`}
                            >
                              {seatId}
                            </button>
                          )
                        })}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {seatLayout.rearSeatIds.length > 0 && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-[#0e0816] p-3">
                  <p className="mb-2 text-center text-xs uppercase tracking-[0.2em] text-[#aa95ff]">Arxa Sıra</p>
                  <div className={seatLayout.isSprinter ? 'grid grid-cols-4 gap-1' : 'grid grid-cols-6 gap-1'}>
                    {seatLayout.rearSeatIds.map((seatId) => {
                      const isBooked = editingBookedSeats.includes(seatId)
                      return (
                        <button
                          key={seatId}
                          type="button"
                          onClick={() => toggleAdminSeat(seatId)}
                          className={`flex h-9 items-center justify-center rounded-lg border text-xs font-semibold transition ${
                            isBooked
                              ? 'border-red-500 bg-red-500/90 text-white hover:bg-red-500'
                              : 'border-emerald-500 bg-emerald-500/90 text-white hover:bg-emerald-500'
                          }`}
                        >
                          {seatId}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-[#150b26]/90 p-6 shadow-[0_20px_50px_-20px_rgba(120,50,180,0.35)]">
      <p className="text-sm uppercase tracking-[0.3em] text-[#aa95ff]">{label}</p>
      <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
    </div>
  )
}
