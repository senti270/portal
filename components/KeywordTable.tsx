'use client'

import { Keyword } from '@/types/ranking'

interface KeywordTableProps {
  keywords: Keyword[]
  onEdit: (keyword: Keyword) => void
  onDelete: (id: string) => void
  onToggleActive: (id: string) => void
}

export default function KeywordTable({ keywords, onEdit, onDelete, onToggleActive }: KeywordTableProps) {
  if (keywords.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div className="text-gray-400 text-4xl mb-4">🔍</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          등록된 키워드가 없습니다
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          "키워드 관리" 버튼을 클릭하여 첫 번째 키워드를 추가해보세요.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      {/* 데스크톱 테이블 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                키워드
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                월 검색량
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                모바일
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                PC
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                상태
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                관리
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {keywords.map((keyword) => (
              <tr key={keyword.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                {/* 키워드 */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {keyword.keyword}
                  </div>
                </td>
                
                {/* 월 검색량 */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {keyword.monthlySearchVolume.toLocaleString()}
                  </div>
                </td>
                
                {/* 모바일 검색량 */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {keyword.mobileVolume.toLocaleString()}
                  </div>
                </td>
                
                {/* PC 검색량 */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {keyword.pcVolume.toLocaleString()}
                  </div>
                </td>
                
                {/* 상태 */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => onToggleActive(keyword.id)}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      keyword.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {keyword.isActive ? '활성' : '비활성'}
                  </button>
                </td>
                
                {/* 관리 */}
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onEdit(keyword)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      편집
                    </button>
                    <button
                      onClick={() => onDelete(keyword.id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 뷰 */}
      <div className="md:hidden">
        <div className="space-y-4 p-4">
          {keywords.map((keyword) => (
            <div key={keyword.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
              {/* 키워드와 상태 */}
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {keyword.keyword}
                </h3>
                <button
                  onClick={() => onToggleActive(keyword.id)}
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                    keyword.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'
                  }`}
                >
                  {keyword.isActive ? '활성' : '비활성'}
                </button>
              </div>
              
              {/* 검색량 정보 */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">월 검색량</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {keyword.monthlySearchVolume.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">모바일</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {keyword.mobileVolume.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">PC</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {keyword.pcVolume.toLocaleString()}
                  </p>
                </div>
              </div>
              
              {/* 관리 버튼 */}
              <div className="flex space-x-2">
                <button
                  onClick={() => onEdit(keyword)}
                  className="flex-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm py-2 rounded bg-blue-50 dark:bg-blue-900/30"
                >
                  편집
                </button>
                <button
                  onClick={() => onDelete(keyword.id)}
                  className="flex-1 text-red-600 hover:text-red-800 dark:text-red-400 text-sm py-2 rounded bg-red-50 dark:bg-red-900/30"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}





