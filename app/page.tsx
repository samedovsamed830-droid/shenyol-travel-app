'use client'

import { useEffect, useState } from 'react'
import { SplashScreen } from '@/components/splash-screen'
import { HomeScreen } from '@/components/home-screen'
import { SeatSelector } from '@/components/seat-selector'
import { FloatingActionBar } from '@/components/floating-action-bar'
import { PaymentScreen } from '@/components/payment-screen'
import { TourDetails } from '@/components/tour-details'
import { RegistrationScreen } from '@/components/registration-screen'
import { LanguageSwitcher } from '@/components/language-switcher'
import { I18nProvider } from '@/lib/i18n'
import type { Tour } from '@/components/tour-card'

type Screen = 'splash' | 'home' | 'details' | 'register' | 'seats' | 'payment'
type PricePackage = 'economy' | 'standard'

type UserProfile = {
  firstName: string
  lastName: string
  phone: string
}

type Registration = UserProfile & {
  id: string
  createdAt: string
}

const PENDING_RESERVE_TOUR_KEY = 'shenyol-pending-reserve-tour-id'
const PENDING_RESERVE_ACTION_KEY = 'shenyol-pending-reserve-action'

export default function Page() {
  return (
    <I18nProvider>
      <ShenyolApp />
    </I18nProvider>
  )
}

function ShenyolApp() {
  const [screen, setScreen] = useState<Screen>(() => {
    if (typeof window === 'undefined') return 'splash'
    const pendingAction = window.localStorage.getItem(PENDING_RESERVE_ACTION_KEY)
    return pendingAction === 'reserve' ? 'home' : 'splash'
  })
  const [tour, setTour] = useState<Tour | null>(null)
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null)
  const [selectedSeats, setSelectedSeats] = useState<string[]>([])
  const [selectedPackage, setSelectedPackage] = useState<PricePackage>('economy')
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    if (typeof window === 'undefined') return null
    const stored = window.localStorage.getItem('shenyol-current-user')
    if (!stored) return null
    try {
      return JSON.parse(stored) as UserProfile
    } catch {
      return null
    }
  })

  const showTourDetails = (t: Tour) => {
    setTour(t)
    setSelectedBusId(t.buses?.[0]?.id ?? 'bus_1')
    setSelectedSeats([])
    setSelectedPackage('economy')

    let shouldOpenReserveFlow = false
    if (typeof window !== 'undefined') {
      const pendingAction = window.localStorage.getItem(PENDING_RESERVE_ACTION_KEY)
      const pendingTourId = window.localStorage.getItem(PENDING_RESERVE_TOUR_KEY)
      shouldOpenReserveFlow = pendingAction === 'reserve' && pendingTourId === t.id

      if (shouldOpenReserveFlow) {
        window.localStorage.removeItem(PENDING_RESERVE_ACTION_KEY)
        window.localStorage.removeItem(PENDING_RESERVE_TOUR_KEY)
      }
    }

    if (shouldOpenReserveFlow) {
      setScreen(currentUser ? 'seats' : 'register')
      return
    }

    setScreen('details')
  }

  const selectTour = (t: Tour) => {
    setTour(t)
    setSelectedBusId(t.buses?.[0]?.id ?? 'bus_1')
    setSelectedSeats([])
    setSelectedPackage('economy')
    setScreen('seats')
  }

  const registerCustomer = (userProfile: UserProfile) => {
    const registration: Registration = {
      id: `reg-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...userProfile,
    }

    setCurrentUser(userProfile)
    window.localStorage.setItem('shenyol-current-user', JSON.stringify(userProfile))

    const stored = window.localStorage.getItem('shenyol-registrations')
    const registrations: Registration[] = stored ? JSON.parse(stored) : []
    const existingIndex = registrations.findIndex((item) => item.phone === userProfile.phone)
    if (existingIndex >= 0) {
      registrations[existingIndex] = {
        ...registrations[existingIndex],
        ...registration,
      }
    } else {
      registrations.push(registration)
    }
    window.localStorage.setItem('shenyol-registrations', JSON.stringify(registrations))

    setScreen('seats')
  }

  const restart = () => {
    setSelectedBusId(null)
    setSelectedSeats([])
    setSelectedPackage('economy')
    setTour(null)
    setScreen('home')
  }

  const unitPrice = tour
    ? selectedPackage === 'economy'
      ? Number(tour.priceEconomy ?? tour.price ?? 0)
      : Number(tour.priceStandard ?? tour.price ?? 0)
    : 0
  const total = tour ? selectedSeats.length * unitPrice : 0

  return (
    <main className="flex min-h-dvh w-full justify-center bg-gradient-to-b from-secondary to-background">
      {/* phone frame */}
      <div className="relative mx-auto flex min-h-dvh w-full max-w-full flex-col overflow-hidden bg-background px-0 md:max-w-7xl md:px-4">
        {/* language switcher floats on splash where there's no header */}
        {screen === 'splash' && (
          <div className="absolute right-4 top-4 z-50">
            <LanguageSwitcher />
          </div>
        )}
        <div className="relative flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {screen === 'splash' && (
            <SplashScreen onEnter={() => setScreen('home')} />
          )}

          {screen === 'home' && <HomeScreen onSelectTour={showTourDetails} />}

          {screen === 'details' && tour && (
            <TourDetails
              tour={tour}
              selectedPackage={selectedPackage}
              setSelectedPackage={setSelectedPackage}
              onBack={() => setScreen('home')}
              onReserve={() => (currentUser ? setScreen('seats') : setScreen('register'))}
            />
          )}

          {screen === 'register' && tour && (
            <RegistrationScreen
              tour={tour}
              onBack={() => setScreen('details')}
              onRegister={registerCustomer}
            />
          )}

          {screen === 'seats' && tour && (
            <SeatSelector
              tour={tour}
              selectedBusId={selectedBusId}
              setSelectedBusId={setSelectedBusId}
              selectedSeats={selectedSeats}
              setSelectedSeats={setSelectedSeats}
              selectedPackage={selectedPackage}
              setSelectedPackage={setSelectedPackage}
              onBack={() => setScreen('home')}
            />
          )}

          {screen === 'payment' && tour && (
            <PaymentScreen
              tour={tour}
              selectedBusId={selectedBusId}
              seats={selectedSeats}
              selectedPackage={selectedPackage}
              contact={currentUser?.phone ?? null}
              onBack={() => setScreen('seats')}
              onRestart={restart}
            />
          )}
        </div>

        {/* bottom action bar only on seat selection */}
        {screen === 'seats' && (
          <FloatingActionBar
            seatCount={selectedSeats.length}
            total={total}
            packageLabel={selectedPackage === 'economy' ? 'Ekonom' : 'Standart'}
            onProceed={() => setScreen('payment')}
          />
        )}
      </div>
    </main>
  )
}
