'use client'

import React, { useState, useEffect } from 'react'
import { searchNaverPlace } from '@/lib/ranking-utils'

interface PlaceRegistrationModalProps {
  isOpen: boolean
  onClose: () => void
  onPlaceSelect: (place: any) => void
}

export default function PlaceRegistrationModal({ isOpen, onClose, onPlaceSelect }: PlaceRegistrationModalProps) {
  const [searchQuery, setSearchQuery] = useState('청담장어마켓')
  const [secondarySearch, setSecondarySearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<any>(null)

  useEffect(() => {
    if (isOpen) {
      // 모달이 열릴 때 기본 검색 실행
      handleSearch()
    }
  }, [isOpen])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setIsSearching(true)
    try {
      const result = await searchNaverPlace(searchQuery)
      if (result.places) {
        setSearchResults(result.places)
      } else {
        // API 오류 시 샘플 데이터 사용
        setSearchResults([
          {
            id: 'place1',
            name: '청담장어마켓',
            address: '송파대로 111 202동 1층 165, 166, 167, 168, 169, 170호',
            category: '장어요리'
          },
          {
            id: 'place2', 
            name: '청담장어마켓 동탄점',
            address: '동탄대로 446 1층 1002호~1006호, 1009호, 1010호',
            category: '장어요리'
          },
          {
            id: 'place3',
            name: '청담장어마켓 송파점',
            address: '서울 송파구 백제고분로 451',
            category: '장어요리'
          }
        ])
      }
    } catch (error) {
      console.error('Search error:', error)
      alert('검색 중 오류가 발생했습니다.')
    } finally {
      setIsSearching(false)
    }
  }

  const handlePlaceSelect = (place: any) => {
    setSelectedPlace(place)
  }

  const handleRegister = () => {
    if (selectedPlace) {
      onPlaceSelect(selectedPlace)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-hidden">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-[800px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            플레이스 등록
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 기본 검색 */}
          <div>
            <div className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="매장명을 입력하세요"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                {isSearching ? '검색 중...' : '검색'}
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              최대 300개까지 검색됩니다.
            </p>
          </div>

          {/* 보조 검색 */}
          <div className="relative">
            <input
              type="text"
              value={secondarySearch}
              onChange={(e) => setSecondarySearch(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="검색"
            />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* 검색 결과 */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2 gap-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                <div>플레이스명</div>
                <div>주소</div>
              </div>
            </div>
            
            <div className="max-h-60 overflow-y-auto">
              {searchResults.map((place) => (
                <div
                  key={place.id}
                  onClick={() => handlePlaceSelect(place)}
                  className={`grid grid-cols-2 gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    selectedPlace?.id === place.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    {place.name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {place.address}
                  </div>
                </div>
              ))}
              
              {searchResults.length === 0 && !isSearching && (
                <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  검색 결과가 없습니다.
                </div>
              )}
              
              {isSearching && (
                <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  검색 중...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleRegister}
            disabled={!selectedPlace}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  )
}

