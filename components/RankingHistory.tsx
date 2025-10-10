'use client'

import { RankingRecord, Keyword, Store } from '@/types/ranking'

interface RankingHistoryProps {
  storeId: string
  keywords: Keyword[]
  rankings: RankingRecord[]
  store?: Store
}

export default function RankingHistory({ storeId, keywords, rankings, store }: RankingHistoryProps) {
  // 날짜 범위 생성 (10월 10일 이후만)
  const generateDateRange = () => {
    const dates = new Set<string>()
    const today = new Date()
    const cutoffDate = new Date('2025-10-10') // 10월 10일부터만 표시

    // Add today and past 6 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateString = date.toISOString().split('T')[0]
      
      // 10월 10일 이후만 추가
      if (date >= cutoffDate) {
        dates.add(dateString)
      }
    }

    // Add dates from existing rankings (10월 10일 이후만)
    rankings.forEach(r => {
      const rankingDate = new Date(r.date)
      if (rankingDate >= cutoffDate) {
        dates.add(r.date)
      }
    });

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
                          <td key={`${keyword.id}-${date}-mobile`} className="px-4 py-3 whitespace-nowrap text-sm text-center border-l border-gray-200 dark:border-gray-700">
                            {ranking?.mobileRank ? (
                              <button
                                onClick={() => window.open(`https://m.map.naver.com/search?query=${encodeURIComponent(keyword.keyword)}`, '_blank')}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline cursor-pointer"
                              >
                                {ranking.mobileRank}위
                              </button>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-xs">50위↓</span>
                            )}
                          </td>
                          <td key={`${keyword.id}-${date}-pc`} className="px-4 py-3 whitespace-nowrap text-sm text-center">
                            {ranking?.pcRank ? (
                              <button
                                onClick={() => window.open(`https://m.map.naver.com/search?query=${encodeURIComponent(keyword.keyword)}`, '_blank')}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline cursor-pointer"
                              >
                                {ranking.pcRank}위
                              </button>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-xs">50위↓</span>
                            )}
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