'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  MapPin,
  Clock,
  CalendarDays,
  Star,
  ChevronRight,
  Heart,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import type { TourBus } from '@/lib/seat-layout'

export type Tour = {
  id: string
  titleKey?: string
  title?: string
  locationKey?: string
  location?: string
  durationKey?: string
  duration?: string
  meetingPoint?: string
  date?: string
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
  description?: string
  priceEconomy: number
  priceStandard: number
  price?: number
  featuresEconomy?: string[]
  featuresStandard?: string[]
  rating: number
  reviews: number
  image: string
  seatsAvailable?: number
  bookedSeats?: string[]
  buses?: TourBus[]
}

export function TourCard({
  tour,
  onSelect,
  isFavorite = false,
  onToggleFavorite,
  onRequireLogin,
}: {
  tour: Tour
  onSelect: (tour: Tour) => void
  isFavorite?: boolean
  onToggleFavorite?: (tour: Tour) => void
  onRequireLogin?: () => void
}): import("react").JSX.Element {
  const [isPressed, setIsPressed] = useState(false)
  const { t } = useI18n()

  const title = tour.titleKey ? t(tour.titleKey) : tour.title ?? ''
  const location = tour.location?.trim() || (tour.locationKey ? t(tour.locationKey) : '')
  const duration = tour.duration?.trim() || (tour.durationKey ? t(tour.durationKey) : '')
  const meetingPoint = tour.meetingPoint?.trim() ?? ''
  const formattedDate = tour.dateLabel?.trim() || (tour.date ? new Date(tour.date).toLocaleDateString('az-AZ') : '')
  const economyPrice = Number(tour.priceEconomy ?? tour.price ?? 0)
  const shouldBypassImageOptimizer = /^https?:\/\/i\.ibb\.co\//i.test(tour.image ?? '')

  const handleFavoriteClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (onToggleFavorite) {
      onToggleFavorite(tour)
      return
    }

    onRequireLogin?.()
  }

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(tour)
    }
  }

  return (
    <article
      className={cn(
        'overflow-hidden rounded-3xl border border-border bg-card shadow-[0_12px_40px_-12px_rgba(120,50,180,0.22)] transition-all duration-300',
        isPressed ? 'scale-[0.995]' : 'scale-100',
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(tour)}
        onKeyDown={handleCardKeyDown}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        onTouchStart={() => setIsPressed(true)}
        onTouchEnd={() => setIsPressed(false)}
        className="block w-full cursor-pointer text-left"
      >
        <div className="relative h-44 w-full overflow-hidden">
          <Image
            src={tour.image || '/placeholder.svg'}
            alt={title || 'Tour image'}
            fill
            unoptimized={shouldBypassImageOptimizer}
            sizes="(max-width: 480px) 100vw, 480px"
            className={cn(
              'object-cover transition-transform duration-500',
              isPressed ? 'scale-105' : 'scale-100',
            )}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-1 text-xs font-semibold text-foreground backdrop-blur">
            <Star className="size-3.5 fill-brand-yellow text-brand-yellow" />
            {tour.rating.toFixed(1)}
            <span className="text-muted-foreground">({tour.reviews})</span>
          </div>
          <button
            type="button"
            onClick={handleFavoriteClick}
            aria-label={isFavorite ? 'Favoritlerden sil' : 'Favoritlere elave et'}
            className={cn(
              'absolute right-3 top-3 z-10 inline-flex size-9 items-center justify-center rounded-full border backdrop-blur transition-transform active:scale-90',
              isFavorite
                ? 'border-red-300/80 bg-red-500/85 text-white shadow-[0_10px_24px_-12px_rgba(239,68,68,0.9)]'
                : 'border-white/30 bg-black/35 text-white hover:bg-black/50',
            )}
          >
            <Heart className={cn('size-4', isFavorite ? 'fill-current' : '')} />
          </button>
          <div className="pointer-events-none absolute bottom-3 right-3 text-[11px] font-semibold text-primary-foreground">
            <span className="rounded-full bg-brand-purple px-3 py-1 shadow-lg">{economyPrice} AZN</span>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 text-primary-foreground">
            <h3 className="font-heading text-xl font-extrabold drop-shadow">
              {title}
            </h3>
            <p className="flex flex-wrap items-center gap-1 text-xs font-medium opacity-90">
              <MapPin className="size-3.5" />
              {location}
              <span className="mx-1 opacity-60">•</span>
              <Clock className="size-3.5" />
              {duration}
              {formattedDate ? (
                <>
                  <span className="mx-1 opacity-60">•</span>
                  <CalendarDays className="size-3.5" />
                  {formattedDate}
                </>
              ) : null}
            </p>
            {meetingPoint ? (
              <p className="mt-1 text-xs font-medium opacity-90">
                Toplanış: {meetingPoint}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-xs text-muted-foreground">{t('tour.reserveHint')}</p>
        <button
          type="button"
          onClick={() => onSelect(tour)}
          className="flex items-center gap-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-transform active:scale-95"
        >
          {t('tour.reserve')}
          <ChevronRight className="size-4" />
        </button>
      </div>
    </article>
  )
}
