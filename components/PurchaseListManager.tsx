'use client'

import { useState, useEffect } from 'react'
import { PurchaseItem, PurchaseItemFormData } from '@/types/purchase'
import { getPurchaseItems, addPurchaseItem, updatePurchaseItem, deletePurchaseItem } from '@/lib/purchase-firestore'
import PurchaseItemTable from './PurchaseItemTable'
import PurchaseItemForm from './PurchaseItemForm'

export default function PurchaseListManager() {
  const [items, setItems] = useState<PurchaseItem[]>([])
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
    } catch (error) {
      console.error('Error loading items:', error)
      setError('물품 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
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
            구매물품 목록 ({items.length}개)
          </h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
        >
          + 새 물품 추가
        </button>
      </div>

      {/* 물품 목록 테이블 */}
      <PurchaseItemTable
        items={items}
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
