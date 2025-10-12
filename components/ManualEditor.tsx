'use client'

import { useState, useRef } from 'react'
import { ManualFormData } from '@/types/manual'

interface ManualEditorProps {
  initialData?: ManualFormData
  onSubmit: (data: ManualFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  stores: Array<{ id: string; name: string }>
}

export default function ManualEditor({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isLoading = false,
  stores 
}: ManualEditorProps) {
  const [formData, setFormData] = useState<ManualFormData>(
    initialData || { title: '', content: '', storeTags: [] }
  )
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      alert('제목을 입력해주세요.')
      return
    }
    
    if (!formData.content.trim()) {
      alert('내용을 입력해주세요.')
      return
    }
    
    if (formData.storeTags.length === 0) {
      alert('지점을 선택해주세요.')
      return
    }

    await onSubmit(formData)
  }

  const handleImageUpload = async (file: File) => {
    // 파일 타입 검증
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.')
      return false
    }

    // 파일 크기 제한 (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      alert('파일 크기는 5MB 이하여야 합니다.')
      return false
    }

    try {
      setIsUploading(true)
      
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/manuals/upload-image', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        // 에디터에 이미지 삽입
        const imageHtml = `<img src="${result.imageUrl}" alt="${result.fileName}" style="max-width: 100%; height: auto; margin: 10px 0;" />`
        const textarea = document.getElementById('manual-content') as HTMLTextAreaElement
        if (textarea) {
          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          const text = textarea.value
          const before = text.substring(0, start)
          const after = text.substring(end, text.length)
          const newText = before + imageHtml + after
          
          setFormData(prev => ({ ...prev, content: newText }))
          
          // 커서 위치 조정
          setTimeout(() => {
            textarea.focus()
            textarea.setSelectionRange(start + imageHtml.length, start + imageHtml.length)
          }, 0)
        }
        return true
      } else {
        alert(result.error || '이미지 업로드에 실패했습니다.')
        return false
      }
    } catch (error) {
      console.error('이미지 업로드 실패:', error)
      alert('이미지 업로드에 실패했습니다.')
      return false
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    await handleImageUpload(file)
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        
        const file = item.getAsFile()
        if (file) {
          const success = await handleImageUpload(file)
          if (success) {
            alert('이미지가 성공적으로 삽입되었습니다!')
          }
        }
        break
      }
    }
  }

  const handleStoreTagChange = (storeId: string) => {
    setFormData(prev => {
      const newStoreTags = prev.storeTags.includes(storeId)
        ? prev.storeTags.filter(id => id !== storeId)
        : [...prev.storeTags, storeId]
      
      return { ...prev, storeTags: newStoreTags }
    })
  }

  const insertFormatting = (before: string, after: string = '') => {
    const textarea = document.getElementById('manual-content') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = textarea.value.substring(start, end)
    const newText = before + selectedText + after
    
    const text = textarea.value
    const beforeText = text.substring(0, start)
    const afterText = text.substring(end, text.length)
    const finalText = beforeText + newText + afterText
    
    setFormData(prev => ({ ...prev, content: finalText }))
    
    // 커서 위치 조정
    setTimeout(() => {
      textarea.focus()
      const newStart = start + before.length
      const newEnd = newStart + selectedText.length
      textarea.setSelectionRange(newStart, newEnd)
    }, 0)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {initialData ? '매뉴얼 수정' : '매뉴얼 추가'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            제목 *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="매뉴얼 제목을 입력하세요"
            required
          />
        </div>

        {/* 지점 태그 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            지점 태그 * (복수 선택 가능)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {stores.map((store) => (
              <label key={store.id} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.storeTags.includes(store.id)}
                  onChange={() => handleStoreTagChange(store.id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {store.name}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* 내용 에디터 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            내용 *
          </label>
          
          {/* 툴바 */}
          <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
            <button
              type="button"
              onClick={() => insertFormatting('<strong>', '</strong>')}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('<em>', '</em>')}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              <em>I</em>
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('<u>', '</u>')}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              <u>U</u>
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('<br/>')}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              줄바꿈
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('<div style="background-color: #f0f0f0; padding: 10px; border-radius: 5px; margin: 10px 0;">', '</div>')}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              박스
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {isUploading ? '업로드 중...' : '이미지'}
            </button>
          </div>

          <textarea
            id="manual-content"
            value={formData.content}
            onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
            onPaste={handlePaste}
            className="w-full h-96 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
            placeholder="매뉴얼 내용을 입력하세요. HTML 태그를 사용할 수 있습니다. 이미지를 붙여넣기(Ctrl+V)할 수도 있습니다."
            required
          />
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
          
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            💡 HTML 태그를 사용할 수 있습니다. 이미지 버튼을 클릭하거나 Ctrl+V로 이미지를 붙여넣기할 수 있습니다.
          </p>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
            disabled={isLoading}
          >
            취소
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? '저장 중...' : initialData ? '수정' : '추가'}
          </button>
        </div>
      </form>
    </div>
  )
}
