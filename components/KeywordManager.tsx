'use client'

import { useState, useEffect } from 'react'
import { Keyword, RankingFormData, defaultKeywords } from '@/types/ranking'
import KeywordTable from './KeywordTable'
import KeywordForm from './KeywordForm'
import AutoTrackingModal from './AutoTrackingModal'

interface KeywordManagerProps {
  storeId: string
}

export default function KeywordManager({ storeId }: KeywordManagerProps) {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showAutoTrackingModal, setShowAutoTrackingModal] = useState(false)
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null)
  const [autoTracking, setAutoTracking] = useState(true) // 자동추적 ON/OFF

  useEffect(() => {
    // 해당 지점의 키워드만 필터링 (나중에 Firebase에서 로드)
    const storeKeywords = defaultKeywords.filter(k => k.storeId === storeId)
    setKeywords(storeKeywords)
  }, [storeId])

  const handleAddKeyword = (formData: RankingFormData) => {
    const newKeyword: Keyword = {
      id: `keyword-${Date.now()}`,
      ...formData,
      storeId,
      isActive: true
    }
    setKeywords([...keywords, newKeyword])
    setShowForm(false)
  }

  const handleEditKeyword = (id: string, formData: RankingFormData) => {
    setKeywords(keywords.map(k => 
      k.id === id ? { ...k, ...formData } : k
    ))
    setEditingKeyword(null)
  }

  const handleDeleteKeyword = (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      setKeywords(keywords.filter(k => k.id !== id))
    }
  }

  const handleToggleActive = (id: string) => {
    setKeywords(keywords.map(k => 
      k.id === id ? { ...k, isActive: !k.isActive } : k
    ))
  }

  const handleExport = () => {
    // 데이터 내보내기 기능 (나중에 구현)
    console.log('Exporting keywords:', keywords)
    alert('데이터 내보내기 기능은 곧 구현됩니다!')
  }

  const handleUpdate = () => {
    // 수동 업데이트 기능 (나중에 구현)
    console.log('Manual update triggered')
    alert('순위 업데이트 기능은 곧 구현됩니다!')
  }

  const handleAutoTrackingSave = (time: { hour: string; minute: string }) => {
    console.log('Auto tracking time saved:', time)
    setAutoTracking(true)
    alert(`자동추적이 ${time.hour}시 ${time.minute}분으로 설정되었습니다!`)
  }

  const handleAutoTrackingToggle = () => {
    setAutoTracking(!autoTracking)
    alert(autoTracking ? '자동추적이 중지되었습니다.' : '자동추적이 활성화되었습니다.')
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            추적 키워드 {keywords.length}개
          </h3>
        </div>
        
        {/* 액션 버튼들 */}
        <div className="flex flex-wrap gap-2">
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
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            ➕ 키워드 관리
          </button>
          
          <button
            onClick={handleUpdate}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition-colors"
          >
            🔄 업데이트
          </button>
        </div>
      </div>

      {/* 키워드 테이블 */}
      <KeywordTable
        keywords={keywords}
        onEdit={setEditingKeyword}
        onDelete={handleDeleteKeyword}
        onToggleActive={handleToggleActive}
      />

      {/* 키워드 관리 모달 */}
      {showForm && (
        <KeywordForm
          keywords={keywords}
          onSave={(updatedKeywords) => {
            setKeywords(updatedKeywords)
            setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
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
    </div>
  )
}
