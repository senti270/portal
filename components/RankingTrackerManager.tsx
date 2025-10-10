'use client'

import { useState, useEffect } from 'react'
import { Store, StoreRankingData, Keyword, RankingRecord } from '@/types/ranking'
import { defaultStores, defaultKeywords } from '@/types/ranking'
import StoreSelector from './StoreSelector'
import PlaceRegistrationModal from './PlaceRegistrationModal'
import RankingHistory from './RankingHistory'
import KeywordForm from './KeywordForm'
import AutoTrackingModal from './AutoTrackingModal'
import { fetchNaverRanking, exportToExcel, formatRankingDataForExcel } from '@/lib/ranking-utils'

export default function RankingTrackerManager() {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [stores, setStores] = useState<Store[]>(defaultStores)
  const [loading, setLoading] = useState(true)
  const [showPlaceRegistration, setShowPlaceRegistration] = useState(false)
  
  // 키워드 및 순위 관련 상태
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [rankings, setRankings] = useState<RankingRecord[]>([])
  const [showKeywordForm, setShowKeywordForm] = useState(false)
  const [showAutoTrackingModal, setShowAutoTrackingModal] = useState(false)
  const [autoTracking, setAutoTracking] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [autoTrackingTime, setAutoTrackingTime] = useState({ hour: '17', minute: '15' })

  useEffect(() => {
    // 초기 로딩 - 나중에 Firebase에서 데이터 로드
    setLoading(false)
    if (stores.length > 0) {
      setSelectedStore(stores[0]) // 첫 번째 지점을 기본 선택
    }
  }, [])

  useEffect(() => {
    // 선택된 지점이 변경될 때 해당 지점의 키워드 로드
    if (selectedStore) {
      const storeKeywords = defaultKeywords.filter(k => k.storeId === selectedStore.id)
      setKeywords(storeKeywords)
    }
  }, [selectedStore])

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

  // 키워드 관련 핸들러들
  const handleKeywordFormSave = (updatedKeywords: Keyword[]) => {
    setKeywords(updatedKeywords)
    setShowKeywordForm(false)
  }

  const handleExport = async () => {
    try {
      const exportData = formatRankingDataForExcel(keywords, rankings, selectedStore?.name || '')
      exportToExcel(exportData, `${selectedStore?.name || '지점'}_순위추적데이터`)
      alert('Excel 파일이 다운로드되었습니다!')
    } catch (error) {
      console.error('Export error:', error)
      alert('파일 다운로드 중 오류가 발생했습니다.')
    }
  }

  const handleUpdate = async () => {
    if (isUpdating || !selectedStore) return
    
    setIsUpdating(true)
    
    try {
      const updatePromises = keywords.map(async (keyword) => {
        const result = await fetchNaverRanking(keyword.keyword, selectedStore.name)
        
        if (result.error) {
          console.error(`Error updating ${keyword.keyword}:`, result.error)
          return null
        }
        
        // 새로운 순위 기록 생성
        const newRanking: RankingRecord = {
          id: `ranking-${Date.now()}-${keyword.id}`,
          storeId: selectedStore.id,
          keywordId: keyword.id,
          date: new Date().toISOString().split('T')[0],
          mobileRank: result.mobileRank || null,
          pcRank: result.pcRank || null,
          isAutoTracked: false,
          createdAt: new Date()
        }
        
        return newRanking
      })
      
      const newRankings = (await Promise.all(updatePromises)).filter(Boolean) as RankingRecord[]
      
      if (newRankings.length > 0) {
        setRankings(prev => [...newRankings, ...prev])
        alert(`순위 업데이트 완료! ${newRankings.length}개 키워드의 순위를 조회했습니다.`)
      } else {
        alert('순위 업데이트 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('Update error:', error)
      alert('순위 업데이트 중 오류가 발생했습니다.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAutoTrackingSave = (time: { hour: string; minute: string }) => {
    setAutoTrackingTime(time)
    setAutoTracking(true)
    alert(`자동추적이 ${time.hour}시 ${time.minute}분으로 설정되었습니다!`)
    setShowAutoTrackingModal(false)
  }

  const handleAutoTrackingToggle = () => {
    setAutoTracking(!autoTracking)
    alert(autoTracking ? '자동추적이 중지되었습니다.' : '자동추적이 활성화되었습니다.')
    setShowAutoTrackingModal(false)
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

      {/* 선택된 지점의 키워드 및 순위 테이블 */}
      {selectedStore && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          {/* 액션 버튼들 */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
            >
              📤 내보내기
            </button>

            <button
              onClick={() => setShowAutoTrackingModal(true)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                autoTracking
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
              }`}
            >
              {autoTracking ? '🔄 자동추적 ON' : '⏸️ 자동추적 OFF'}
            </button>

            <button
              onClick={() => setShowKeywordForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
            >
              키워드 관리
            </button>

            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                isUpdating 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-700'
              } text-white`}
            >
              {isUpdating ? '⏳ 업데이트 중...' : '🔄 업데이트'}
            </button>
          </div>

          {/* 키워드 및 순위 테이블 */}
          <RankingHistory
            storeId={selectedStore.id}
            keywords={keywords}
            rankings={rankings}
          />
        </div>
      )}

      {/* 키워드 관리 모달 */}
      {showKeywordForm && (
        <KeywordForm
          keywords={keywords}
          onSave={handleKeywordFormSave}
          onCancel={() => setShowKeywordForm(false)}
        />
      )}

      {/* 자동추적 설정 모달 */}
      <AutoTrackingModal
        isOpen={showAutoTrackingModal}
        onClose={() => setShowAutoTrackingModal(false)}
        onSave={handleAutoTrackingSave}
        isActive={autoTracking}
        onToggleActive={handleAutoTrackingToggle}
      />

      {/* 플레이스 등록 모달 */}
      <PlaceRegistrationModal
        isOpen={showPlaceRegistration}
        onClose={() => setShowPlaceRegistration(false)}
        onPlaceSelect={handlePlaceRegistration}
      />
    </div>
  )
}
