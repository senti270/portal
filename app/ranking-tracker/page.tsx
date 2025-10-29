'use client'

import RankingTrackerManager from '@/components/RankingTrackerManager'

export default function RankingTrackerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300 py-6 md:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6 md:mb-8 text-center">
          네이버 스마트 플레이스 순위 추적
        </h1>
        <RankingTrackerManager />
      </div>
    </div>
  )
}




