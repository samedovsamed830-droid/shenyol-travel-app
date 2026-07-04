import Image from 'next/image'
import { cn } from '@/lib/utils'

export function ShowBusTrack({
  className,
  label,
}: {
  className?: string
  label?: string
}) {
  return (
    <div className={cn('w-full', className)}>
      <div className="relative h-24 w-full overflow-hidden">
        {/* the driving bus */}
        <div className="animate-bus-drive absolute bottom-2 left-0 h-24 w-48 z-20">
          <div className="absolute -left-12 bottom-8 flex items-end gap-2 z-10">
            <span
              className="h-2 w-2 rounded-full bg-white/30 blur-[1px] animate-smoke-trail"
              style={{ animationDelay: '0s' }}
            />
            <span
              className="h-2.5 w-2.5 rounded-full bg-white/20 blur-[1px] animate-smoke-trail"
              style={{ animationDelay: '0.2s' }}
            />
            <span
              className="h-3 w-3 rounded-full bg-white/10 blur-[1px] animate-smoke-trail"
              style={{ animationDelay: '0.4s' }}
            />
          </div>
          <Image
            src="/images/abtobus.png"
            alt=""
            aria-hidden
            fill
            sizes="200px"
            className="object-contain"
          />
        </div>
        {/* road */}
        <div className="absolute inset-x-0 bottom-0 h-3 rounded-full bg-secondary" />
        <div
          className="animate-road absolute inset-x-0 bottom-[5px] h-[3px]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to right, var(--brand-yellow) 0 16px, transparent 16px 32px)',
          }}
        />
      </div>
      {label ? (
        <p className="text-center text-sm font-medium text-muted-foreground">
          {label}
        </p>
      ) : null}
    </div>
  )
}
