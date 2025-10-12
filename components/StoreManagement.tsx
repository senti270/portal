'use client'

import { useState, useEffect } from 'react'
import { Store, StoreFormData } from '@/types/manual'
import { getStores, addStore, updateStore, deleteStore } from '@/lib/manual-firestore'

interface StoreManagementProps {
  password: string
}

export default function StoreManagement({ password }: StoreManagementProps) {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingStore, setEditingStore] = useState<Store | null>(null)
  const [formData, setFormData] = useState<StoreFormData>({ name: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadStores()
  }, [])

  const loadStores = async () => {
    try {
      setLoading(true)
      const storesData = await getStores()
      setStores(storesData)
    } catch (error) {
      console.error('지점 목록 로드 실패:', error)
      alert('지점 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      alert('지점명을 입력해주세요.')
      return
    }

    // 중복 체크
    const isDuplicate = stores.some(store => 
      store.name.toLowerCase() === formData.name.toLowerCase() &&
      store.id !== editingStore?.id
    )
    
    if (isDuplicate) {
      alert('이미 존재하는 지점명입니다.')
      return
    }

    try {
      setIsSubmitting(true)
      
      if (editingStore) {
        await updateStore(editingStore.id, formData)
        alert('지점이 수정되었습니다.')
      } else {
        await addStore(formData)
        alert('지점이 추가되었습니다.')
      }
      
      await loadStores()
      resetForm()
    } catch (error) {
      console.error('지점 저장 실패:', error)
      alert('지점 저장에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (store: Store) => {
    setEditingStore(store)
    setFormData({ name: store.name })
    setShowAddForm(true)
  }

  const handleDelete = async (store: Store) => {
    if (store.id === 'all') {
      alert('전지점은 삭제할 수 없습니다.')
      return
    }

    if (!confirm(`"${store.name}" 지점을 삭제하시겠습니까?\n\n주의: 해당 지점을 사용하는 매뉴얼이 있으면 삭제할 수 없습니다.`)) {
      return
    }

    try {
      await deleteStore(store.id)
      alert('지점이 삭제되었습니다.')
      await loadStores()
    } catch (error: any) {
      console.error('지점 삭제 실패:', error)
      alert(error.message || '지점 삭제에 실패했습니다.')
    }
  }

  const resetForm = () => {
    setFormData({ name: '' })
    setEditingStore(null)
    setShowAddForm(false)
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          지점 관리
        </h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          지점 추가
        </button>
      </div>

      {/* 지점 목록 */}
      <div className="space-y-3 mb-6">
        {stores.map((store) => (
          <div
            key={store.id}
            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
          >
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                {store.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                생성일: {store.createdAt.toLocaleDateString()}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handleEdit(store)}
                className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
              >
                수정
              </button>
              {store.id !== 'all' && (
                <button
                  onClick={() => handleDelete(store)}
                  className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 지점 추가/수정 폼 */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {editingStore ? '지점 수정' : '지점 추가'}
            </h3>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  지점명
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="지점명을 입력하세요"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '저장 중...' : editingStore ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
