'use client'

import { useState, useEffect } from 'react'
import { Manual, Store } from '@/types/manual'
import { getManuals, getStores } from '@/lib/manual-firestore'

export default function ManualViewer() {
  const [manuals, setManuals] = useState<Manual[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedManual, setExpandedManual] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStore, setSelectedStore] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [manualsData, storesData] = await Promise.all([
        getManuals(),
        getStores()
      ])
      setManuals(manualsData)
      setStores(storesData)
    } catch (error) {
      console.error('데이터 로드 실패:', error)
      alert('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 검색 및 필터링
  const filteredManuals = manuals.filter(manual => {
    const matchesSearch = !searchTerm || 
      manual.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manual.content.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStore = selectedStore === 'all' || 
      manual.storeTags.includes(selectedStore)
    
    return matchesSearch && matchesStore
  })

  const getStoreNames = (storeIds: string[]) => {
    return storeIds.map(id => {
      const store = stores.find(s => s.id === id)
      return store ? store.name : id
    }).join(', ')
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date)
  }

  const toggleExpanded = (manualId: string) => {
    setExpandedManual(expandedManual === manualId ? null : manualId)
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-300">로딩 중...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            매뉴얼
          </h1>
          <a
            href="/manual-management"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            관리자 모드
          </a>
        </div>
        
        {/* 검색바 */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="매뉴얼 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <div className="absolute left-3 top-3.5 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* 지점 필터 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSelectedStore('all')}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              selectedStore === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
            }`}
          >
            전체
          </button>
          {stores.map((store) => (
            <button
              key={store.id}
              onClick={() => setSelectedStore(store.id)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedStore === store.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
              }`}
            >
              {store.name}
            </button>
          ))}
        </div>

        <p className="text-gray-600 dark:text-gray-400">
          총 {filteredManuals.length}개의 매뉴얼
        </p>
      </div>

      {/* 매뉴얼 목록 */}
      <div className="space-y-4">
        {filteredManuals.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              {searchTerm || selectedStore !== 'all' 
                ? '검색 결과가 없습니다.' 
                : '등록된 매뉴얼이 없습니다.'}
            </p>
          </div>
        ) : (
          filteredManuals.map((manual) => (
            <div
              key={manual.id}
              className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden"
            >
              {/* 매뉴얼 헤더 */}
              <div
                className="p-4 bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                onClick={() => toggleExpanded(manual.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {manual.title}
                    </h3>
                    
                    {/* 지점 태그들 */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {manual.storeTags.map((storeId) => {
                        const store = stores.find(s => s.id === storeId)
                        return (
                          <span
                            key={storeId}
                            className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full"
                          >
                            {store ? store.name : storeId}
                          </span>
                        )
                      })}
                    </div>
                    
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      작성일: {formatDate(manual.createdAt)}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="text-gray-400">
                      <svg
                        className={`w-5 h-5 transition-transform ${
                          expandedManual === manual.id ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* 매뉴얼 내용 */}
              {expandedManual === manual.id && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-600">
                  <div 
                    className="prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: manual.content }}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
