import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '드로잉컴퍼니 - 통합 포털',
  description: '드로잉컴퍼니 업무 시스템 통합 포털',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}

