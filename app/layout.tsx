import type { Metadata } from 'next'
import './globals.css'
import { AdminProvider } from '@/contexts/AdminContext'
import Script from 'next/script'

export const metadata: Metadata = {
  title: '카페드로잉&청담장어마켓',
  description: '카페드로잉&청담장어마켓 업무 시스템 통합 포털',
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
    <html lang="ko" className="light">
      <head>
        <Script id="disable-dark-mode" strategy="beforeInteractive">
          {`
            // 다크모드 클래스 제거 강제
            if (typeof document !== 'undefined') {
              document.documentElement.classList.remove('dark');
              document.documentElement.classList.add('light');
              // 다크모드 감지 방지
              const observer = new MutationObserver(() => {
                if (document.documentElement.classList.contains('dark')) {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                }
              });
              observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['class']
              });
            }
          `}
        </Script>
      </head>
      <body>
        <AdminProvider>
          {children}
        </AdminProvider>
      </body>
    </html>
  )
}

