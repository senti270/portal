'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { useAdmin } from '@/contexts/AdminContext'
import { usePermissions } from '@/contexts/PermissionContext'
import { System, systems } from '@/data/systems'
import { getSystems, updateAllSystems, deleteSystem as deleteSystemFromFirestore } from '@/lib/firestore'

const ICONS = [
  '📅', '👥', '🛒', '📊', '💼', '📈', '🔧', '📝', '🎯', '⚙️', 
  '📱', '💻', '🌐', '📋', '🏪', '💰', '📦', '🚀', '🎨', '🔍',
  '📞', '📧', '🏠', '🏢', '🏪', '🏬', '🏭', '🏛️', '🏗️', '🏘️',
  '🎪', '🎭', '🎨', '🎬', '🎵', '🎤', '🎧', '🎮', '🎯', '🎲',
  '🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥙', '🍜', '🍝',
  '☕', '🍵', '🥤', '🍺', '🍻', '🍷', '🍸', '🍹', '🍾', '🥂',
  '🚗', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚',
  '✈️', '🚁', '🚀', '🛸', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇',
  '⭐', '🌟', '💫', '✨', '🔥', '💥', '💢', '💦', '💨', '💫',
  '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️'
]

interface AdminPanelProps {
  systemsList: System[]
  onSystemsUpdate: (systems: System[]) => void
}

export default function AdminPanel({ systemsList: propSystemsList, onSystemsUpdate }: AdminPanelProps) {
  const { isAdmin, logout } = useAdmin()
  const { isMaster } = usePermissions()
  const [systemsList, setSystemsList] = useState<System[]>(propSystemsList)
  const [editingSystem, setEditingSystem] = useState<System | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    // props에서 받은 systemsList로 초기화
    setSystemsList(propSystemsList)
  }, [propSystemsList])

  const loadSystems = async () => {
    try {
      const firestoreSystems = await getSystems()
      if (firestoreSystems.length > 0) {
        setSystemsList(firestoreSystems)
      } else {
        // Firestore가 비어있으면 기본 데이터 사용
        setSystemsList(systems)
      }
    } catch (error) {
      console.error('Error loading systems:', error)
      // 오류 시 로컬 스토리지에서 로드
      const savedSystems = localStorage.getItem('portal-systems')
      if (savedSystems) {
        const parsedSystems = JSON.parse(savedSystems)
        setSystemsList(parsedSystems)
      } else {
        setSystemsList(systems)
      }
    }
  }

  // 마스터 권한 또는 기존 관리자 로그인 상태여야 편집 가능
  if (!isMaster && !isAdmin) return null

  const handleEdit = (system: System) => {
    setEditingSystem({ ...system })
    setShowAddForm(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      try {
        // Firestore에서 삭제
        await deleteSystemFromFirestore(id)
        
        // 로컬 상태 업데이트
        const updatedSystems = systemsList.filter(s => s.id !== id)
        setSystemsList(updatedSystems)
        onSystemsUpdate(updatedSystems) // 부모 컴포넌트 상태도 업데이트

        // 로컬 스토리지에 백업
        localStorage.setItem('portal-systems', JSON.stringify(updatedSystems))

        alert('시스템이 성공적으로 삭제되었습니다!')
      } catch (error) {
        console.error('Delete error:', error)
        alert('삭제 중 오류가 발생했습니다. 다시 시도해주세요.')
      }
    }
  }

  const handleSave = async (system: System) => {
    let updatedSystems: System[]
    
    if (editingSystem) {
      // 편집 모드 - 기존 시스템의 모든 필드를 유지하면서 업데이트
      updatedSystems = systemsList.map(s => {
        if (s.id === system.id) {
          return {
            ...s, // 기존 시스템의 모든 필드 유지
            ...system, // 수정된 필드만 덮어쓰기
            id: s.id, // ID는 절대 변경하지 않음
            order: s.order, // order도 유지
            createdAt: s.createdAt, // 생성일 유지
            updatedAt: new Date() // 수정일만 업데이트
          }
        }
        return s
      })
    } else {
      // 추가 모드 - Firebase 호환 ID 생성
      const newId = `system-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      // 새 시스템의 order는 기존 시스템 개수로 설정 (맨 뒤에 추가)
      const newOrder = systemsList.length
      const now = new Date()
      updatedSystems = [...systemsList, { 
        ...system, 
        id: newId, 
        order: newOrder,
        createdAt: now,
        updatedAt: now
      }]
    }
    
    setSystemsList(updatedSystems)
    onSystemsUpdate(updatedSystems) // 부모 컴포넌트 상태도 업데이트

    try {
      // Firestore에 개별적으로 저장 (안전한 방식)
      if (editingSystem) {
        // 편집 모드: 해당 시스템만 업데이트
        const { updateDoc, doc } = await import('firebase/firestore')
        const { db } = await import('@/lib/firebase')
        const systemToUpdate = updatedSystems.find(s => s.id === editingSystem.id)
        if (systemToUpdate) {
          const systemRef = doc(db, 'systems', systemToUpdate.id)
          await updateDoc(systemRef, {
            title: systemToUpdate.title,
            description: systemToUpdate.description,
            icon: systemToUpdate.icon,
            color: systemToUpdate.color,
            category: systemToUpdate.category,
            url: systemToUpdate.url || '',
            status: systemToUpdate.status,
            tags: systemToUpdate.tags || [],
            optimization: systemToUpdate.optimization || [],
            order: systemToUpdate.order ?? 0,
            updatedAt: new Date()
          })
        }
      } else {
        // 추가 모드: updateAllSystems 사용
        await updateAllSystems(updatedSystems)
      }
      
      // 로컬 스토리지에 백업
      localStorage.setItem('portal-systems', JSON.stringify(updatedSystems))
      
      setShowAddForm(false)
      setEditingSystem(null)
      
      alert('시스템이 성공적으로 저장되었습니다!')
    } catch (error) {
      console.error('Save error:', error)
      alert('저장 중 오류가 발생했습니다. 다시 시도해주세요.')
      
      // 로컬 스토리지에만 저장 (오프라인 백업)
      localStorage.setItem('portal-systems', JSON.stringify(updatedSystems))
    }
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingSystem(null)
  }

  const fixSystemOrders = async () => {
    if (!confirm('모든 시스템의 order를 현재 순서대로 재설정하시겠습니까?')) {
      return
    }

    try {
      // 현재 systemsList를 순서대로 order 재부여
      const fixedSystems = systemsList.map((s, index) => ({
        ...s,
        order: index
      }))

      setSystemsList(fixedSystems)
      onSystemsUpdate(fixedSystems)

      // Firebase에 개별적으로 업데이트 (삭제 없이)
      const { updateDoc, doc } = await import('firebase/firestore')
      const { db } = await import('@/lib/firebase')
      
      for (const system of fixedSystems) {
        const systemRef = doc(db, 'systems', system.id)
        await updateDoc(systemRef, { 
          order: system.order,
          updatedAt: new Date()
        })
      }
      
      alert('✅ 모든 시스템의 order가 수정되었습니다!')
      console.log('Fixed systems:', fixedSystems.map(s => `${s.title}: order ${s.order}`))
    } catch (error) {
      console.error('Order 수정 오류:', error)
      alert('❌ Order 수정 중 오류가 발생했습니다.')
    }
  }

  // react-beautiful-dnd 핸들러
  const handleDragEnd = async (result: any) => {
    console.log('🔄 드래그 종료:', result)
    
    if (!result.destination) {
      console.log('❌ 드래그 목적지 없음')
      return
    }

    if (result.source.index === result.destination.index) {
      console.log('📍 같은 위치, 변경 없음')
      return
    }

    // 현재 정렬된 시스템 목록 가져오기 (order 기준 - 오름차순)
    const sortedSystems = [...systemsList].sort((a, b) => (a.order || 0) - (b.order || 0))
    console.log('📋 드래그 전 순서:', sortedSystems.map((s, i) => `${i}: ${s.title} (order: ${s.order})`))
    
    const items = Array.from(sortedSystems)
    
    // 간단한 배열 재정렬
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    console.log('📋 재정렬 후 순서:', items.map((s, i) => `${i}: ${s.title}`))

    // order 필드 업데이트 (정상 순서로 저장)
    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index // 정상 순서로 저장
    }))

    console.log('🔄 최종 업데이트된 순서:', updatedItems.map(s => `${s.title}: ${s.order}`))
    console.log('🔍 드래그 결과 상세:')
    console.log(`   - 소스 인덱스: ${result.source.index}`)
    console.log(`   - 목적지 인덱스: ${result.destination.index}`)
    console.log(`   - 드래그된 아이템: ${reorderedItem.title}`)
    console.log(`   - 최종 위치: ${result.destination.index}`)

    setSystemsList(updatedItems)
    onSystemsUpdate(updatedItems)

    try {
      await updateAllSystems(updatedItems)
      localStorage.setItem('portal-systems', JSON.stringify(updatedItems))
      console.log('✅ 순서 저장 완료')
    } catch (error) {
      console.error('❌ 순서 저장 오류:', error)
      alert('순서 저장 중 오류가 발생했습니다.')
    }
  }



  return (
    <>
      {/* 관리자 패널 버튼들 - 수직으로 배치 */}
      <div className="fixed bottom-6 left-6 flex flex-col gap-2 z-50">
        <button 
          onClick={logout}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-300"
        >
          관리자 로그아웃
        </button>
        <button 
          onClick={fixSystemOrders}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-300 text-sm"
        >
          🔧 Order 수정
        </button>
        <button 
          onClick={() => setShowAddForm(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-300"
        >
          시스템 추가
        </button>
      </div>

      {/* 시스템 목록 */}
      <div className="fixed top-20 left-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 w-96 max-h-[80vh] overflow-y-auto z-40">
        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
          시스템 관리
        </h3>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="systems-list">
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-2"
              >
                {systemsList
                  .sort((a, b) => (a.order || 0) - (b.order || 0)) // 오름차순 정렬
                  .map((system, index) => (
                  <Draggable key={system.id} draggableId={system.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`border rounded-lg p-3 transition-all duration-200 ${
                          snapshot.isDragging 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-lg' 
                            : 'border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1"
                              title="드래그하여 순서 변경"
                            >
                              ⋮⋮
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {system.icon} {system.title}
                            </span>
                          </div>
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
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
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
    order: system?.order || 0,
    tags: system?.tags || [],
    optimization: system?.optimization || [],
  })

  const [newTag, setNewTag] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.title && formData.description && formData.category && formData.icon && formData.color && formData.status) {
      const savedSystem: System = {
        id: system?.id || `system-${Date.now()}`,
        title: formData.title,
        description: formData.description,
        icon: formData.icon,
        color: formData.color,
        category: formData.category,
        url: formData.url || '',
        status: formData.status as 'active' | 'inactive' | 'maintenance',
        tags: formData.tags || [],
        optimization: formData.optimization || [],
        order: system?.order ?? 0, // 기존 order 유지 또는 0
        createdAt: system?.createdAt || new Date(),
        updatedAt: new Date()
      }
      onSave(savedSystem)
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

  const toggleOptimization = (opt: string) => {
    const currentOptimization = formData.optimization || []
    if (currentOptimization.includes(opt)) {
      setFormData({
        ...formData,
        optimization: currentOptimization.filter(o => o !== opt)
      })
    } else {
      setFormData({
        ...formData,
        optimization: [...currentOptimization, opt]
      })
    }
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
              type="text"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="/ranking-tracker 또는 https://example.com"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              최적화 환경
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.optimization?.includes('PC 최적화') || false}
                  onChange={() => toggleOptimization('PC 최적화')}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">PC 최적화</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.optimization?.includes('모바일 최적화') || false}
                  onChange={() => toggleOptimization('모바일 최적화')}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">모바일 최적화</span>
              </label>
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
