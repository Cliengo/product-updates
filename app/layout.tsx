import type { Metadata } from 'next'
import { Inter, Inter_Tight } from 'next/font/google'
import './globals.css'

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const interTight = Inter_Tight({
  variable: '--font-heading',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'Product Updates · Cliengo',
  description: 'Novedades del producto para equipos internos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${interTight.variable} h-full antialiased`}>
      <body className="min-h-full bg-neutral-50 font-sans">{children}</body>
    </html>
  )
}
