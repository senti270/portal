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
import { getKeywords, saveKeywords } from '@/lib/keyword-firestore'
import { getStores, addStore } from '@/lib/store-firestore'
import { getRankings, addRankings, deleteRankingsByDate } from '@/lib/ranking-firestore'

export default function RankingTrackerManager() {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [stores, setStores] = useState<Store[]>([])
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
    // Firebase에서 지점 데이터 로드
    const loadStores = async () => {
      try {
        const firestoreStores = await getStores()
        
        // Firebase에 지점이 없으면 기본 지점 데이터를 사용하고 Firebase에 저장
        if (firestoreStores.length === 0) {
          console.log('No stores in Firebase, adding default stores...')
          const addPromises = defaultStores.map(async (store) => {
            const { id, ...storeData } = store
            return await addStore(storeData)
          })
          await Promise.all(addPromises)
          
          // 다시 로드
          const updatedStores = await getStores()
          setStores(updatedStores)
          
          if (updatedStores.length > 0) {
            setSelectedStore(updatedStores[0])
          }
        } else {
          setStores(firestoreStores)
          
          if (firestoreStores.length > 0) {
            setSelectedStore(firestoreStores[0])
          }
        }
      } catch (error) {
        console.error('Error loading stores from Firebase:', error)
        // Firebase 로드 실패 시 기본 데이터 사용
        setStores(defaultStores)
        if (defaultStores.length > 0) {
          setSelectedStore(defaultStores[0])
        }
      } finally {
        setLoading(false)
      }
    }
    
    loadStores()
  }, [])

  useEffect(() => {
    // 선택된 지점이 변경될 때 해당 지점의 키워드와 순위 기록 로드
    const loadKeywordsAndRankings = async () => {
      if (selectedStore) {
        try {
          // Firebase에서 키워드 로드
          const storeKeywords = await getKeywords(selectedStore.id)
          setKeywords(storeKeywords)
          
          // Firebase에서 순위 기록 로드
          const storeRankings = await getRankings(selectedStore.id)
          setRankings(storeRankings)
        } catch (error) {
          console.error('Error loading keywords and rankings:', error)
          // Firebase에서 로드 실패 시 기본 키워드 사용
          const defaultStoreKeywords = defaultKeywords.filter(k => k.storeId === selectedStore.id)
          setKeywords(defaultStoreKeywords)
          setRankings([])
        }
      }
    }
    
    loadKeywordsAndRankings()
  }, [selectedStore])

  const handleStoreChange = (store: Store) => {
    setSelectedStore(store)
  }

  const handlePlaceRegistration = async (place: any) => {
    try {
      // 새로운 플레이스 데이터 생성
      const newStoreData = {
        name: place.name,
        address: place.address,
        category: place.category || '기타',
        imageUrl: '/images/store-default.jpg', // 기본 이미지
        mobileUrl: `https://m.place.naver.com/place/${place.id}/home`,
        pcUrl: `https://map.naver.com/p/entry/place/${place.id}`
      }
      
      // Firebase에 저장
      const newStoreId = await addStore(newStoreData)
      
      // 로컬 상태 업데이트
      const newStore: Store = {
        id: newStoreId,
        ...newStoreData
      }
      
      setStores(prev => [...prev, newStore])
      setSelectedStore(newStore)
      alert(`${place.name}이(가) 성공적으로 등록되었습니다!`)
    } catch (error) {
      console.error('Error registering place:', error)
      alert('플레이스 등록 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
  }

  // 키워드 관련 핸들러들
  const handleKeywordFormSave = async (updatedKeywords: Keyword[]) => {
    if (!selectedStore) return
    
    try {
      // Firebase에 키워드 저장
      await saveKeywords(selectedStore.id, updatedKeywords)
      
      // 로컬 상태 업데이트
      setKeywords(updatedKeywords)
      setShowKeywordForm(false)
      
      alert('키워드가 성공적으로 저장되었습니다!')
    } catch (error) {
      console.error('Error saving keywords:', error)
      alert('키워드 저장 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
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
        
        // 새로운 순위 기록 생성 (id와 createdAt는 Firebase에서 자동 생성)
        const newRanking: Omit<RankingRecord, 'id' | 'createdAt'> = {
          storeId: selectedStore.id,
          keywordId: keyword.id,
          date: new Date().toISOString().split('T')[0],
          mobileRank: result.mobileRank || null,
          pcRank: result.pcRank || null,
          isAutoTracked: false
        }
        
        return newRanking
      })
      
      const newRankingsData = (await Promise.all(updatePromises)).filter(Boolean) as Omit<RankingRecord, 'id' | 'createdAt'>[]
      
      if (newRankingsData.length > 0) {
        // Firebase에 순위 기록 저장
        await addRankings(newRankingsData)
        
        // Firebase에서 업데이트된 순위 기록 다시 로드
        const updatedRankings = await getRankings(selectedStore.id)
        setRankings(updatedRankings)
        
        alert(`순위 업데이트 완료! ${newRankingsData.length}개 키워드의 순위를 조회했습니다.`)
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

  const handleDeleteDate = async (date: string) => {
    if (!selectedStore) return
    
    try {
      await deleteRankingsByDate(selectedStore.id, date)
      
      // Firebase에서 업데이트된 순위 기록 다시 로드
      const updatedRankings = await getRankings(selectedStore.id)
      setRankings(updatedRankings)
      
      alert('순위 기록이 삭제되었습니다.')
    } catch (error) {
      console.error('Error deleting rankings:', error)
      alert('삭제 중 오류가 발생했습니다.')
    }
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
      {/* 플레이스 등록 버튼 */}
      <div className="flex justify-end mb-4">
        <button 
          onClick={() => setShowPlaceRegistration(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
        >
          플레이스 등록
        </button>
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
            onDeleteDate={handleDeleteDate}
          />
        </div>
      )}

      {/* 키워드 관리 모달 */}
      {showKeywordForm && (
        <KeywordForm
          keywords={keywords}
          storeId={selectedStore?.id || ''}
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
