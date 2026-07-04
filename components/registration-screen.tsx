'use client'

import { useState } from 'react'
import { ArrowLeft, Smartphone } from 'lucide-react'
import type { Tour } from '@/components/tour-card'
import { useI18n } from '@/lib/i18n'

type UserProfile = {
  firstName: string
  lastName: string
  phone: string
}

export function RegistrationScreen({
  tour,
  onBack,
  onRegister,
}: {
  tour: Tour
  onBack: () => void
  onRegister: (user: UserProfile) => void
}) {
  const { t } = useI18n()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')

  const isValid =
    firstName.trim().length > 1 &&
    lastName.trim().length > 1 &&
    /^\+?\d{7,15}$/.test(phone)

  return (
    <div className="flex min-h-full flex-col gap-5 px-5 pb-40 pt-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('common.back')}
          className="flex size-10 items-center justify-center rounded-xl border border-border bg-card transition-transform active:scale-90"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <p className="text-sm text-muted-foreground">{t('tour.reserve')}</p>
          <h1 className="font-heading text-xl font-extrabold leading-tight">
            {t('tour.registerTitle')}
          </h1>
        </div>
      </header>

      <div className="overflow-hidden rounded-[2rem] border border-border bg-card p-5 shadow-[0_20px_50px_-20px_rgba(120,50,180,0.25)]">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{t('tour.selectedTour')}</p>
            <p className="text-sm text-muted-foreground">{tour.title ?? (tour.titleKey ? t(tour.titleKey) : '')}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-foreground">{t('tour.firstName')}</span>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder={t('tour.firstNamePlaceholder')}
                className="w-full rounded-3xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-foreground">{t('tour.lastName')}</span>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder={t('tour.lastNamePlaceholder')}
                className="w-full rounded-3xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-foreground">{t('tour.phone')}</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+994501234567"
              className="w-full rounded-3xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>

          <p className="text-xs text-muted-foreground">
            {t('tour.phoneHint')}
          </p>

          <button
            type="button"
            onClick={() => onRegister({ firstName, lastName, phone })}
            disabled={!isValid}
            className={`w-full rounded-3xl px-5 py-4 text-sm font-semibold transition ${
              isValid
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                : 'cursor-not-allowed bg-secondary text-muted-foreground'
            }`}
          >
            {t('tour.continueToSeats')}
          </button>
        </div>
      </div>
    </div>
  )
}
