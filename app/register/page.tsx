'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

export default function RegisterPage() {
  const router = useRouter()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!auth || !db) {
      setError('Firebase konfiqurasiyasi tapilmadi.')
      return
    }

    setIsSubmitting(true)
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()

      if (fullName) {
        await updateProfile(credential.user, {
          displayName: fullName,
        })
      }

      await setDoc(doc(db, 'users', credential.user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        favorites: [],
        createdAt: serverTimestamp(),
      })

      router.push('/profile')
    } catch {
      setError('Qeydiyyat zamani xeta bas verdi. Melumatlari yoxla.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#0b0610] via-[#1b0f2f] to-[#12071d] px-4 py-10">
      <section className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-[#130a22]/90 p-6 shadow-[0_40px_120px_-45px_rgba(151,71,255,0.7)] sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-[#aa95ff]">Shenyol Travel</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Qeydiyyat</h1>
        <p className="mt-2 text-sm text-[#c4b7ef]">Yeni hesab yarat ve sechimlerini kabinetden idare et.</p>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-[#d6cfe8]">
            Ad
            <input
              type="text"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0d0718] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
            />
          </label>

          <label className="block text-sm text-[#d6cfe8]">
            Soyad
            <input
              type="text"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0d0718] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
            />
          </label>

          <label className="block text-sm text-[#d6cfe8] sm:col-span-2">
            Telefon
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0d0718] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
            />
          </label>

          <label className="block text-sm text-[#d6cfe8] sm:col-span-2">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0d0718] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
            />
          </label>

          <label className="block text-sm text-[#d6cfe8] sm:col-span-2">
            Sifre
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0d0718] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
            />
          </label>

          {error ? (
            <p className="sm:col-span-2 rounded-2xl border border-[#ff5fa9]/30 bg-[#2b1024] px-3 py-2 text-sm text-[#ff9ac8]">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="sm:col-span-2 w-full rounded-2xl bg-gradient-to-r from-brand-purple to-brand-pink px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Yaradilir...' : 'Qeydiyyatdan kec'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#c4b7ef]">
          Hesabin var?{' '}
          <Link href="/login" className="font-semibold text-brand-yellow">
            Giris et
          </Link>
        </p>
      </section>
    </main>
  )
}
