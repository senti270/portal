import type { Metadata } from 'next'
import './globals.css'
import { AdminProvider } from '@/contexts/AdminContext'

export const metadata: Metadata = {
  title: '드로잉컴퍼니',
  description: '드로잉컴퍼니 업무 시스템 통합 포털',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/favicon.ico', sizes: '16x16', type: 'image/x-icon' }
    ],
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
      <body>
        <AdminProvider>
          {children}
        </AdminProvider>
      </body>
    </html>
  )
}

