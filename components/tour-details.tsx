'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import {
  ArrowLeft,
  Check,
  MapPin,
  Clock,
  Star,
  ChevronRight,
  CalendarDays,
  Bus,
  UserRound,
  EggFried,
  PartyPopper,
  Coffee,
  Gift,
  Ticket,
  Waves,
  Mountain,
  Church,
  Landmark,
  Crown,
  Store,
  Rocket,
  Flag,
  AlertTriangle,
  Ban,
  Car,
  UtensilsCrossed,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { Tour } from '@/components/tour-card'
import { cn } from '@/lib/utils'

export function TourDetails({
  tour,
  selectedPackage,
  setSelectedPackage,
  onBack,
  onReserve,
}: {
  tour: Tour
  selectedPackage: 'economy' | 'standard'
  setSelectedPackage: (pkg: 'economy' | 'standard') => void
  onBack: () => void
  onReserve: () => void
}) {
  const { t } = useI18n()
  const title = tour.titleKey ? t(tour.titleKey) : tour.title ?? ''
  const location = tour.locationKey ? t(tour.locationKey) : tour.location ?? ''
  const duration = tour.durationKey ? t(tour.durationKey) : tour.duration ?? ''
  const formattedDate = tour.dateLabel?.trim() || (tour.date ? new Date(tour.date).toLocaleDateString('az-AZ') : '')
  const economyPrice = Number(tour.priceEconomy ?? tour.price ?? 0)
  const standardPrice = Number(tour.priceStandard ?? tour.price ?? 0)
  const shouldBypassImageOptimizer = /^https?:\/\/i\.ibb\.co\//i.test(tour.image ?? '')
  const economyFeatures = tour.featuresEconomy?.length ? tour.featuresEconomy : ['Su xidməti', 'Standart oturacaq']
  const standardFeatures = tour.featuresStandard?.length ? tour.featuresStandard : ['Nahar daxil', 'VIP oturacaq', 'Hədiyyəli bilet']
  const normalizedIdentity = `${title} ${location}`.toLowerCase()
  const isShekiQaxTour = useMemo(() => {
    const hasSheki = normalizedIdentity.includes('şəki') || normalizedIdentity.includes('seki')
    const hasQax = normalizedIdentity.includes('qax')
    return hasSheki && hasQax
  }, [normalizedIdentity])

  const shekiQaxInclusions: Array<{ icon: LucideIcon; text: string }> = [
    { icon: Bus, text: 'Komfortlu və geniş VIP nəqliyyat xidməti' },
    { icon: UserRound, text: 'Yolboyu və ekskursiya zamanı peşəkar bələdçi müşayiəti' },
    { icon: EggFried, text: 'Dadlı səhər yeməyi (Yalnız Standart Paket üçün)' },
    { icon: PartyPopper, text: 'Peşəkar Kloun Xidməti (Yolboyu və fasilələrdə şoular, maraqlı zarafat və oyunlar)' },
    { icon: Coffee, text: 'Geri dönüşdə xoş ab-havada çay süfrəsi' },
    { icon: Gift, text: 'Yolboyu əyləncəli oyunlar və xüsusi hədiyyələr' },
    { icon: Ticket, text: 'Özəl Hədiyyə: Turun ən aktiv iştirakçısına növbəti tura 25% endirim kuponu!' },
  ]

  const shekiQaxPlaces: Array<{ icon: LucideIcon; text: string }> = [
    { icon: Waves, text: 'Möcüzəvi Mamırlı Şəlaləsi (+7 AZN Off-road dağ maşını ilə)' },
    { icon: Mountain, text: 'Ecazkar Ram-Rama Şəlaləsi (+7 AZN Off-road dağ maşını ilə)' },
    { icon: Church, text: 'Tarixi Kürmük Kilsəsi (Panoramik mənzərə)' },
    { icon: Landmark, text: 'Qədim Ulu Körpü və Səngər Qala' },
    { icon: Crown, text: 'Möhtəşəm Şəki Xan Sarayı və Karvansaray' },
    { icon: Store, text: 'Məşhur Şəki şirniyyatları mağazasına ziyarət' },
  ]

  const shekiQaxNotes: Array<{ icon: LucideIcon; text: string }> = [
    { icon: Users, text: '10+1 KAMPANİYASI: 10 nəfərlik qrupla gələnlərə +1 nəfər ÖDƏNİŞSİZ!' },
    { icon: UtensilsCrossed, text: 'Muzey və qoruqlara giriş biletləri, həmçinin günorta naharı qiymətə daxil deyil.' },
    { icon: Car, text: 'Şəlalələrə qalxmaq üçün tələb olunan dağ maşınlarının ödənişi (+7 AZN) qiymətə daxil deyil.' },
    { icon: UserRound, text: '0-5 yaş arası uşaqlar üçün tur ödənişsizdir (nəqliyyatda yer tutmamaq şərti ilə).' },
    { icon: Ban, text: 'Tur zamanı spirtli içkilərin qəbulu qəti qadağandır!' },
  ]

  const hasConfiguredProgram = useMemo(() => {
    const program = tour.program
    return Boolean(
      program?.includedItems?.length ||
      program?.placesItems?.length ||
      program?.scheduleGathering ||
      program?.scheduleDeparture ||
      program?.scheduleReturn ||
      program?.notesItems?.length,
    )
  }, [tour.program])

  const activeProgram = useMemo(() => {
    if (hasConfiguredProgram) {
      return {
        includedItems: tour.program?.includedItems ?? [],
        placesItems: tour.program?.placesItems ?? [],
        scheduleGathering: tour.program?.scheduleGathering ?? '',
        scheduleDeparture: tour.program?.scheduleDeparture ?? '',
        scheduleReturn: tour.program?.scheduleReturn ?? '',
        notesItems: tour.program?.notesItems ?? [],
      }
    }

    if (isShekiQaxTour) {
      return {
        includedItems: shekiQaxInclusions.map((item) => item.text),
        placesItems: shekiQaxPlaces.map((item) => item.text),
        scheduleGathering: '01:00 - 01:30 | Gənclik m/s qarşısı',
        scheduleDeparture: '01:30',
        scheduleReturn: '23:00 - 23:30 arası (təqribi)',
        notesItems: shekiQaxNotes.map((item) => item.text),
      }
    }

    return null
  }, [hasConfiguredProgram, isShekiQaxTour, shekiQaxInclusions, shekiQaxNotes, shekiQaxPlaces, tour.program])

  const inclusionIcons: LucideIcon[] = [Bus, UserRound, EggFried, PartyPopper, Coffee, Gift, Ticket]
  const placeIcons: LucideIcon[] = [Waves, Mountain, Church, Landmark, Crown, Store]
  const noteIcons: LucideIcon[] = [Users, UtensilsCrossed, Car, UserRound, Ban]

  return (
    <div className="flex min-h-full flex-col gap-5 px-5 pb-32 pt-6">
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
          <p className="text-sm text-muted-foreground">{t('tour.details')}</p>
          <h1 className="font-heading text-xl font-extrabold leading-tight">
            {title}
          </h1>
        </div>
      </header>

      <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_20px_50px_-20px_rgba(120,50,180,0.25)]">
        <div className="relative h-64 w-full">
          <Image
            src={tour.image}
            alt={title || 'Tour image'}
            fill
            unoptimized={shouldBypassImageOptimizer}
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2 rounded-2xl bg-secondary px-3 py-2">
              <MapPin className="size-4" />
              {location || t(tour.locationKey ?? '')}
            </span>
            <span className="flex items-center gap-2 rounded-2xl bg-secondary px-3 py-2">
              <Clock className="size-4" />
              {duration || t(tour.durationKey ?? '')}
            </span>
            {formattedDate ? (
              <span className="flex items-center gap-2 rounded-2xl bg-secondary px-3 py-2">
                <CalendarDays className="size-4" />
                {formattedDate}
              </span>
            ) : null}
            <span className="flex items-center gap-2 rounded-2xl bg-secondary px-3 py-2">
              <Star className="size-4 text-brand-yellow" />
              {tour.rating.toFixed(1)} ({tour.reviews})
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelectedPackage('economy')}
              className={cn(
                'rounded-[1.75rem] border p-4 text-left transition-all duration-200',
                selectedPackage === 'economy'
                  ? 'border-sky-400 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.35),0_20px_50px_-25px_rgba(56,189,248,0.9)] ring-1 ring-sky-400/35'
                  : 'border-white/10 bg-background hover:border-sky-400/40 hover:bg-sky-500/5',
              )}
            >
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">Ekonom Paket</p>
                {selectedPackage === 'economy' ? (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-500 sm:text-[11px] sm:tracking-[0.16em]">Seçilmiş</span>
                  </div>
                ) : null}
              </div>
              <p className="mt-2 text-2xl font-black text-foreground">{economyPrice} AZN</p>
              <div className="mt-4 space-y-2">
                {economyFeatures.map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPackage('standard')}
              className={cn(
                'rounded-[1.75rem] border p-4 text-left transition-all duration-200',
                selectedPackage === 'standard'
                  ? 'border-sky-400 bg-gradient-to-b from-sky-500/10 to-background shadow-[0_0_0_1px_rgba(56,189,248,0.35),0_20px_50px_-25px_rgba(56,189,248,0.9)] ring-1 ring-sky-400/35'
                  : 'border-sky-400/35 bg-gradient-to-b from-sky-500/10 to-background hover:border-sky-400/60',
              )}
            >
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Standart Paket</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-500 sm:text-[11px] sm:tracking-[0.16em]">Ən çox seçilən</span>
                  {selectedPackage === 'standard' ? (
                    <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-500 sm:text-[11px] sm:tracking-[0.16em]">Seçilmiş</span>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-2xl font-black text-foreground">{standardPrice} AZN</p>
              <div className="mt-4 space-y-2">
                {standardFeatures.map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </button>
          </div>

          {activeProgram ? (
            <section className="space-y-4 rounded-[1.75rem] border border-white/10 bg-[#10081b] p-4 shadow-[0_25px_60px_-35px_rgba(120,50,180,0.55)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a995ea]">Tur Proqramı və Şərtlər</p>
                <h3 className="mt-2 text-xl font-extrabold text-white">{title} üçün tam plan</h3>
              </div>

              <article className="rounded-2xl border border-white/10 bg-[#150b26] p-4">
                <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-sky-300">Qiymətə Daxildir</h4>
                <div className="mt-3 space-y-2">
                  {activeProgram.includedItems.map((item, index) => {
                    const Icon = inclusionIcons[index % inclusionIcons.length]
                    return (
                      <div key={item} className="flex items-start gap-2 rounded-xl bg-white/5 p-2.5 text-sm leading-relaxed text-[#ddd6f4]">
                        <Icon className="mt-0.5 size-4 shrink-0 text-sky-300" />
                        <span>{item}</span>
                      </div>
                    )
                  })}
                </div>
              </article>

              <article className="rounded-2xl border border-white/10 bg-[#150b26] p-4">
                <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-300">Gəziləcək Məkanlar</h4>
                <div className="mt-3 space-y-2">
                  {activeProgram.placesItems.map((item, index) => {
                    const Icon = placeIcons[index % placeIcons.length]
                    return (
                      <div key={item} className="flex items-start gap-2 rounded-xl bg-white/5 p-2.5 text-sm leading-relaxed text-[#ddd6f4]">
                        <Icon className="mt-0.5 size-4 shrink-0 text-cyan-300" />
                        <span>{item}</span>
                      </div>
                    )
                  })}
                </div>
              </article>

              <article className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/15 to-[#140a21] p-4">
                <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-violet-300">Zaman və Toplanış Planı</h4>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/5 p-3 text-sm text-[#ddd6f4]">
                    <p className="flex items-center gap-2 font-semibold text-white"><MapPin className="size-4 text-violet-300" /> Toplanış</p>
                    <p className="mt-1">{activeProgram.scheduleGathering || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3 text-sm text-[#ddd6f4]">
                    <p className="flex items-center gap-2 font-semibold text-white"><Rocket className="size-4 text-violet-300" /> Yola düşmə</p>
                    <p className="mt-1">{activeProgram.scheduleDeparture || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3 text-sm text-[#ddd6f4]">
                    <p className="flex items-center gap-2 font-semibold text-white"><Flag className="size-4 text-violet-300" /> Bakıya dönüş</p>
                    <p className="mt-1">{activeProgram.scheduleReturn || '—'}</p>
                  </div>
                </div>
              </article>

              <article className="rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-400/10 to-[#181021] p-4">
                <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-amber-300">Vacib Qeydlər və Kampaniyalar</h4>
                <div className="mt-3 space-y-2">
                  {activeProgram.notesItems.map((item, index) => {
                    const Icon = noteIcons[index % noteIcons.length]
                    return (
                      <div key={item} className="flex items-start gap-2 rounded-xl bg-black/15 p-2.5 text-sm text-[#f3ecd1]">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
                        <Icon className="mt-0.5 size-4 shrink-0 text-amber-200" />
                        <span>{item}</span>
                      </div>
                    )
                  })}
                </div>
              </article>
            </section>
          ) : null}

          <div className="rounded-3xl border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{t('tour.priceLabel')}</p>
                <div className="mt-1 flex flex-col gap-1 text-sm font-semibold text-foreground">
                  <p>Ekonom: {economyPrice} AZN</p>
                  <p>Standart: {standardPrice} AZN</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onReserve}
                className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
              >
                {t('tour.reserve')}
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
