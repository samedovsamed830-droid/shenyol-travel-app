import Image from 'next/image'
import { cn } from '@/lib/utils'

export function ClownMascot({
  className,
  size = 200,
  bounce = true,
  priority = false,
}: {
  className?: string
  size?: number
  bounce?: boolean
  priority?: boolean
}) {
  return (
    <div
      className={cn('pointer-events-none relative select-none', bounce && 'animate-mascot-bounce', className)}
      style={{ width: size, height: size }}
    >
      {/* soft glow behind mascot */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-full bg-brand-pink/20 blur-2xl"
      />
      <Image
        src="/clown.png"
        alt="Shenyol Travel clown animator mascot"
        fill
        priority={priority}
        sizes={`${size}px`}
        className="object-contain drop-shadow-[0_18px_30px_rgba(160,60,200,0.25)]"
      />
    </div>
  )
}

