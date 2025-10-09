'use client'

import { useState } from 'react'
import { useAdmin } from '@/contexts/AdminContext'
import { System, systems } from '@/data/systems'

const ICONS = ['📅', '👥', '🛒', '📊', '💼', '📈', '🔧', '📝', '🎯', '⚙️', '📱', '💻', '🌐', '📋', '🏪']

export default function AdminPanel() {
  const { isAdmin, logout } = useAdmin()
  const [systemsList, setSystemsList] = useState<System[]>(systems)
  const [editingSystem, setEditingSystem] = useState<System | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  if (!isAdmin) return null

  const handleEdit = (system: System) => {
    setEditingSystem({ ...system })
    setShowAddForm(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      setSystemsList(systemsList.filter(s => s.id !== id))
    }
  }

  const handleSave = (system: System) => {
    if (editingSystem) {
      // 편집 모드
      setSystemsList(systemsList.map(s => s.id === system.id ? system : s))
    } else {
      // 추가 모드
      setSystemsList([...systemsList, { ...system, id: `system-${Date.now()}` }])
    }
    setShowAddForm(false)
    setEditingSystem(null)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingSystem(null)
  }

  return (
    <>
      {/* 관리자 패널 */}
      <div className="fixed bottom-6 left-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-300 z-50">
        <button onClick={logout}>
          관리자 로그아웃
        </button>
      </div>

      {/* 시스템 관리 버튼 */}
      <div className="fixed bottom-6 right-20 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-300 z-50">
        <button onClick={() => setShowAddForm(true)}>
          시스템 추가
        </button>
      </div>

      {/* 시스템 목록 */}
      <div className="fixed top-20 left-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 w-96 max-h-[80vh] overflow-y-auto z-40">
        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
          시스템 관리
        </h3>
        <div className="space-y-2">
          {systemsList.map((system) => (
            <div key={system.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  {system.icon} {system.title}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(system)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    편집
                  </button>
                  <button
                    onClick={() => handleDelete(system.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    삭제
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {system.description}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {system.category} • {system.status}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 시스템 추가/편집 폼 */}
      {showAddForm && (
        <SystemForm
          system={editingSystem}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </>
  )
}

function SystemForm({ system, onSave, onCancel }: {
  system: System | null
  onSave: (system: System) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState<Partial<System>>({
    title: system?.title || '',
    description: system?.description || '',
    icon: system?.icon || '📅',
    color: system?.color || '#3B82F6',
    category: system?.category || '업무관리',
    url: system?.url || '',
    status: system?.status || 'active',
    tags: system?.tags || [],
    optimization: system?.optimization || [],
  })

  const [newTag, setNewTag] = useState('')
  const [newOptimization, setNewOptimization] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.title && formData.description && formData.category && formData.icon && formData.color && formData.status) {
      onSave({
        id: system?.id || `system-${Date.now()}`,
        title: formData.title,
        description: formData.description,
        icon: formData.icon,
        color: formData.color,
        category: formData.category,
        url: formData.url || '',
        status: formData.status as 'active' | 'inactive' | 'maintenance',
        tags: formData.tags,
        optimization: formData.optimization,
      })
    }
  }

  const addTag = () => {
    if (newTag && !formData.tags?.includes(newTag)) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), newTag]
      })
      setNewTag('')
    }
  }

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter(t => t !== tag)
    })
  }

  const addOptimization = () => {
    if (newOptimization && !formData.optimization?.includes(newOptimization)) {
      setFormData({
        ...formData,
        optimization: [...(formData.optimization || []), newOptimization]
      })
      setNewOptimization('')
    }
  }

  const removeOptimization = (opt: string) => {
    setFormData({
      ...formData,
      optimization: formData.optimization?.filter(o => o !== opt)
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-hidden">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-[600px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          {system ? '시스템 편집' : '시스템 추가'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 시스템 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              시스템 이름
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              설명
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={3}
              required
            />
          </div>

          {/* 아이콘 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              아이콘
            </label>
            <div className="grid grid-cols-8 gap-2 mb-2">
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormData({ ...formData, icon })}
                  className={`p-2 text-2xl border rounded-lg ${
                    formData.icon === icon 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              카테고리
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              URL
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="https://example.com"
            />
          </div>

          {/* 상태 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              상태
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' | 'maintenance' })}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
              <option value="maintenance">점검중</option>
            </select>
          </div>

          {/* 태그 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              태그
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="태그 입력"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                추가
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags?.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-md text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* 최적화 환경 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              최적화 환경
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newOptimization}
                onChange={(e) => setNewOptimization(e.target.value)}
                className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="예: PC 최적화"
              />
              <button
                type="button"
                onClick={addOptimization}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                추가
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.optimization?.map((opt, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-md text-sm"
                >
                  {opt}
                  <button
                    type="button"
                    onClick={() => removeOptimization(opt)}
                    className="text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              {system ? '수정' : '추가'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg transition-colors"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
