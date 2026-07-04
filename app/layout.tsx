import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Sora } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})
const sora = Sora({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'Shenyol Travel',
  description: 'Turlar və Səyahətlər',
  icons: {
    icon: '/app-logo.png',
    apple: '/app-logo.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="az"
      className={`light ${geistSans.variable} ${geistMono.variable} ${sora.variable} bg-background`}
    >
      <head>
        <meta name="google-site-verification" content="b6d2dcbbe2d43f96" />
        <meta name="x-redeploy-trigger" content="2026-07-05" />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
        {process.env.NODE_ENV === 'production' && process.env.VERCEL === '1' && <Analytics />}
      </body>
    </html>
  )
}
