import type { Metadata } from 'next'
import { AuthContextProvider } from '@/components/auth-context'
import './globals.css'

export const metadata: Metadata = {
  title: 'Shenyol Travel',
  description: 'Turlar və Səyahətlər',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <body>
        <AuthContextProvider>{children}</AuthContextProvider>
      </body>
    </html>
  )
}
