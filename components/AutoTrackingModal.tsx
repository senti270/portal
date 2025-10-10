'use client'

import { useState } from 'react'

interface AutoTrackingModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (time: { hour: string; minute: string }) => void
  isActive: boolean
  onToggleActive: () => void
}

export default function AutoTrackingModal({ 
  isOpen, 
  onClose, 
  onSave, 
  isActive, 
  onToggleActive 
}: AutoTrackingModalProps) {
  const [hour, setHour] = useState('17')
  const [minute, setMinute] = useState('15')

  if (!isOpen) return null

  const handleSave = () => {
    onSave({ hour, minute })
    onClose()
  }

  const handleStop = () => {
    onToggleActive()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-hidden">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-[500px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
        {/* 닫기 버튼 */}
        <div className="flex justify-end mb-4">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          자동 순위추적 편집
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          매일 설정한 시간에 순위가 자동으로 추적됩니다.
        </p>

        <div className="space-y-6">
          {/* 시간 설정 */}
          <div>
            <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-4">
              추적 시간 설정
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  시*
                </label>
                <div className="relative">
                  <select 
                    value={hour}
                    onChange={(e) => setHour(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i.toString().padStart(2, '0')}>
                        {i}시
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  분*
                </label>
                <div className="relative">
                  <select 
                    value={minute}
                    onChange={(e) => setMinute(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none"
                  >
                    {[0, 15, 30, 45].map(m => (
                      <option key={m} value={m.toString().padStart(2, '0')}>
                        {m}분
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 상태 정보 */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                현재 상태:
              </span>
              <span className={`text-sm font-medium ${
                isActive 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {isActive ? '자동추적 활성화' : '자동추적 비활성화'}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              {isActive 
                ? '매일 설정된 시간에 자동으로 순위를 추적합니다.'
                : '자동추적이 중지되었습니다. 저장 버튼을 눌러 다시 활성화하세요.'
              }
            </p>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
          {isActive && (
            <button
              onClick={handleStop}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              중지
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
