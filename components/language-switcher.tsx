'use client'

import { useEffect, useRef, useState } from 'react'
import { Globe, Check } from 'lucide-react'
import { LANGS, useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onClick)
    return () => document.removeEventListener('pointerdown', onClick)
  }, [open])

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0]

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change language"
        aria-expanded={open}
        className="flex h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 text-foreground transition-transform active:scale-90"
      >
        <Globe className="size-4 text-brand-purple" />
        <span className="text-xs font-bold">{current.flag}</span>
      </button>

      {open && (
        <div className="animate-float-up absolute right-0 top-12 z-50 w-40 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-[0_12px_40px_-12px_rgba(120,50,180,0.3)]">
          {LANGS.map((l) => {
            const active = l.code === lang
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLang(l.code)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-foreground hover:bg-secondary/60',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="text-xs font-bold text-brand-purple">
                    {l.flag}
                  </span>
                  {l.label}
                </span>
                {active && <Check className="size-4 text-brand-pink" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
