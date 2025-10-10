'use client'

import { useState, useEffect } from 'react'
import { Store, StoreRankingData } from '@/types/ranking'
import { defaultStores } from '@/types/ranking'
import StoreSelector from './StoreSelector'
import RankingDashboard from './RankingDashboard'

export default function RankingTrackerManager() {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [stores, setStores] = useState<Store[]>(defaultStores)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 초기 로딩 - 나중에 Firebase에서 데이터 로드
    setLoading(false)
    if (stores.length > 0) {
      setSelectedStore(stores[0]) // 첫 번째 지점을 기본 선택
    }
  }, [])

  const handleStoreChange = (store: Store) => {
    setSelectedStore(store)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 지점 선택기 */}
      <StoreSelector 
        stores={stores}
        selectedStore={selectedStore}
        onStoreChange={handleStoreChange}
      />

      {/* 선택된 지점의 순위 대시보드 */}
      {selectedStore && (
        <RankingDashboard store={selectedStore} />
      )}
    </div>
  )
}
