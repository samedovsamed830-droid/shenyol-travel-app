'use client'

import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { ArrowLeft, Check, Disc3, Minus, Plus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import type { Tour } from '@/components/tour-card'
import { db, isFirebaseConfigured } from '@/lib/firebase'
import { createSeatLayout, normalizeTourBuses, sortSeatIdsByLayout, type TourBus } from '@/lib/seat-layout'

const busesEqual = (a: TourBus[], b: TourBus[]): boolean => {
  if (a.length !== b.length) return false

  return a.every((bus, index) => {
    const other = b[index]
    if (!other) return false
    if (bus.id !== other.id || bus.name !== other.name || bus.capacity !== other.capacity) return false
    if (bus.seats.length !== other.seats.length) return false
    return bus.seats.every((seat, seatIndex) => seat === other.seats[seatIndex])
  })
}

const stringArraysEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

function Seat({
  id,
  state,
  onToggle,
}: {
  id: string
  state: 'free' | 'selected' | 'occupied'
  onToggle: (id: string) => void
}) {
  const isOccupied = state === 'occupied'
  const selected = state === 'selected'

  return (
    <button
      type="button"
      onClick={() => !isOccupied && onToggle(id)}
      disabled={isOccupied}
      aria-disabled={isOccupied}
      aria-pressed={selected}
      aria-label={`Seat ${id}${selected ? ', selected' : ''}${isOccupied ? ', occupied' : ''}`}
      className={cn(
        'flex size-10 items-center justify-center rounded-xl text-xs font-bold transition-colors duration-200',
        isOccupied
          ? 'cursor-not-allowed border border-red-500 bg-red-500 text-white shadow-lg shadow-red-500/20'
          : selected
            ? 'animate-seat-pop bg-gradient-to-br from-brand-pink to-brand-purple text-primary-foreground shadow-lg shadow-brand-purple/30'
            : 'border border-border bg-secondary text-muted-foreground hover:border-brand-purple/40',
      )}
    >
      {id}
    </button>
  )
}

export function SeatSelector({
  tour,
  selectedBusId,
  setSelectedBusId,
  selectedSeats,
  setSelectedSeats,
  selectedPackage,
  setSelectedPackage,
  onBack,
}: {
  tour: Tour
  selectedBusId: string | null
  setSelectedBusId: (busId: string) => void
  selectedSeats: string[]
  setSelectedSeats: (updater: (prev: string[]) => string[]) => void
  selectedPackage: 'economy' | 'standard'
  setSelectedPackage: (pkg: 'economy' | 'standard') => void
  onBack: () => void
}) {
  const { t } = useI18n()
  const [buses, setBuses] = useState<TourBus[]>(() =>
    normalizeTourBuses(tour.buses, Number(tour.seatsAvailable ?? 20), tour.bookedSeats),
  )

  const activeBus = useMemo(() => {
    const fallback = buses[0]
    if (!selectedBusId) return fallback
    return buses.find((bus) => bus.id === selectedBusId) ?? fallback
  }, [buses, selectedBusId])

  const bookedSeatIds = useMemo(() => activeBus?.seats ?? [], [activeBus])
  const capacity = Math.max(1, Number(activeBus?.capacity ?? 20))

  const seatLayout = useMemo(() => createSeatLayout(capacity), [capacity])
  const isSprinter = seatLayout.isSprinter
  const economyPrice = Number(tour.priceEconomy ?? tour.price ?? 0)
  const standardPrice = Number(tour.priceStandard ?? tour.price ?? 0)
  const economyFeatures = tour.featuresEconomy?.length ? tour.featuresEconomy : ['Su xidməti', 'Standart oturacaq']
  const standardFeatures = tour.featuresStandard?.length ? tour.featuresStandard : ['Nahar daxil', 'VIP oturacaq', 'Hədiyyəli bilet']
  const unitPrice = selectedPackage === 'economy' ? economyPrice : standardPrice

  useEffect(() => {
    const initialBuses = normalizeTourBuses(tour.buses, Number(tour.seatsAvailable ?? 20), tour.bookedSeats)
    setBuses((prev) => (busesEqual(prev, initialBuses) ? prev : initialBuses))

    if (!selectedBusId || !initialBuses.some((bus) => bus.id === selectedBusId)) {
      setSelectedBusId(initialBuses[0]?.id ?? 'bus_1')
    }
  }, [tour.id, tour.buses, tour.seatsAvailable, tour.bookedSeats, selectedBusId, setSelectedBusId])

  useEffect(() => {
    if (!db || !isFirebaseConfigured) return

    const unsubscribeFirestore = onSnapshot(doc(db, 'tours', tour.id), (snapshot) => {
      if (!snapshot.exists()) return

      const data = snapshot.data() as {
        buses?: unknown
        bookedSeats?: unknown
        seatsAvailable?: unknown
      }

      const remoteBuses = normalizeTourBuses(
        data.buses,
        Number(data.seatsAvailable ?? tour.seatsAvailable ?? 20),
        data.bookedSeats,
      )

      setBuses((prev) => (busesEqual(prev, remoteBuses) ? prev : remoteBuses))

      if (!selectedBusId || !remoteBuses.some((bus) => bus.id === selectedBusId)) {
        setSelectedBusId(remoteBuses[0]?.id ?? 'bus_1')
      }
    })

    return () => unsubscribeFirestore()
  }, [tour.id, tour.seatsAvailable, selectedBusId, setSelectedBusId])

  useEffect(() => {
    if (!activeBus) return

    setSelectedSeats((prev) =>
      {
        const next = sortSeatIdsByLayout(
        prev.filter((seat) => seatLayout.seatIdSet.has(seat) && !bookedSeatIds.includes(seat)),
        seatLayout.seatIds,
      )

        return stringArraysEqual(prev, next) ? prev : next
      },
    )
  }, [activeBus?.id, bookedSeatIds, seatLayout.seatIdSet, seatLayout.seatIds, setSelectedSeats])

  const toggleSeat = (id: string) => {
    if (bookedSeatIds.includes(id)) return

    setSelectedSeats((prev) =>
      prev.includes(id) ? prev.filter((seat) => seat !== id) : [...prev, id],
    )
  }

  const seatState = (id: string): 'free' | 'selected' | 'occupied' => {
    if (bookedSeatIds.includes(id)) return 'occupied'
    if (selectedSeats.includes(id)) return 'selected'
    return 'free'
  }

  return (
    <div className="flex min-h-full flex-col gap-5 px-5 pb-40 pt-6">
      <header className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="flex size-10 items-center justify-center rounded-xl border border-border bg-card transition-transform active:scale-90"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-xl font-extrabold leading-tight">
              {t('seats.title')}
            </h1>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] shadow-sm',
                selectedPackage === 'economy'
                  ? 'bg-brand-purple/15 text-brand-purple ring-1 ring-brand-purple/30'
                  : 'bg-brand-pink/15 text-brand-pink ring-1 ring-brand-pink/30',
              )}
            >
              {selectedPackage === 'economy' ? `Ekonom • ${economyPrice} AZN` : `Standart • ${standardPrice} AZN`}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {tour.title} • {selectedPackage === 'economy' ? 'Ekonom' : 'Standart'}: {unitPrice} AZN / {t('seats.perSeat')}
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setSelectedPackage('economy')}
          className={cn(
            'group rounded-[1.75rem] border p-4 text-left text-sm transition-all duration-200',
            selectedPackage === 'economy'
              ? 'border-sky-400 bg-sky-500/10 text-white shadow-[0_0_0_1px_rgba(56,189,248,0.35),0_20px_40px_-18px_rgba(56,189,248,0.85)] ring-1 ring-sky-400/35'
              : 'border-border bg-secondary text-muted-foreground hover:border-sky-400/40 hover:bg-sky-500/5',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300/90">Ekonom Paket</p>
              <p className="mt-1 text-2xl font-black text-white">{economyPrice} AZN</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
              Minimal
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {economyFeatures.map((feature) => (
              <div key={feature} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                <span className="leading-5 text-inherit">{feature}</span>
              </div>
            ))}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setSelectedPackage('standard')}
          className={cn(
            'group rounded-[1.75rem] border p-4 text-left text-sm transition-all duration-200',
            selectedPackage === 'standard'
              ? 'border-sky-400 bg-sky-500/10 text-white shadow-[0_0_0_1px_rgba(56,189,248,0.35),0_20px_40px_-18px_rgba(56,189,248,0.85)] ring-1 ring-sky-400/35'
              : 'border-border bg-secondary text-muted-foreground hover:border-sky-400/40 hover:bg-sky-500/5',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300/90">Standart Paket</p>
              <p className="mt-1 text-2xl font-black text-white">{standardPrice} AZN</p>
            </div>
            <span className="rounded-full bg-sky-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
              Ən çox seçilən
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {standardFeatures.map((feature) => (
              <div key={feature} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                <span className="leading-5 text-inherit">{feature}</span>
              </div>
            ))}
          </div>
        </button>
      </div>

      {buses.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2">
          {buses.map((bus) => {
            const isActive = bus.id === activeBus?.id
            return (
              <button
                key={bus.id}
                type="button"
                onClick={() => {
                  setSelectedBusId(bus.id)
                  setSelectedSeats(() => [])
                }}
                className={cn(
                  'rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition',
                  isActive
                    ? 'bg-brand-purple text-white shadow-md shadow-brand-purple/30'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80',
                )}
              >
                {bus.name}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-brand-purple" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">{t('seats.groupSize')}</p>
            <p className="text-xs text-muted-foreground">
              {t('seats.groupDesc')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={t('seats.fewer')}
            disabled
            className="flex size-8 items-center justify-center rounded-lg bg-secondary text-foreground opacity-40"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-10 text-center font-heading text-lg font-bold">
            {capacity}
          </span>
          <button
            type="button"
            aria-label={t('seats.more')}
            disabled
            className="flex size-8 items-center justify-center rounded-lg bg-secondary text-foreground opacity-40"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-4 rounded-md border border-border bg-secondary" />
          {t('seats.free')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-4 rounded-md bg-gradient-to-br from-brand-pink to-brand-purple" />
          {t('seats.selected')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-4 rounded-md bg-red-500" />
          {t('seats.taken')}
        </span>
      </div>

      <div className="mx-auto w-full max-w-[280px]">
        <div className="relative rounded-t-[2.5rem] rounded-b-3xl border-2 border-border bg-card p-5 shadow-[0_20px_50px_-20px_rgba(120,50,180,0.35)] transition-all duration-500 ease-out">
          <div className="mb-4 flex items-center justify-between border-b border-dashed border-border pb-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-brand-purple">
              <Disc3 className="size-5" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('seats.busLabel')}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {seatLayout.rows.map(({ rowNumber, left, right }) => (
              <div
                key={rowNumber}
                className={cn(
                  'animate-float-up items-center gap-2',
                  isSprinter
                    ? 'grid grid-cols-[1fr_0.8fr_1fr_1fr]'
                    : 'grid grid-cols-[1fr_1fr_0.7fr_1fr_1fr]'
                )}
              >
                {isSprinter ? (
                  <>
                    {[0, 1].map((index) => {
                      const seat = left[index]
                      if (!seat) return <div key={`left-empty-${rowNumber}-${index}`} className="h-10" />
                      return (
                        <Seat
                          key={`${rowNumber}${seat}`}
                          id={`${rowNumber}${seat}`}
                          state={seatState(`${rowNumber}${seat}`)}
                          onToggle={toggleSeat}
                        />
                      )
                    })}

                    <div className="h-10 rounded-lg border border-dashed border-border bg-card/40" />

                    {right[0] ? (
                      <Seat
                        key={`${rowNumber}${right[0]}`}
                        id={`${rowNumber}${right[0]}`}
                        state={seatState(`${rowNumber}${right[0]}`)}
                        onToggle={toggleSeat}
                      />
                    ) : (
                      <div className="h-10" />
                    )}
                  </>
                ) : (
                  <>
                    {[0, 1].map((index) => {
                      const seat = left[index]
                      if (!seat) return <div key={`left-empty-${rowNumber}-${index}`} className="h-10" />
                      return (
                        <Seat
                          key={`${rowNumber}${seat}`}
                          id={`${rowNumber}${seat}`}
                          state={seatState(`${rowNumber}${seat}`)}
                          onToggle={toggleSeat}
                        />
                      )
                    })}

                    <span className="flex h-10 items-center justify-center text-[10px] font-medium text-muted-foreground">
                      {rowNumber}
                    </span>

                    {[0, 1].map((index) => {
                      const seat = right[index]
                      if (!seat) return <div key={`right-empty-${rowNumber}-${index}`} className="h-10" />
                      return (
                        <Seat
                          key={`${rowNumber}${seat}`}
                          id={`${rowNumber}${seat}`}
                          state={seatState(`${rowNumber}${seat}`)}
                          onToggle={toggleSeat}
                        />
                      )
                    })}
                  </>
                )}
              </div>
            ))}

            {seatLayout.rearSeatIds.length > 0 && (
              <div className="mt-4 rounded-3xl border border-border bg-card p-4">
                <div className="mb-3 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {t('seats.rearSeats')}
                </div>
                <div className={isSprinter ? 'grid grid-cols-4 gap-2' : 'grid grid-cols-6 gap-2'}>
                  {seatLayout.rearSeatIds.map((id) => (
                    <Seat key={id} id={id} state={seatState(id)} onToggle={toggleSeat} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {isSprinter
            ? t('seats.layoutSprinter')
            : t('seats.layoutBus')}
        </p>
      </div>
    </div>
  )
}
