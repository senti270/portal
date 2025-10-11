'use client'

import { useState, useEffect } from 'react'
import { PurchaseItem, PurchaseItemFormData } from '@/types/purchase'
import { getPurchaseItems, addPurchaseItem, updatePurchaseItem, deletePurchaseItem } from '@/lib/purchase-firestore'
import PurchaseItemTable from './PurchaseItemTable'
import PurchaseItemForm from './PurchaseItemForm'

const ADMIN_PASSWORD = '43084308'

export default function PurchaseListManager() {
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [filteredItems, setFilteredItems] = useState<PurchaseItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('') // 카테고리 필터 상태 추가
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<PurchaseItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // 관리자 인증 상태
  const [isAdmin, setIsAdmin] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [password, setPassword] = useState('')

  // 로그인 상태 로드
  useEffect(() => {
    const savedAuth = localStorage.getItem('purchase-admin-auth')
    if (savedAuth === ADMIN_PASSWORD) {
      setIsAdmin(true)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    try {
      setLoading(true)
      const purchaseItems = await getPurchaseItems()
      setItems(purchaseItems)
      setFilteredItems(purchaseItems)
    } catch (error) {
      console.error('Error loading items:', error)
      setError('물품 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 검색 및 카테고리 필터링
  useEffect(() => {
    let filtered = items

    // 검색어 필터링
    if (searchTerm.trim()) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.purchaseSource.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.some(cat => cat.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.purchaseUnit && item.purchaseUnit.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // 카테고리 필터링
    if (selectedCategory) {
      filtered = filtered.filter(item =>
        item.category.includes(selectedCategory)
      )
    }

    setFilteredItems(filtered)
  }, [searchTerm, selectedCategory, items])

  // 카테고리 필터 핸들러
  const handleCategoryFilter = (category: string) => {
    if (selectedCategory === category) {
      // 같은 카테고리를 다시 클릭하면 필터 해제
      setSelectedCategory('')
    } else {
      // 다른 카테고리 클릭하면 해당 카테고리로 필터링
      setSelectedCategory(category)
    }
  }

  // 필터 초기화 함수
  const clearFilters = () => {
    setSearchTerm('')
    setSelectedCategory('')
  }

  const handleAddItem = async (formData: PurchaseItemFormData) => {
    try {
      setError(null)
      console.log('Adding item:', formData)
      await addPurchaseItem(formData, formData.imageFile)
      await loadItems()
      setShowForm(false)
    } catch (error) {
      console.error('Error adding item:', error)
      setError(`물품 추가에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  const handleEditItem = async (id: string, formData: PurchaseItemFormData) => {
    try {
      setError(null)
      await updatePurchaseItem(id, formData, formData.imageFile)
      await loadItems()
      setEditingItem(null)
    } catch (error) {
      console.error('Error updating item:', error)
      setError('물품 수정에 실패했습니다.')
    }
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    
    try {
      setError(null)
      await deletePurchaseItem(id)
      await loadItems()
    } catch (error) {
      console.error('Error deleting item:', error)
      setError('물품 삭제에 실패했습니다.')
    }
  }

  const handleEdit = (item: PurchaseItem) => {
    setEditingItem(item)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingItem(null)
  }

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true)
      localStorage.setItem('purchase-admin-auth', password)
      setShowLoginModal(false)
      setPassword('')
    } else {
      alert('비밀번호가 올바르지 않습니다.')
    }
  }

  const handleLogout = () => {
    if (confirm('관리자 모드를 종료하시겠습니까?')) {
      setIsAdmin(false)
      localStorage.removeItem('purchase-admin-auth')
      setShowForm(false)
      setEditingItem(null)
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
      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            구매물품목록
            {isAdmin && (
              <span className="ml-3 text-sm px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
                관리자 모드
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            총 {filteredItems.length}개
          </p>
          {/* 활성 필터 표시 */}
          {(searchTerm || selectedCategory) && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">필터 적용됨:</span>
              {searchTerm && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  검색: {searchTerm}
                </span>
              )}
              {selectedCategory && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  카테고리: {selectedCategory}
                </span>
              )}
              <button
                onClick={clearFilters}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
              >
                필터 초기화
              </button>
            </div>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
          >
            + 새 물품 추가
          </button>
        )}
      </div>

      {/* 검색바 */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="물품명, 구입처, 카테고리로 검색..."
          style={{ WebkitAppearance: 'none', appearance: 'none' }}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 추가 폼 (편집이 아닐 때만 검색창 아래 표시) */}
      {showForm && !editingItem && (
        <div className="animate-fade-in">
          <PurchaseItemForm
            item={null}
            onSubmit={handleAddItem}
            onCancel={handleCancel}
          />
        </div>
      )}

      {/* 물품 목록 테이블 */}
      <PurchaseItemTable
        items={filteredItems}
        onEdit={handleEdit}
        onDelete={handleDeleteItem}
        onCategoryFilter={handleCategoryFilter}
        selectedCategory={selectedCategory}
        editingItem={editingItem}
        onEditSubmit={(data) => handleEditItem(editingItem!.id, data)}
        onEditCancel={handleCancel}
        isAdmin={isAdmin}
      />

      {/* 관리자 로그인/로그아웃 버튼 (우측 하단) */}
      <div className="fixed bottom-6 right-6 z-50">
        {isAdmin ? (
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-300"
          >
            관리자 로그아웃
          </button>
        ) : (
          <button
            onClick={() => setShowLoginModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-300"
          >
            🔒 관리자 로그인
          </button>
        )}
      </div>

      {/* 관리자 로그인 모달 */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-[400px] max-w-[90vw] shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              관리자 로그인
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              물품을 추가/수정/삭제하려면 관리자 비밀번호를 입력하세요.
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="비밀번호를 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleLogin}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
              >
                로그인
              </button>
              <button
                onClick={() => {
                  setShowLoginModal(false)
                  setPassword('')
                }}
                className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors duration-200"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
