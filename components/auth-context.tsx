'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'

type AuthContextValue = {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthContextProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isActive = true
    let unsubscribe: (() => void) | undefined

    const startAuthListener = async () => {
      try {
        const [{ auth }, { onAuthStateChanged }] = await Promise.all([
          import('@/lib/firebase'),
          import('firebase/auth'),
        ])

        if (!auth) {
          if (isActive) setLoading(false)
          return
        }

        unsubscribe = onAuthStateChanged(auth, (nextUser) => {
          if (!isActive) return
          setUser(nextUser)
          setLoading(false)
        })
      } catch {
        if (isActive) setLoading(false)
      }
    }

    startAuthListener()

    return () => {
      isActive = false
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthContextProvider')
  }

  return context
}