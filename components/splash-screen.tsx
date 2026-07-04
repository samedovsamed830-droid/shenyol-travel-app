'use client'

import { useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

export function SplashScreen({ onEnter }: { onEnter: () => void }) {
  const { t } = useI18n()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const dragStartXRef = useRef(0)
  const dragOffsetStartRef = useRef(0)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  const getMaxDrag = () => {
    const track = trackRef.current
    if (!track) return 0

    const thumbWidth = 56
    const horizontalPadding = 8
    return Math.max(0, track.clientWidth - thumbWidth - horizontalPadding)
  }

  const handleEnter = () => {
    if (isCompleted) return
    setIsCompleted(true)
    onEnter()
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (isCompleted) return

    const target = event.currentTarget
    pointerIdRef.current = event.pointerId
    target.setPointerCapture(event.pointerId)

    dragStartXRef.current = event.clientX
    dragOffsetStartRef.current = dragX
    setIsDragging(true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging || pointerIdRef.current !== event.pointerId || isCompleted) return

    const delta = event.clientX - dragStartXRef.current
    const maxDrag = getMaxDrag()
    const next = Math.min(maxDrag, Math.max(0, dragOffsetStartRef.current + delta))
    setDragX(next)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== event.pointerId) return

    const target = event.currentTarget
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId)
    }

    pointerIdRef.current = null
    setIsDragging(false)

    if (isCompleted) return

    const maxDrag = getMaxDrag()
    const shouldComplete = maxDrag > 0 && dragX >= maxDrag * 0.82

    if (shouldComplete) {
      setDragX(maxDrag)
      setIsCompleted(true)
      window.setTimeout(() => {
        onEnter()
      }, 120)
      return
    }

    setDragX(0)
  }

  const maxDrag = getMaxDrag()
  const dragProgress = maxDrag > 0 ? dragX / maxDrag : 0

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <div className="flex flex-1 items-center justify-center">
        <video
          src="/images/giris.mp4"
          autoPlay
          muted
          playsInline
          className="h-dvh w-full object-cover md:object-contain"
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto w-full max-w-md">
          <button
            type="button"
            onClick={handleEnter}
            className="mb-3 hidden w-full rounded-2xl border border-white/20 bg-black/45 px-4 py-3 text-sm font-semibold text-white/90 backdrop-blur md:block"
          >
            {t('splash.enter')}
          </button>

          <div
            ref={trackRef}
            className="relative h-16 w-full overflow-hidden rounded-2xl border border-white/25 bg-gradient-to-r from-fuchsia-500/95 via-violet-500/95 to-indigo-500/95 p-1 shadow-[0_18px_50px_-18px_rgba(168,85,247,0.95)]"
          >
            <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.28),transparent_45%),radial-gradient(circle_at_85%_75%,rgba(255,255,255,0.2),transparent_45%)]" />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-16">
              <p
                className="truncate text-sm font-extrabold tracking-[0.02em] text-white transition-opacity duration-200"
                style={{ opacity: Math.max(0.2, 1 - dragProgress * 1.2) }}
              >
                Surusdur ve basla
              </p>
            </div>

            <button
              type="button"
              aria-label={t('splash.enter')}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="absolute left-1 top-1 z-10 flex h-14 w-14 touch-none items-center justify-center rounded-xl bg-black/35 text-white ring-1 ring-white/35 backdrop-blur transition-shadow"
              style={{ transform: `translateX(${dragX}px)` }}
            >
              <ArrowRight className="size-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
