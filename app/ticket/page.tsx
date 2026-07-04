'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { domToPng } from 'modern-screenshot'
import { jsPDF } from 'jspdf'
import { Download, CheckCircle2, MapPin, Calendar, User, Armchair, Wallet, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type StoredPassenger = {
  seat: string
  name: string
  surname: string
}

type StoredBooking = {
  tourId: string
  tourTitle: string
  tourDate?: string
  tourDateLabel?: string
  tourPrice: number
  unitPrice?: number
  packageType?: 'economy' | 'standard'
  seatCount: number
  totalPrice: number
  seats: string[]
  passengers?: StoredPassenger[]
  passengerName?: string
  phone: string
  bookedAt: string
  ticketCode: string
}

type TicketVoucher = {
  id: string
  seat: string
  passengerName: string
  phone: string
  ticketCode: string
}

const LAST_BOOKING_KEY = 'shenyol-last-booking'

const formatPassengerName = (name: string, surname: string) => `${name} ${surname}`.trim()

const readImageSize = (dataUrl: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Ticket image size could not be read.'))
    image.src = dataUrl
  })

export default function TicketPage() {
  const [isDownloadingId, setIsDownloadingId] = useState<string | null>(null)
  const [ticketData, setTicketData] = useState<StoredBooking | null>(null)
  const [vouchers, setVouchers] = useState<TicketVoucher[]>([])
  const ticketRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const storedBooking = window.localStorage.getItem(LAST_BOOKING_KEY)
      const storedUser = window.localStorage.getItem('shenyol-current-user')
      const parsedUser = storedUser ? (JSON.parse(storedUser) as { firstName?: string; lastName?: string; phone?: string }) : null
      const booking = storedBooking ? (JSON.parse(storedBooking) as StoredBooking) : null

      const phone = booking?.phone || parsedUser?.phone || ''
      const preparedBooking: StoredBooking = {
        tourId: booking?.tourId ?? '',
        tourTitle: booking?.tourTitle ?? 'Selected tour',
        tourDate: booking?.tourDate ?? '',
        tourDateLabel: booking?.tourDateLabel ?? '',
        tourPrice: booking?.tourPrice ?? 0,
        unitPrice: booking?.unitPrice ?? booking?.tourPrice ?? 0,
        packageType: booking?.packageType,
        seatCount: booking?.seatCount ?? 0,
        totalPrice: booking?.totalPrice ?? 0,
        seats: booking?.seats ?? [],
        passengers: booking?.passengers ?? [],
        passengerName: booking?.passengerName,
        phone,
        bookedAt: booking?.bookedAt ?? new Date().toISOString(),
        ticketCode: booking?.ticketCode ?? `SHN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-1`,
      }

      setTicketData(preparedBooking)

      const normalizedPassengers = preparedBooking.passengers && preparedBooking.passengers.length > 0
        ? preparedBooking.passengers
        : preparedBooking.seats.map((seat, index) => {
            const fallbackName = index === 0
              ? (preparedBooking.passengerName || formatPassengerName(parsedUser?.firstName ?? '', parsedUser?.lastName ?? '') || 'Guest')
              : 'Guest'

            const [name, ...rest] = fallbackName.split(' ').filter(Boolean)

            return {
              seat,
              name: name ?? 'Guest',
              surname: rest.join(' '),
            }
          })

      const nextVouchers = normalizedPassengers.map((passenger, index) => {
        const seat = String(passenger.seat ?? '').trim()
        const passengerName = formatPassengerName(String(passenger.name ?? ''), String(passenger.surname ?? '')) || 'Guest Passenger'

        return {
          id: `${preparedBooking.ticketCode}-${seat || index + 1}`,
          seat: seat || preparedBooking.seats[index] || '—',
          passengerName,
          phone,
          ticketCode: `${preparedBooking.ticketCode}-${seat || index + 1}`,
        }
      })

      setVouchers(nextVouchers)

      const date = preparedBooking.bookedAt ? new Date(preparedBooking.bookedAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')
      const storedTickets = JSON.parse(localStorage.getItem('shenyol_tickets') || '[]') as Array<Record<string, unknown>>

      const newEntries = nextVouchers.map((voucher) => ({
        id: `ticket-${Date.now()}-${voucher.id}`,
        name: voucher.passengerName,
        phone: voucher.phone,
        tour: preparedBooking.tourTitle,
        seat: voucher.seat,
        date,
        purchaseDate: date,
        packageType: preparedBooking.packageType,
        totalPrice: Number(preparedBooking.unitPrice ?? preparedBooking.tourPrice ?? 0),
        price: `${Number(preparedBooking.unitPrice ?? preparedBooking.tourPrice ?? 0)} AZN`,
        ticketCode: voucher.ticketCode,
      }))

      const existingCodes = new Set(storedTickets.map((ticket) => String(ticket.ticketCode ?? '')))
      const mergedEntries = newEntries.filter((entry) => !existingCodes.has(entry.ticketCode))

      if (mergedEntries.length > 0) {
        localStorage.setItem('shenyol_tickets', JSON.stringify([...mergedEntries, ...storedTickets]))
      }
    } catch (error) {
      console.error('Ticket storage sync failed:', error)
    }
  }, [])

  const ticketPriceText = useMemo(() => {
    if (!ticketData) return '0 AZN'
    return `${ticketData.totalPrice} AZN`
  }, [ticketData])

  const dateText = ticketData?.bookedAt ? new Date(ticketData.bookedAt).toLocaleDateString('en-GB') : '—'
  const timeText = ticketData?.bookedAt ? new Date(ticketData.bookedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'
  const tourDateText = ticketData?.tourDateLabel || (ticketData?.tourDate ? new Date(ticketData.tourDate).toLocaleDateString('az-AZ') : '—')

  const handleDownloadTicketPdf = async (voucher: TicketVoucher) => {
    const element = ticketRefs.current[voucher.id]
    if (!element) return

    setIsDownloadingId(voucher.id)
    try {
      const dataUrl = await domToPng(element, {
        scale: 3,
        quality: 1,
      })

      const { width, height } = await readImageSize(dataUrl)
      const orientation = width > height ? 'l' : 'p'
      const pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [width, height],
      })

      pdf.addImage(dataUrl, 'PNG', 0, 0, width, height)
      pdf.save(`Shenyol-Bilet-${voucher.ticketCode}.pdf`)
    } catch (error) {
      console.error('Bilet PDF yüklənərkən xəta:', error)
    } finally {
      setIsDownloadingId(null)
    }
  }

  return (
    <div className='min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 antialiased'>
      <div className='text-center mb-6 max-w-sm'>
        <div className='inline-flex items-center justify-center w-12 h-12 bg-green-100 text-green-600 rounded-full mb-3'>
          <CheckCircle2 className='w-8 h-8' />
        </div>
        <h1 className='text-xl font-bold text-slate-900'>Ödəniş Uğurludur!</h1>
        <p className='text-sm text-slate-500 mt-1'>
          {vouchers.length > 0
            ? `${vouchers.length} ədəd bilet hazırlandı. Hər bileti ayrıca PDF kimi yükləyə bilərsiniz.`
            : 'Biletiniz onlayn olaraq hazırlandı. Aşağıdakı düymədən telefonunuza endirə bilərsiniz.'}
        </p>
      </div>

      <div className='w-full max-w-sm space-y-6'>
        {vouchers.map((voucher, index) => (
          <div key={voucher.id} className='space-y-3'>
            <div
              className='w-full rounded-3xl overflow-hidden shadow-xl bg-white border border-slate-100'
              ref={(node) => {
                ticketRefs.current[voucher.id] = node
              }}
            >
              <div className='bg-purple-700 text-white p-5 flex justify-between items-center'>
                <div>
                  <span className='text-xs uppercase tracking-widest opacity-80 font-semibold'>Elektron Bilet #{index + 1}</span>
                  <h2 className='text-xl font-black tracking-tight'>Shenyol Travel</h2>
                </div>
                <div className='bg-white/20 px-3 py-1 rounded-full text-xs font-mono font-bold'>{voucher.ticketCode}</div>
              </div>

              <div className='p-5 space-y-4'>
                <div>
                  <span className='text-xs text-slate-400 block font-medium'>Seçilən Tur</span>
                  <div className='flex items-center gap-2 mt-0.5 text-purple-900 font-bold text-lg'>
                    <MapPin className='w-5 h-5 text-purple-600 shrink-0' />
                    <span>{ticketData?.tourTitle ?? 'Selected tour'}</span>
                  </div>
                </div>
                <hr className='border-slate-100' />
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <span className='text-xs text-slate-400 block font-medium'>Sərnişin</span>
                    <div className='flex items-center gap-1.5 mt-1 text-sm font-semibold text-slate-800'>
                      <User className='w-4 h-4 text-slate-400' />
                      <span className='truncate'>{voucher.passengerName}</span>
                    </div>
                  </div>
                  <div>
                    <span className='text-xs text-slate-400 block font-medium'>Telefon</span>
                    <div className='mt-1 text-sm font-semibold text-slate-800'>{voucher.phone}</div>
                  </div>
                  <div>
                    <span className='text-xs text-slate-400 block font-medium'>Tarix & Saat</span>
                    <div className='flex items-center gap-1.5 mt-1 text-sm font-semibold text-slate-800'>
                      <Calendar className='w-4 h-4 text-slate-400' />
                      <span>{dateText} - {timeText}</span>
                    </div>
                  </div>
                  <div>
                    <span className='text-xs text-slate-400 block font-medium'>Tur tarixi</span>
                    <div className='mt-1 text-sm font-semibold text-slate-800'>{tourDateText}</div>
                  </div>
                  <div>
                    <span className='text-xs text-slate-400 block font-medium'>Oturacaq</span>
                    <div className='flex items-center gap-1.5 mt-1 text-sm font-semibold text-slate-800'>
                      <Armchair className='w-4 h-4 text-purple-600' />
                      <span className='text-purple-700 font-bold'>{voucher.seat}</span>
                    </div>
                  </div>
                </div>
                <hr className='border-slate-100' />
                <div className='flex justify-between items-center bg-purple-50 p-3 rounded-xl border border-purple-100'>
                  <div className='flex items-center gap-2'>
                    <Wallet className='w-4 h-4 text-purple-600' />
                    <span className='text-xs text-slate-500 font-medium'>Rezervasiya ödənişi</span>
                  </div>
                  <span className='text-base font-black text-purple-900'>{ticketPriceText}</span>
                </div>
                {ticketData?.packageType ? (
                  <div className='flex justify-between items-center rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600'>
                    <span>Paket</span>
                    <span className='font-semibold text-slate-800'>
                      {ticketData.packageType === 'economy' ? 'Ekonom' : 'Standart'}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <button
              onClick={() => handleDownloadTicketPdf(voucher)}
              disabled={isDownloadingId === voucher.id}
              className='w-full bg-purple-700 hover:bg-purple-800 disabled:bg-purple-400 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg transition duration-200 flex items-center justify-center gap-2 text-sm'
            >
              <Download className='w-4 h-4' />
              {isDownloadingId === voucher.id ? 'PDF Yüklənir...' : `Bilet #${index + 1} PDF yüklə`}
            </button>
          </div>
        ))}
      </div>

      <div className='w-full max-w-sm mt-6'>
        <Link href='/' className='w-full bg-white hover:bg-slate-100 text-slate-700 font-semibold py-3 px-4 rounded-2xl border border-slate-200 transition duration-200 flex items-center justify-center gap-2 text-sm'>
          <ArrowLeft className='w-4 h-4' />
          Ana Səhifəyə Qayıt
        </Link>
      </div>
    </div>
  )
}
