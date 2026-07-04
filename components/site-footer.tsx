import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="mt-4 rounded-3xl border border-white/10 bg-[#120a1f] px-4 py-4 text-xs text-[#cfc6ec]">
      <p className="text-sm font-semibold text-white">Shenyol Travel (F/Ş Samad Samadov)</p>
      <p className="mt-2">VÖEN: 1009458092</p>
      <p className="mt-1">Ünvan: Bakı, Azərbaycan</p>
      <p className="mt-1">Email: shenyoltravel@gmail.com | Tel: +994 0557065019</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-[#ddd6f4]">
        <Link href="/terms" className="underline-offset-4 transition hover:text-white hover:underline">
          İstifadəçi Şərtləri
        </Link>
        <span className="text-[#8c7bb8]">|</span>
        <Link href="/privacy" className="underline-offset-4 transition hover:text-white hover:underline">
          Məxfilik Siyasəti
        </Link>
        <span className="text-[#8c7bb8]">|</span>
        <Link href="/refund" className="underline-offset-4 transition hover:text-white hover:underline">
          Geri Qaytarma
        </Link>
      </div>
    </footer>
  )
}
