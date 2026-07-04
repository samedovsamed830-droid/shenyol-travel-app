'use client'

import { ShieldCheck, Armchair } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FloatingActionBar({
  seatCount,
  total,
  packageLabel,
  onProceed,
}: {
  seatCount: number
  total: number
  packageLabel?: string
  onProceed: () => void
}) {
  const disabled = seatCount === 0

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="glass pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-3xl border border-border/60 p-3 shadow-[0_-8px_40px_-12px_rgba(120,50,180,0.3)]">
        <div className="flex items-center gap-2.5 pl-2">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-secondary text-brand-purple">
            <Armchair className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="text-xs text-muted-foreground">
              {seatCount === 0
                ? 'No seats yet'
                : `${seatCount} seat${seatCount > 1 ? 's' : ''}`}
            </p>
            {packageLabel ? (
              <p className="text-[11px] text-muted-foreground">Paket: {packageLabel}</p>
            ) : null}
            <p className="font-heading text-lg font-extrabold">{total} AZN</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onProceed}
          disabled={disabled}
          className={cn(
            'touch-manipulation flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold transition-all active:scale-95',
            disabled
              ? 'cursor-not-allowed bg-secondary text-muted-foreground'
              : 'bg-primary text-primary-foreground shadow-lg shadow-primary/30',
          )}
        >
          <ShieldCheck className="size-4" />
          Secure Payment
        </button>
      </div>
    </div>
  )
}
