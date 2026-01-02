'use client'

import { useState, useEffect } from 'react'
import { SystemLogin, SystemLoginFormData } from '@/types/system-login'
import { Store } from '@/types/manual'
import { getStores } from '@/lib/manual-firestore'
import {
  getSystemLogins,
  getSystemLoginsByStoreAndSystem,
  addSystemLogin,
  updateSystemLogin,
  deleteSystemLogin
} from '@/lib/system-login-firestore'

// 기본 시스템 목록
const DEFAULT_SYSTEMS = [
  '주차관리',
  '배달의민족',
  '쿠팡이츠',
  '요기요',
  '포스기',
  '카드단말기',
  '인터넷',
  '전화',
  '기타'
]

export default function SystemLoginManager() {
  const [stores, setStores] = useState<Store[]>([])
  const [systems, setSystems] = useState<string[]>(DEFAULT_SYSTEMS)
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [selectedSystem, setSelectedSystem] = useState<string>('')
  const [logins, setLogins] = useState<SystemLogin[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingLogin, setEditingLogin] = useState<SystemLogin | null>(null)
  const [formData, setFormData] = useState<SystemLoginFormData>({
    storeId: '',
    systemName: '',
    username: '',
    password: '',
    note: ''
  })
  const [newSystemName, setNewSystemName] = useState('')
  const [showPassword, setShowPassword] = useState<{ [key: string]: boolean }>({})

  useEffect(() => {
    loadStores()
  }, [])

  useEffect(() => {
    if (selectedStoreId && selectedSystem) {
      loadLogins()
    } else {
      setLogins([])
    }
  }, [selectedStoreId, selectedSystem])

  const loadStores = async () => {
    try {
      const storesData = await getStores()
      setStores(storesData)
      if (storesData.length > 0) {
        setSelectedStoreId(storesData[0].id)
      }
    } catch (error) {
      console.error('지점 목록 로드 실패:', error)
      alert('지점 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadLogins = async () => {
    try {
      setLoading(true)
      const loginsData = await getSystemLoginsByStoreAndSystem(
        selectedStoreId,
        selectedSystem
      )
      setLogins(loginsData)
    } catch (error) {
      console.error('시스템 로그인 정보 로드 실패:', error)
      alert('시스템 로그인 정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.storeId || !formData.systemName || !formData.username || !formData.password) {
      alert('필수 항목을 모두 입력해주세요.')
      return
    }

    try {
      const selectedStore = stores.find(s => s.id === formData.storeId)
      if (!selectedStore) {
        alert('지점을 선택해주세요.')
        return
      }

      if (editingLogin) {
        await updateSystemLogin(editingLogin.id, formData, selectedStore.name)
        alert('시스템 로그인 정보가 수정되었습니다.')
      } else {
        await addSystemLogin(formData, selectedStore.name)
        alert('시스템 로그인 정보가 추가되었습니다.')
      }

      await loadLogins()
      resetForm()
    } catch (error) {
      console.error('시스템 로그인 정보 저장 실패:', error)
      alert('시스템 로그인 정보 저장에 실패했습니다.')
    }
  }

  const handleEdit = (login: SystemLogin) => {
    setEditingLogin(login)
    setFormData({
      storeId: login.storeId,
      systemName: login.systemName,
      username: login.username,
      password: login.password,
      note: login.note || ''
    })
    setShowAddForm(true)
  }

  const handleDelete = async (login: SystemLogin) => {
    if (!confirm(`"${login.systemName}" 시스템 로그인 정보를 삭제하시겠습니까?`)) {
      return
    }

    try {
      await deleteSystemLogin(login.id)
      alert('시스템 로그인 정보가 삭제되었습니다.')
      await loadLogins()
    } catch (error) {
      console.error('시스템 로그인 정보 삭제 실패:', error)
      alert('시스템 로그인 정보 삭제에 실패했습니다.')
    }
  }

  const resetForm = () => {
    setFormData({
      storeId: selectedStoreId,
      systemName: selectedSystem,
      username: '',
      password: '',
      note: ''
    })
    setEditingLogin(null)
    setShowAddForm(false)
  }

  const handleAddSystem = () => {
    if (newSystemName.trim() && !systems.includes(newSystemName.trim())) {
      setSystems([...systems, newSystemName.trim()])
      setNewSystemName('')
    }
  }

  const togglePasswordVisibility = (loginId: string) => {
    setShowPassword(prev => ({
      ...prev,
      [loginId]: !prev[loginId]
    }))
  }

  if (loading && stores.length === 0) {
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
          시스템 로그인 정보
        </h2>
        {selectedStoreId && selectedSystem && (
          <button
            onClick={() => {
              setFormData({
                storeId: selectedStoreId,
                systemName: selectedSystem,
                username: '',
                password: '',
                note: ''
              })
              setShowAddForm(true)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            추가
          </button>
        )}
      </div>

      {/* 필터 영역 */}
      <div className="mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 지점 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              지점 선택
            </label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">지점을 선택하세요</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>

          {/* 시스템 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              시스템 선택
            </label>
            <div className="flex gap-2">
              <select
                value={selectedSystem}
                onChange={(e) => setSelectedSystem(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">시스템을 선택하세요</option>
                {systems.map((system) => (
                  <option key={system} value={system}>
                    {system}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSystemName}
                  onChange={(e) => setNewSystemName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddSystem()
                    }
                  }}
                  placeholder="새 시스템"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white w-32"
                />
                <button
                  onClick={handleAddSystem}
                  className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 카드 형태로 표시 */}
      {selectedStoreId && selectedSystem ? (
        loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600 dark:text-gray-300">로딩 중...</span>
          </div>
        ) : logins.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {logins.map((login) => (
              <div
                key={login.id}
                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                      {login.systemName}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {login.storeName}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(login)}
                      className="px-2 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(login)}
                      className="px-2 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      아이디:
                    </span>
                    <p className="text-sm text-gray-900 dark:text-white mt-1">
                      {login.username}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      비밀번호:
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-gray-900 dark:text-white flex-1">
                        {showPassword[login.id] ? login.password : '••••••••'}
                      </p>
                      <button
                        onClick={() => togglePasswordVisibility(login.id)}
                        className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                      >
                        {showPassword[login.id] ? '숨기기' : '보기'}
                      </button>
                    </div>
                  </div>
                  {login.note && (
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        비고:
                      </span>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">
                        {login.note}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>등록된 로그인 정보가 없습니다.</p>
            <p className="text-sm mt-2">"추가" 버튼을 클릭하여 로그인 정보를 추가해주세요.</p>
          </div>
        )
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>지점과 시스템을 선택해주세요.</p>
        </div>
      )}

      {/* 추가/수정 폼 모달 */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {editingLogin ? '시스템 로그인 정보 수정' : '시스템 로그인 정보 추가'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    지점
                  </label>
                  <select
                    value={formData.storeId}
                    onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">지점을 선택하세요</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    시스템명
                  </label>
                  <select
                    value={formData.systemName}
                    onChange={(e) => setFormData({ ...formData, systemName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">시스템을 선택하세요</option>
                    {systems.map((system) => (
                      <option key={system} value={system}>
                        {system}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    아이디
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    비밀번호
                  </label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    비고
                  </label>
                  <textarea
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {editingLogin ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

