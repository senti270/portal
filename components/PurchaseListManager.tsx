'use client'

import { useState, useEffect } from 'react'
import { PurchaseItem, PurchaseItemFormData } from '@/types/purchase'
import { getPurchaseItems, addPurchaseItem, updatePurchaseItem, deletePurchaseItem } from '@/lib/purchase-firestore'
import PurchaseItemTable from './PurchaseItemTable'
import PurchaseItemForm from './PurchaseItemForm'

export default function PurchaseListManager() {
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [filteredItems, setFilteredItems] = useState<PurchaseItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<PurchaseItem | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  // 검색 필터링
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredItems(items)
    } else {
      const filtered = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.purchaseSource.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.some(cat => cat.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.purchaseUnit && item.purchaseUnit.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      setFilteredItems(filtered)
    }
  }, [searchTerm, items])

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
            구매물품 목록 ({filteredItems.length}개)
          </h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
        >
          + 새 물품 추가
        </button>
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
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
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

      {/* 물품 목록 테이블 */}
      <PurchaseItemTable
        items={filteredItems}
        onEdit={handleEdit}
        onDelete={handleDeleteItem}
      />

      {/* 추가/편집 폼 */}
      {(showForm || editingItem) && (
        <PurchaseItemForm
          item={editingItem}
          onSubmit={editingItem ? (data) => handleEditItem(editingItem.id, data) : handleAddItem}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}
