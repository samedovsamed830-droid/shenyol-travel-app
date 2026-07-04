export const metadata = {
  title: 'Mexfilik Siyaseti | Shenyol Travel',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-[#0b0610] px-4 py-10 text-[#f3f0ff] sm:px-6">
      <div className="mx-auto w-full max-w-4xl rounded-[2rem] border border-white/10 bg-[#140b22]/90 p-6 shadow-[0_30px_80px_-35px_rgba(120,50,180,0.45)] sm:p-8">
        <p className="text-xs uppercase tracking-[0.28em] text-[#a995ea]">Shenyol Travel</p>
        <h1 className="mt-3 text-3xl font-bold text-white">Mexfilik Siyaseti</h1>
        <p className="mt-3 text-sm leading-6 text-[#cfc6ec]">
          Shenyol Travel musterilerinin sexsi melumatlarinin qorunmasina xususi ehemmiyyet verir. Bu siyaset,
          melumatlarin toplanmasi, istifadesi, saxlanmasi ve qorunmasi prinsiplərini aciqlayir.
        </p>

        <section className="mt-8 space-y-5 text-sm leading-7 text-[#ddd6f4]">
          <article>
            <h2 className="text-lg font-semibold text-white">1. Toplanan sexsi melumatlar</h2>
            <p className="mt-2">
              Xidmetin gosterilmesi ucun ad, soyad, telefon nomresi ve email unvani kimi melumatlar toplanir.
              Toplanan melumatlar bron, istifadeci elaqesi ve xidmet keyfiyyetinin artirilmasi meqsedleri ucun
              istifade olunur.
            </p>
          </article>

          <article>
            <h2 className="text-lg font-semibold text-white">2. Odenis melumatlari</h2>
            <p className="mt-2">
              Bank karti melumatlari Shenyol Travel serverlerinde saxlanilmir. Kart emeliyyatlari birbasa bankin
              tehlukesiz 3D-Secure infrastrukturunda emal olunur. Bu sebebden kart melumatlarina sirket terefinden
              birbasa erisim yoxdur.
            </p>
          </article>

          <article>
            <h2 className="text-lg font-semibold text-white">3. Melumatlarin qorunmasi</h2>
            <p className="mt-2">
              Sexsi melumatlarin qorunmasi ucun texniki ve teskilati tehlukesizlik tedbirleri tetbiq edilir. Yalniz
              selahiyyetli personal xidmetin gosterilmesi ucun zeruri olduqda bu melumatlara erisim huququna malikdir.
            </p>
          </article>

          <article>
            <h2 className="text-lg font-semibold text-white">4. Ucuncu tereflerle paylasma</h2>
            <p className="mt-2">
              Musteri melumatlari qanunvericilikde nezerde tutulan hallar istisna olmaqla ucuncu tereflere satilmir,
              kiraye verilmir ve marketinq meqsedleri ile oturulmur. Yalniz xidmetin heyata kecirilmesi ucun vacib
              olan emeliyyat tərəfdaşlari ile minimum hecmde melumat paylasila biler.
            </p>
          </article>

          <article>
            <h2 className="text-lg font-semibold text-white">5. Istifadecinin huquqlari</h2>
            <p className="mt-2">
              Istifadeci oz melumatlarinin duzeldilmesini, yenilenmesini ve qanunvericiliye uygun hallarda silinmesini
              teleb ede biler. Bunun ucun resmi destek kanallari vasitesi ile Shenyol Travel ile elaqe saxlanilmalidir.
            </p>
          </article>
        </section>

        <p className="mt-10 text-xs text-[#ab9ed6]">Son yenilenme tarixi: 02.07.2026</p>
      </div>
    </main>
  )
}
