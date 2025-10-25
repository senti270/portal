'use client'

import { useState, useEffect } from 'react'
import { Store, Keyword, RankingRecord } from '@/types/ranking'
import StoreInfo from './StoreInfo'
import KeywordManager from './KeywordManager'
import RankingHistory from './RankingHistory'
import { getKeywords } from '@/lib/keyword-firestore'
import { getRankings } from '@/lib/ranking-firestore'

interface RankingDashboardProps {
  store: Store
}

export default function RankingDashboard({ store }: RankingDashboardProps) {
  const [activeTab, setActiveTab] = useState<'keywords' | 'history'>('keywords')
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [rankings, setRankings] = useState<RankingRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [store.id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [keywordsData, rankingsData] = await Promise.all([
        getKeywords(store.id),
        getRankings(store.id)
      ])
      setKeywords(keywordsData)
      setRankings(rankingsData)
    } catch (error) {
      console.error('데이터 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 지점 정보 */}
      <StoreInfo store={store} />

      {/* 탭 네비게이션 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('keywords')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'keywords'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              키워드 관리
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              순위 기록
            </button>
          </nav>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600 dark:text-gray-300">로딩 중...</span>
            </div>
          ) : activeTab === 'keywords' ? (
            <KeywordManager storeId={store.id} storeName={store.name} />
          ) : (
            <RankingHistory 
              storeId={store.id} 
              keywords={keywords} 
              rankings={rankings}
              store={store}
            />
          )}
        </div>
      </div>
    </div>
  )
}
