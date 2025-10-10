'use client'

import { useState, useEffect } from 'react'
import { Store, StoreRankingData } from '@/types/ranking'
import { defaultStores } from '@/types/ranking'
import StoreSelector from './StoreSelector'
import RankingDashboard from './RankingDashboard'
import PlaceRegistrationModal from './PlaceRegistrationModal'

export default function RankingTrackerManager() {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [stores, setStores] = useState<Store[]>(defaultStores)
  const [loading, setLoading] = useState(true)
  const [showPlaceRegistration, setShowPlaceRegistration] = useState(false)

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

  const handlePlaceRegistration = (place: any) => {
    // 새로운 플레이스 추가 로직
    const newStore: Store = {
      id: place.id,
      name: place.name,
      address: place.address,
      category: place.category || '기타',
      imageUrl: '/images/store-default.jpg', // 기본 이미지
      mobileUrl: `https://m.place.naver.com/place/${place.id}/home`,
      pcUrl: `https://map.naver.com/p/entry/place/${place.id}`
    }
    
    setStores(prev => [...prev, newStore])
    setSelectedStore(newStore)
    alert(`${place.name}이(가) 성공적으로 등록되었습니다!`)
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
      {/* 네이버 스타일 헤더 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        {/* 메인 타이틀 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              스마트플레이스 순위 추적
            </h1>
            <button className="w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700">
              <span className="text-xs text-gray-600 dark:text-gray-400">?</span>
            </button>
          </div>
          <button 
            onClick={() => setShowPlaceRegistration(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            플레이스 등록
          </button>
        </div>

        {/* 정보 박스 */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">i</span>
            </div>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              스마트 플레이스 순위 추적은 네이버 지도에 등록된 가게의 노출 순위를 확인하실 수 있습니다.
            </p>
          </div>
        </div>

        {/* 등록된 스마트플레이스 섹션 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              등록된 스마트플레이스
            </h2>
            <button className="relative px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              플레이스 관리
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">new</span>
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="등록된 스마트플레이스 검색"
              className="w-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <svg className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* 하단 정보 */}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>서울 송파구 가락로 2 기준 순위 조회 중</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700">
              <span className="text-xs text-gray-600 dark:text-gray-400">i</span>
            </button>
            <span>IP, 설정한 위치, 시간에 따라 순위 오차가 발생할 수 있습니다.</span>
          </div>
        </div>
      </div>

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

      {/* 플레이스 등록 모달 */}
      <PlaceRegistrationModal
        isOpen={showPlaceRegistration}
        onClose={() => setShowPlaceRegistration(false)}
        onPlaceSelect={handlePlaceRegistration}
      />
    </div>
  )
}
