'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export type Lang = 'az' | 'ru' | 'en'

export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'az', label: 'Azərbaycan', flag: 'AZ' },
  { code: 'ru', label: 'Русский', flag: 'RU' },
  { code: 'en', label: 'English', flag: 'EN' },
]

type Dict = Record<string, string>

const translations: Record<Lang, Dict> = {
  az: {
    // splash
    'splash.badge': 'İnteraktiv Şou-Avtobus Turları',
    'splash.title.a': 'Səyahət',
    'splash.title.b': 'əsl şoudur!',
    'splash.subtitle':
      'Təkərlər üstündə canlı əyləncə. Şenyol Travel ilə əylənin, gülün və Azərbaycanı kəşf edin.',
    'splash.loading': 'Şou-avtobus qızdırılır…',
    'splash.enter': 'Şouya başla',
    // home
    'home.search': 'Turları axtar',
    'home.searchPlaceholder': 'Turları axtar...',
    'home.notifications': 'Bildirişlər',
    'home.hero.ready': 'Yola çıxmağa hazırsan?',
    'home.hero.title.a': 'Hər oturacaq',
    'home.hero.title.b': 'ön cərgə şousudur.',
    'home.categories.title': 'Tur kateqoriyaları',
    'home.cat.all': 'Bütün şoular',
    'home.cat.mountains': 'Dağlar',
    'home.cat.sea': 'Dəniz',
    'home.cat.city': 'Şəhər işıqları',
    'home.cat.nightlife': 'Gecə həyatı',
    'home.featured': 'Seçilmiş şoular',
    'home.seeAll': 'Hamısına bax',
    'home.noResults': 'Axtarışınıza uyğun tur tapılmadı.',
    // tour card
    'tour.perk.breakfast': 'Səhər yeməyi',
    'tour.perk.bus': 'Şou-Avtobus',
    'tour.perk.show': 'Canlı Şou',
    'tour.details': 'Tur haqqında',
    'tour.reserveHint': 'Rezervasiya üçün aşağıya basın',
    'tour.reserve': 'Rezerv et',
    'tour.registerTitle': 'Rezervasiya üçün qeydiyyat',
    'tour.selectedTour': 'Seçilmiş tur',
    'tour.firstName': 'Ad',
    'tour.lastName': 'Soyad',
    'tour.phone': 'Əlaqə nömrəsi',
    'tour.phoneHint': 'Zəhmət olmasa mobil nömrənizi +994 daxil olmaqla daxil edin.',
    'tour.firstNamePlaceholder': 'Adınız',
    'tour.lastNamePlaceholder': 'Soyadınız',
    'tour.continueToSeats': 'Oturacaqlara davam et',
    'tour.included': 'Hər şey daxildir, sürprizsiz.',
    'tour.tapForPerks': 'İmkanlar üçün karta toxun',
    'tour.book': 'İndi al',
    'tour.location.gabala': 'Qəbələ, Azərbaycan',
    'tour.title.gabala': 'Qəbələ Turu',
    'tour.duration.1day': '1 gün',
    // seats
    'seats.title': 'Oturacaqlarını seç',
    'seats.perSeat': 'oturacaq',
    'seats.groupSize': 'Qrup ölçüsü',
    'seats.groupDesc': 'Avtobus komandana uyğunlaşır',
    'seats.fewer': 'Daha az cərgə',
    'seats.more': 'Daha çox cərgə',
    'seats.free': 'Boş',
    'seats.selected': 'Seçilmiş',
    'seats.taken': 'Tutulub',
    'seats.busLabel': 'Şou-Avtobus',
    'seats.layout': '4-lük düzülüş • Arxa çıxış',
    'seats.layoutSprinter': 'Sprinter düzülüşü: sol 1 + sağ 2 oturacaq',
    'seats.layoutBus': 'Avtobus düzülüşü: sol 2 + sağ 2 + arxa 6 oturacaq',
    'seats.occupied': 'tutulub',
    'seats.seat': 'Oturacaq',
    'seats.rearSeats': 'Arxa oturacaqlar',
    // action bar
    'bar.noSeats': 'Hələ oturacaq yoxdur',
    'bar.seat': 'oturacaq',
    'bar.seats': 'oturacaq',
    'bar.pay': 'Təhlükəsiz Ödəniş',
    // payment
    'pay.title': 'Təhlükəsiz ödəniş',
    'pay.cardNumber': 'Kart nömrəsi',
    'pay.expiry': 'Bitmə tarixi',
    'pay.cvc': 'CVC',
    'pay.times': '×',
    'pay.total': 'Cəmi',
    'pay.encrypted': '256-bit şifrələnmiş • Shenyol Pay ilə',
    'pay.payNow': 'Ödə',
    'pay.securing': 'Oturacaqların qeydə alınır…',
    'pay.processing': 'Ödəniş şifrələnir • Zəhmət olmasa gözləyin',
    'pay.confirmed': 'Rezervasiya təsdiqləndi',
    'pay.doneTitle': 'Şou-avtobusdasan!',
    'pay.doneDesc':
      '{seats} oturacaqları {tour} üçün ayrıldı. Biletlər üçün e-poçtunu yoxla.',
    'pay.backToTours': 'Turlara qayıt',
    'common.back': 'Geri',
  },
  ru: {
    'splash.badge': 'Интерактивные Шоу-Автобус Туры',
    'splash.title.a': 'Путешествие —',
    'splash.title.b': 'это шоу!',
    'splash.subtitle':
      'Живые развлечения на колёсах. Пойте, смейтесь и открывайте Азербайджан с Shenyol Travel.',
    'splash.loading': 'Разогреваем шоу-автобус…',
    'splash.enter': 'Начать шоу',
    'home.search': 'Поиск туров',
    'home.notifications': 'Уведомления',
    'home.hero.ready': 'Готовы отправиться?',
    'home.hero.title.a': 'Каждое место —',
    'home.hero.title.b': 'шоу в первом ряду.',
    'home.categories.title': 'Категории туров',
    'home.cat.all': 'Все шоу',
    'home.cat.mountains': 'Горы',
    'home.cat.sea': 'Море',
    'home.cat.city': 'Огни города',
    'home.cat.nightlife': 'Ночная жизнь',
    'home.featured': 'Избранные шоу',
    'home.seeAll': 'Смотреть все',
    'tour.perk.breakfast': 'Завтрак',
    'tour.perk.bus': 'Шоу-Автобус',
    'tour.perk.show': 'Живое шоу',
    'tour.details': 'О туре',
    'tour.reserveHint': 'Нажмите ниже, чтобы забронировать',
    'tour.reserve': 'Забронировать',
    'tour.included': 'Всё включено, без сюрпризов.',
    'tour.tapForPerks': 'Нажмите на карту для деталей',
    'tour.book': 'Забронировать',
    'tour.location.gabala': 'Габала, Азербайджан',
    'tour.title.gabala': 'Тур в Габалу',
    'tour.duration.1day': '1 день',
    'seats.title': 'Выберите места',
    'seats.perSeat': 'место',
    'seats.groupSize': 'Размер группы',
    'seats.groupDesc': 'Автобус подстраивается под вашу компанию',
    'seats.fewer': 'Меньше рядов',
    'seats.more': 'Больше рядов',
    'seats.free': 'Свободно',
    'seats.selected': 'Выбрано',
    'seats.taken': 'Занято',
    'seats.busLabel': 'Шоу-Автобус',
    'seats.layout': 'Расположение 4 в ряд • Задний выход',
    'seats.layoutSprinter': 'Спринтер: слева 1 + справа 2 места',
    'seats.layoutBus': 'Автобус: слева 2 + справа 2 + задние 6 мест',
    'seats.occupied': 'занято',
    'seats.seat': 'Место',
    'seats.rearSeats': 'Задние места',
    'bar.noSeats': 'Мест пока нет',
    'bar.seat': 'место',
    'bar.seats': 'места',
    'bar.pay': 'Безопасная оплата',
    'pay.title': 'Безопасная оплата',
    'pay.cardNumber': 'Номер карты',
    'pay.expiry': 'Срок',
    'pay.cvc': 'CVC',
    'pay.times': '×',
    'pay.total': 'Итого',
    'pay.encrypted': '256-битное шифрование • Shenyol Pay',
    'pay.payNow': 'Оплатить',
    'pay.securing': 'Резервируем ваши места…',
    'pay.processing': 'Шифрование платежа • Пожалуйста, подождите',
    'pay.confirmed': 'Бронирование подтверждено',
    'pay.doneTitle': 'Вы в шоу-автобусе!',
    'pay.doneDesc':
      'Места {seats} зарезервированы для «{tour}». Проверьте почту для билетов.',
    'pay.backToTours': 'Назад к турам',
    'common.back': 'Назад',
  },
  en: {
    'splash.badge': 'Interactive Show-Bus Tours',
    'splash.title.a': 'The Journey is',
    'splash.title.b': 'the Show!',
    'splash.subtitle':
      'Live entertainment on wheels. Sing, laugh, and explore Azerbaijan with Shenyol Travel.',
    'splash.loading': 'Warming up the show-bus…',
    'splash.enter': 'Enter the Show',
    'home.search': 'Search tours',
    'home.notifications': 'Notifications',
    'home.hero.ready': 'Ready to roll?',
    'home.hero.title.a': 'Every seat has a',
    'home.hero.title.b': 'front-row show.',
    'home.categories.title': 'Tour categories',
    'home.cat.all': 'All shows',
    'home.cat.mountains': 'Mountains',
    'home.cat.sea': 'Sea',
    'home.cat.city': 'City lights',
    'home.cat.nightlife': 'Nightlife',
    'home.featured': 'Featured shows',
    'home.seeAll': 'See all',
    'tour.perk.breakfast': 'Breakfast',
    'tour.perk.bus': 'Show-Bus',
    'tour.perk.show': 'Live Show',
    'tour.details': 'Tour details',
    'tour.reserveHint': 'Tap below to reserve',
    'tour.reserve': 'Reserve now',
    'tour.included': 'Everything included, no surprises.',
    'tour.tapForPerks': 'Tap card for perks',
    'tour.book': 'Book now',
    'tour.location.gabala': 'Gabala, Azerbaijan',
    'tour.title.gabala': 'Gabala Tour',
    'tour.duration.1day': '1 day',
    'seats.title': 'Choose your seats',
    'seats.perSeat': 'seat',
    'seats.groupSize': 'Group size',
    'seats.groupDesc': 'Bus resizes to fit your crew',
    'seats.fewer': 'Fewer rows',
    'seats.more': 'More rows',
    'seats.free': 'Free',
    'seats.selected': 'Selected',
    'seats.taken': 'Taken',
    'seats.busLabel': 'Show-Bus',
    'seats.layout': '4-across layout • Rear exit',
    'seats.layoutSprinter': 'Sprinter layout: left 1 + right 2 seating',
    'seats.layoutBus': 'Bus layout: left 2 + right 2 + rear 6 seats',
    'seats.occupied': 'occupied',
    'seats.seat': 'Seat',
    'seats.rearSeats': 'Rear seats',
    'bar.noSeats': 'No seats yet',
    'bar.seat': 'seat',
    'bar.seats': 'seats',
    'bar.pay': 'Secure Payment',
    'pay.title': 'Secure payment',
    'pay.cardNumber': 'Card number',
    'pay.expiry': 'Expiry',
    'pay.cvc': 'CVC',
    'pay.times': '×',
    'pay.total': 'Total',
    'pay.encrypted': '256-bit encrypted • Powered by Shenyol Pay',
    'pay.payNow': 'Pay',
    'pay.securing': 'Securing your seats…',
    'pay.processing': 'Encrypting payment • Please wait',
    'pay.confirmed': 'Booking confirmed',
    'pay.doneTitle': "You're on the show-bus!",
    'pay.doneDesc':
      'Seats {seats} are reserved for the {tour}. Check your email for tickets.',
    'pay.backToTours': 'Back to tours',
    'common.back': 'Back',
  },
}

type I18nCtx = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nCtx | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('az')

  useEffect(() => {
    const stored = localStorage.getItem('shenyol-lang') as Lang | null
    if (stored && ['az', 'ru', 'en'].includes(stored)) {
      setLangState(stored)
    }
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem('shenyol-lang', l)
    document.documentElement.lang = l
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let str = translations[lang][key] ?? translations.az[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(`{${k}}`, String(v))
        }
      }
      return str
    },
    [lang],
  )

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
