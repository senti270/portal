'use client'

import { useState } from 'react'
import { Manual, Store } from '@/types/manual'

interface ManualListProps {
  manuals: Manual[]
  stores: Store[]
  onEdit: (manual: Manual) => void
  onDelete: (manual: Manual) => void
  isAdmin: boolean
}

export default function ManualList({ manuals, stores, onEdit, onDelete, isAdmin }: ManualListProps) {
  const [expandedManual, setExpandedManual] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStore, setSelectedStore] = useState<string>('all')

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

  const handleShare = async (manualId: string) => {
    const shareUrl = `${window.location.origin}/manual-viewer?manual=${manualId}`
    
    try {
      if (navigator.share) {
        // 모바일에서 네이티브 공유 사용
        await navigator.share({
          title: manuals.find(m => m.id === manualId)?.title || '매뉴얼',
          url: shareUrl
        })
      } else {
        // 데스크톱에서 클립보드 복사
        await navigator.clipboard.writeText(shareUrl)
        alert('링크가 클립보드에 복사되었습니다!')
      }
    } catch (error) {
      console.error('공유 실패:', error)
      // 폴백: 클립보드 복사
      try {
        await navigator.clipboard.writeText(shareUrl)
        alert('링크가 클립보드에 복사되었습니다!')
      } catch (clipboardError) {
        alert('공유 기능을 사용할 수 없습니다.')
      }
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          매뉴얼 관리
        </h1>
        
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
                    {/* 공유 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleShare(manual.id)
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      title="공유하기"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                      </svg>
                    </button>

                    {isAdmin && (
                      <div className="flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onEdit(manual)
                          }}
                          className="p-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                          title="수정"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(manual)
                          }}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="삭제"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                    
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
                    className="prose dark:prose-invert max-w-none manual-content"
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
