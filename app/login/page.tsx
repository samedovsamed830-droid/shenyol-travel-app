'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!auth) {
      setError('Firebase Auth konfiqurasiyasi tapilmadi.')
      return
    }

    setIsSubmitting(true)
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
      const idToken = await credential.user.getIdToken(true)
      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      })

      if (!sessionResponse.ok) {
        console.warn('Admin sessiya cookie yaradilmasi ugursuz oldu, normal giris davam edir.')
      }

      router.push('/profile')
    } catch {
      setError('Email ve ya sifre sehvdir.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#0b0610] via-[#1b0f2f] to-[#12071d] px-4 py-10">
      <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#130a22]/90 p-6 shadow-[0_40px_120px_-45px_rgba(151,71,255,0.7)] sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-[#aa95ff]">Shenyol Travel</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Giris et</h1>
        <p className="mt-2 text-sm text-[#c4b7ef]">Hesabina daxil ol ve kabinetini idare et.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block text-sm text-[#d6cfe8]">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0d0718] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
            />
          </label>

          <label className="block text-sm text-[#d6cfe8]">
            Sifre
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0d0718] px-4 py-3 text-white outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-purple/20"
            />
          </label>

          {error ? (
            <p className="rounded-2xl border border-[#ff5fa9]/30 bg-[#2b1024] px-3 py-2 text-sm text-[#ff9ac8]">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-gradient-to-r from-brand-purple to-brand-pink px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Daxil olunur...' : 'Giris et'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#c4b7ef]">
          Hesabin yoxdur?{' '}
          <Link href="/register" className="font-semibold text-brand-yellow">
            Qeydiyyatdan kec
          </Link>
        </p>
      </section>
    </main>
  )
}
