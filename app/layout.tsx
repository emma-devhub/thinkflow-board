import type { Metadata } from 'next'
import { Lora, JetBrains_Mono, Inter } from 'next/font/google'
import './globals.css'

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora-var',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-var',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter-var',
})

export const metadata: Metadata = {
  title: 'ThinkFlow',
  description: 'AI research visualization — explore ideas as branching conversation trees',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ThinkFlow',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${lora.variable} ${jetbrains.variable} ${inter.variable} h-full`}>
      <body className="h-full" style={{ fontFamily: 'var(--font-inter)' }}>{children}</body>
    </html>
  )
}
