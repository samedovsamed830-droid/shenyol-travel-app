export const metadata = {
  title: 'Geri Qaytarma ve Imtina Siyaseti | Shenyol Travel',
}

export default function RefundPage() {
  return (
    <main className="min-h-dvh bg-[#0b0610] px-4 py-10 text-[#f3f0ff] sm:px-6">
      <div className="mx-auto w-full max-w-4xl rounded-[2rem] border border-white/10 bg-[#140b22]/90 p-6 shadow-[0_30px_80px_-35px_rgba(120,50,180,0.45)] sm:p-8">
        <p className="text-xs uppercase tracking-[0.28em] text-[#a995ea]">Shenyol Travel</p>
        <h1 className="mt-3 text-3xl font-bold text-white">Geri Qaytarma ve Imtina Siyaseti</h1>
        <p className="mt-3 text-sm leading-6 text-[#cfc6ec]">
          Bu siyaset, tur bronunun legvi ve odenislerin geri qaytarilmasi qaydalarini seffaf sekilde mueyyen edir.
        </p>

        <section className="mt-8 space-y-5 text-sm leading-7 text-[#ddd6f4]">
          <article>
            <h2 className="text-lg font-semibold text-white">1. Legv muracieti qaydasi</h2>
            <p className="mt-2">
              Tur legvi uzre muraciet istifadeci terefinden destek kanali ve ya resmi rabite vasiteleri ile vaxtinda
              teqdim edilmelidir. Muraciet vaxti sistemde qeydiyyata alinan tarix-esasa gore qiymetlendirilir.
            </p>
          </article>

          <article>
            <h2 className="text-lg font-semibold text-white">2. Geri qaytarma sertleri</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-[#ddd6f4]">
              <li>Tura 48 saat qalmisa qeder imtina edilərse, odenisin 100%-i geri qaytarilir.</li>
              <li>Tura 24 saat qaldiqda imtina edilərse, odenisin 50%-i geri qaytarilir.</li>
              <li>Tura 24 saatdan az qaldiqda imtina edilərse, odenis geri qaytarilmir.</li>
            </ul>
          </article>

          <article>
            <h2 className="text-lg font-semibold text-white">3. Fors-major ve istisna hallar</h2>
            <p className="mt-2">
              Fors-major hadiseler, resmi mehdudiyyetler ve Shenyol Travel-den asili olmayan sebepler neticesinde tur
              legv olunarsa, geri qaytarma meselesi her bir hal uzre ayri qaydada qiymetlendirilir ve istifadeciye
              alternativ tarix ve ya geri odeme secimleri teklif oluna biler.
            </p>
          </article>

          <article>
            <h2 className="text-lg font-semibold text-white">4. Odenisin karta qaytarilma muddeti</h2>
            <p className="mt-2">
              Tesdiqlenmis geri qaytarma emeliyyatlari uzre mebleg musteri odeme etdiyi banka aid karta bank terefinden
              3-7 is gunu erzinde kocurulur. Dəqiq muddet bankin daxili emeliyyat qaydalarindan asilidir.
            </p>
          </article>

          <article>
            <h2 className="text-lg font-semibold text-white">5. Elave melumat</h2>
            <p className="mt-2">
              Geri qaytarma ve imtina ile bagli suallar ucun istifadeciler resmi destek kanallari vasitesi ile Shenyol
              Travel ile elaqe saxlaya bilerler.
            </p>
          </article>
        </section>

        <p className="mt-10 text-xs text-[#ab9ed6]">Son yenilenme tarixi: 02.07.2026</p>
      </div>
    </main>
  )
}
