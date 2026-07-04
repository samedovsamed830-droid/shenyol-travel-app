'use client'

import { Cormorant_Garamond, Manrope } from 'next/font/google'

const headingFont = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})

const bodyFont = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export function AboutUsSection() {
  return (
    <section
      aria-labelledby="about-us-title"
      className="relative isolate mt-6 overflow-hidden rounded-[2rem] border border-[#D4AF37]/35 bg-[#2E1A47] px-6 py-10 text-[#F8F2E5] shadow-[0_30px_70px_-40px_rgba(0,0,0,0.85)] sm:px-10 sm:py-14"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.18),transparent_44%),radial-gradient(circle_at_bottom_left,rgba(212,175,55,0.08),transparent_55%)]"
      />

      <div className="relative mx-auto w-full max-w-4xl text-center">
        <div className="mx-auto mb-6 h-px w-24 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
        <p className={`${bodyFont.className} text-xs font-semibold uppercase tracking-[0.34em] text-[#D4AF37] sm:text-sm`}>
          About Us
        </p>
        <h2
          id="about-us-title"
          className={`${headingFont.className} mt-4 text-balance text-3xl leading-tight text-[#F7E9C5] sm:text-5xl`}
        >
          Shenyol Travel
        </h2>

        <p className={`${bodyFont.className} mx-auto mt-8 max-w-3xl text-pretty text-base leading-8 text-[#F8F2E5]/94 sm:text-lg`}>
          Shenyol Travel – Səyahətinizə ruh qatan yol yoldaşınız! Biz, insanların yeni yerlər kəşf etmək arzusunu
          reallığa çevirmək üçün yola çıxdıq. Shenyol Travel olaraq, hər bir səyahətin sadəcə bir marşrut deyil,
          ömür boyu unudulmayacaq bir hekayə olduğuna inanırıq. Məqsədimiz, Azərbaycanın və dünyanın gizli
          guşələrini rahat, təhlükəsiz və yaddaqalan təcrübə ilə sizə təqdim etməkdir. Peşəkar komandamız və
          diqqətlə hazırladığımız daxili turlarımızla, sizin hər bir addımınızda yanınızdayıq. Çünki biz bilirik ki,
          ən böyük səyahət, bir uşağın təbəssümünə gedən yoldur və biz sizi bu xoşbəxtliyə aparan yolda bələdçiniz
          olmağa hazırıq.
        </p>

        <div className="mx-auto mt-8 h-px w-28 bg-gradient-to-r from-transparent via-[#D4AF37]/90 to-transparent" />
      </div>
    </section>
  )
}