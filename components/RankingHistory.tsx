'use client'

import { RankingRecord, Keyword } from '@/types/ranking'

interface RankingHistoryProps {
  storeId: string
  keywords: Keyword[]
  rankings: RankingRecord[]
  onDeleteDate?: (date: string) => Promise<void>
}

export default function RankingHistory({ storeId, keywords, rankings, onDeleteDate }: RankingHistoryProps) {
  // 날짜 범위 생성 (최근 7일)
  const generateDateRange = () => {
    const dates = new Set<string>()
    const today = new Date()

    // Add today and past 6 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      dates.add(date.toISOString().split('T')[0])
    }

    // Add dates from existing rankings if they are outside the 7-day range
    rankings.forEach(r => dates.add(r.date));

    // Sort dates in descending order (most recent first)
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }

  const getRankingForDateAndKeyword = (date: string, keywordId: string) => {
    return rankings.find(r => r.date === date && r.keywordId === keywordId)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return `${date.getMonth() + 1}/${date.getDate()}(${days[date.getDay()]})`
  }

  const formatYear = (dateString: string) => {
    const date = new Date(dateString)
    return date.getFullYear()
  }

  const handleDeleteDate = async (date: string) => {
    if (!onDeleteDate) return
    
    if (confirm(`${formatDate(date)}의 순위 기록을 삭제하시겠습니까?`)) {
      await onDeleteDate(date)
    }
  }

  const dateRange = generateDateRange()

  // 키워드 순서대로 정렬
  const sortedKeywords = [...keywords].sort((a, b) => a.order - b.order);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          {/* 첫 번째 헤더 행: 키워드명 */}
          <tr>
            <th rowSpan={3} className="sticky left-0 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider z-10">
              날짜
            </th>
            {sortedKeywords.map((keyword) => (
              <th key={keyword.id} colSpan={3} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-l border-gray-200 dark:border-gray-700">
                {keyword.keyword}
              </th>
            ))}
          </tr>

          {/* 두 번째 헤더 행: 월 검색량 */}
          <tr>
            {sortedKeywords.map((keyword) => (
              <th key={`${keyword.id}-monthly`} colSpan={3} className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 border-l border-gray-200 dark:border-gray-700">
                월 검색량: {keyword.monthlySearchVolume.toLocaleString()}
              </th>
            ))}
          </tr>

          {/* 세 번째 헤더 행: 모바일/PC 검색량 */}
          <tr>
            {sortedKeywords.map((keyword) => (
              <>
                <th key={`${keyword.id}-mobile`} className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 border-l border-gray-200 dark:border-gray-700">
                  📱 {keyword.mobileVolume.toLocaleString()}
                </th>
                <th key={`${keyword.id}-pc`} className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300">
                  💻 {keyword.pcVolume.toLocaleString()}
                </th>
                <th key={`${keyword.id}-delete-header`} className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300">
                  🗑️
                </th>
              </>
            ))}
          </tr>
        </thead>

        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {sortedKeywords.length === 0 ? (
            <tr>
              <td colSpan={1 + sortedKeywords.length * 3} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                등록된 키워드가 없습니다. "키워드 관리" 버튼을 클릭하여 키워드를 추가해주세요.
              </td>
            </tr>
          ) : (
            dateRange.map((date) => (
              <tr key={date} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="sticky left-0 bg-white dark:bg-gray-800 px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white z-10 border-r border-gray-200 dark:border-gray-700">
                  {formatYear(date)} {formatDate(date)}
                </td>
                {sortedKeywords.map((keyword) => {
                  const ranking = getRankingForDateAndKeyword(date, keyword.id)
                  return (
                    <>
                      <td key={`${keyword.id}-${date}-mobile`} className="px-4 py-3 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400 text-center border-l border-gray-200 dark:border-gray-700">
                        {ranking?.mobileRank ? `${ranking.mobileRank}위` : '-'}
                      </td>
                      <td key={`${keyword.id}-${date}-pc`} className="px-4 py-3 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400 text-center">
                        {ranking?.pcRank ? `${ranking.pcRank}위` : '-'}
                      </td>
                      <td key={`${keyword.id}-${date}-delete`} className="px-2 py-3 whitespace-nowrap text-sm text-center">
                        <button
                          onClick={() => handleDeleteDate(date)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="이 날짜의 순위 기록 삭제"
                        >
                          🗑️
                        </button>
                      </td>
                    </>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}