import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Shenyol Travel',
  description: 'Turlar və Səyahətlər',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <head>
        <meta name="google-site-verification" content="b6d2dcbbe2d43f96" />
      </head>
      <body>{children}</body>
    </html>
  )
}
