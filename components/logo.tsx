import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center', className)}>
      <span className="font-heading text-xl font-extrabold tracking-tight">
        ShenyolTravel
      </span>
    </div>
  )
}
