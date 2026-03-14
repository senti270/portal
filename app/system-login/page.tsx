'use client'

import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAdmin } from '@/contexts/AdminContext'
import SystemLoginManager from '@/components/SystemLoginManager'

const DRAWING555_EMAIL = 'drawing555@naver.com'

export default function SystemLoginPage() {
  const { isAdmin } = useAdmin()
  const [isDrawing555, setIsDrawing555] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setIsDrawing555(user?.email === DRAWING555_EMAIL)
      setAuthChecked(true)
    })
    return () => unsub()
  }, [])

  const canAccess = isAdmin || isDrawing555

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">확인 중...</div>
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            접근 권한 없음
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            이 페이지는 관리자만 접근할 수 있습니다.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SystemLoginManager />
      </div>
    </div>
  )
}

