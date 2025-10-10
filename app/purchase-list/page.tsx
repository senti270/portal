'use client'

import PurchaseListManager from '@/components/PurchaseListManager'

export default function PurchaseListPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          구매물품리스트 관리
        </h1>
        <PurchaseListManager />
      </div>
    </div>
  )
}
