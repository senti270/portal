'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { Keyword } from '@/types/ranking'

interface KeywordFormProps {
  keywords: Keyword[]
  onSave: (keywords: Keyword[]) => void
  onCancel: () => void
}

export default function KeywordForm({ keywords, onSave, onCancel }: KeywordFormProps) {
  const [keywordList, setKeywordList] = useState<Keyword[]>(keywords)
  const [newKeywords, setNewKeywords] = useState('')

  useEffect(() => {
    setKeywordList(keywords)
  }, [keywords])

  const handleAddKeywords = () => {
    if (!newKeywords.trim()) return
    
    const keywordArray = newKeywords.split(',').map(k => k.trim()).filter(k => k)
    
    const newKeywordObjects: Keyword[] = keywordArray.map((keyword, index) => ({
      id: `keyword-${Date.now()}-${index}`,
      keyword,
      monthlySearchVolume: 0,
      mobileVolume: 0,
      pcVolume: 0,
      storeId: 'store1', // 임시
      isActive: true
    }))
    
    setKeywordList([...keywordList, ...newKeywordObjects])
    setNewKeywords('')
  }

  const handleDeleteKeyword = (id: string) => {
    setKeywordList(keywordList.filter(k => k.id !== id))
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const items = Array.from(keywordList)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setKeywordList(items)
  }

  const handleSave = () => {
    onSave(keywordList)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-hidden">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-[600px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            키워드 관리
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        {/* 안내 문구 */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          키워드를 추가 후, 순서를 변경할 수 있습니다.
        </p>

        <div className="space-y-6">
          {/* 키워드 직접 추가 */}
          <div>
            <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
              키워드 직접 추가
            </h4>
            <div className="flex gap-3">
              <input
                type="text"
                value={newKeywords}
                onChange={(e) => setNewKeywords(e.target.value)}
                placeholder="키워드를 콤마(,)로 구분하여 최대 20글자까지 입력"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                maxLength={20}
              />
              <button
                onClick={handleAddKeywords}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                추가
              </button>
            </div>
          </div>

          {/* 키워드 순서 변경 */}
          <div>
            <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
              키워드 순서 변경
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              키워드를 드래그 앤 드롭하여 순서를 변경하세요.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              상위 3개의 키워드는 전체 목록에서도 검색량과 순위를 쉽게 확인하실 수 있습니다.
            </p>

            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="keywords">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-3"
                  >
                    {keywordList.map((keyword, index) => (
                      <Draggable key={keyword.id} draggableId={keyword.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg transition-all ${
                              snapshot.isDragging ? 'shadow-lg' : ''
                            }`}
                          >
                            {/* 드래그 핸들 */}
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                            >
                              ⋮⋮
                            </div>

                            {/* 키워드 정보 */}
                            <div className="flex-1 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {keyword.keyword}
                                </span>
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-bold">{keyword.monthlySearchVolume.toLocaleString()}</span>
                                  <span>|</span>
                                  <span>📱 {keyword.mobileVolume.toLocaleString()}</span>
                                  <span>|</span>
                                  <span>💻 {keyword.pcVolume.toLocaleString()}</span>
                                </div>
                              </div>
                              
                              {/* 표시 상태 */}
                              {index < 3 && (
                                <span className="text-xs text-blue-600 dark:text-blue-400">
                                  전체 상품 목록에 표시됨
                                </span>
                              )}
                            </div>

                            {/* 삭제 버튼 */}
                            <button
                              onClick={() => handleDeleteKeyword(keyword.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              ✕
                            </button>
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
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
