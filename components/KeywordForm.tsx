'use client'

import { useState, useEffect } from 'react'
import { Keyword, RankingFormData } from '@/types/ranking'

interface KeywordFormProps {
  keyword?: Keyword | null
  onSubmit: (data: RankingFormData) => void
  onCancel: () => void
}

export default function KeywordForm({ keyword, onSubmit, onCancel }: KeywordFormProps) {
  const [formData, setFormData] = useState<RankingFormData>({
    keyword: '',
    monthlySearchVolume: 0,
    mobileVolume: 0,
    pcVolume: 0
  })

  useEffect(() => {
    if (keyword) {
      setFormData({
        keyword: keyword.keyword,
        monthlySearchVolume: keyword.monthlySearchVolume,
        mobileVolume: keyword.mobileVolume,
        pcVolume: keyword.pcVolume
      })
    }
  }, [keyword])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('Volume') ? parseInt(value) || 0 : value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.keyword || formData.monthlySearchVolume === 0) {
      alert('키워드와 월 검색량을 입력해주세요.')
      return
    }
    onSubmit(formData)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        {keyword ? '키워드 편집' : '새 키워드 추가'}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 키워드 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            키워드 *
          </label>
          <input
            type="text"
            name="keyword"
            value={formData.keyword}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            placeholder="예: 동탄장어"
            required
          />
        </div>

        {/* 월 검색량 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            월 검색량 *
          </label>
          <input
            type="number"
            name="monthlySearchVolume"
            value={formData.monthlySearchVolume}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            placeholder="예: 2200"
            min="0"
            required
          />
        </div>

        {/* 모바일/PC 검색량 분리 입력 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              모바일 검색량
            </label>
            <input
              type="number"
              name="mobileVolume"
              value={formData.mobileVolume}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="예: 1940"
              min="0"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              PC 검색량
            </label>
            <input
              type="number"
              name="pcVolume"
              value={formData.pcVolume}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="예: 260"
              min="0"
            />
          </div>
        </div>

        {/* 검색량 합계 표시 */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              총 검색량:
            </span>
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {formData.monthlySearchVolume.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span>모바일: {formData.mobileVolume.toLocaleString()}</span>
            <span>PC: {formData.pcVolume.toLocaleString()}</span>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {keyword ? '수정' : '추가'}
          </button>
        </div>
      </form>
    </div>
  )
}
