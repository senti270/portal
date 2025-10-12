'use client'

import { useState, useEffect } from 'react'
import { Manual, Store, ManualFormData } from '@/types/manual'
import { getManuals, addManual, updateManual, deleteManual, getStores } from '@/lib/manual-firestore'
import ManualList from './ManualList'
import ManualEditor from './ManualEditor'
import StoreManagement from './StoreManagement'

const ADMIN_PASSWORD = '43084308'

export default function ManualManager() {
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [manuals, setManuals] = useState<Manual[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [showStoreManagement, setShowStoreManagement] = useState(false)
  const [editingManual, setEditingManual] = useState<Manual | null>(null)
  const [activeTab, setActiveTab] = useState<'manuals' | 'stores'>('manuals')

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

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
    } else {
      alert('비밀번호가 틀렸습니다.')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setPassword('')
    setShowEditor(false)
    setShowStoreManagement(false)
    setEditingManual(null)
    setActiveTab('manuals')
  }

  const handleAddManual = () => {
    setEditingManual(null)
    setShowEditor(true)
  }

  const handleEditManual = (manual: Manual) => {
    setEditingManual(manual)
    setShowEditor(true)
  }

  const handleDeleteManual = async (manual: Manual) => {
    if (!confirm(`"${manual.title}" 매뉴얼을 삭제하시겠습니까?`)) {
      return
    }

    try {
      await deleteManual(manual.id)
      alert('매뉴얼이 삭제되었습니다.')
      await loadData()
    } catch (error) {
      console.error('매뉴얼 삭제 실패:', error)
      alert('매뉴얼 삭제에 실패했습니다.')
    }
  }

  const handleSubmitManual = async (data: ManualFormData) => {
    try {
      if (editingManual) {
        await updateManual(editingManual.id, data)
        alert('매뉴얼이 수정되었습니다.')
      } else {
        await addManual(data, 'admin') // 실제로는 사용자 정보를 사용
        alert('매뉴얼이 추가되었습니다.')
      }
      
      await loadData()
      setShowEditor(false)
      setEditingManual(null)
    } catch (error) {
      console.error('매뉴얼 저장 실패:', error)
      alert('매뉴얼 저장에 실패했습니다.')
    }
  }

  const handleCancelEditor = () => {
    setShowEditor(false)
    setEditingManual(null)
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          매뉴얼 관리 시스템
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          접근하려면 비밀번호를 입력하세요.
        </p>
        <input
          type="password"
          className="w-full max-w-xs px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white mb-4"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleLogin()
            }
          }}
        />
        <button
          onClick={handleLogin}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          로그인
        </button>
      </div>
    )
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

  if (showEditor) {
    return (
      <ManualEditor
        initialData={editingManual ? {
          title: editingManual.title,
          content: editingManual.content,
          storeTags: editingManual.storeTags
        } : undefined}
        onSubmit={handleSubmitManual}
        onCancel={handleCancelEditor}
        stores={stores}
      />
    )
  }

  if (showStoreManagement) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            지점 관리
          </h2>
          <button
            onClick={() => setShowStoreManagement(false)}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            매뉴얼 목록으로
          </button>
        </div>
        <StoreManagement password={password} />
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          매뉴얼 관리 시스템
        </h2>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
        >
          로그아웃
        </button>
      </div>

      {/* 탭 */}
      <div className="flex space-x-1 mb-6">
        <button
          onClick={() => setActiveTab('manuals')}
          className={`px-4 py-2 rounded-md transition-colors ${
            activeTab === 'manuals'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
          }`}
        >
          매뉴얼 관리
        </button>
        <button
          onClick={() => setActiveTab('stores')}
          className={`px-4 py-2 rounded-md transition-colors ${
            activeTab === 'stores'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
          }`}
        >
          지점 관리
        </button>
      </div>

      {/* 매뉴얼 관리 탭 */}
      {activeTab === 'manuals' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              매뉴얼 목록
            </h3>
            <button
              onClick={handleAddManual}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              매뉴얼 추가
            </button>
          </div>
          
          <ManualList
            manuals={manuals}
            stores={stores}
            onEdit={handleEditManual}
            onDelete={handleDeleteManual}
            isAdmin={true}
          />
        </>
      )}

      {/* 지점 관리 탭 */}
      {activeTab === 'stores' && (
        <StoreManagement password={password} />
      )}
    </div>
  )
}
