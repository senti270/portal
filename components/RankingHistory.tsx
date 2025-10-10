'use client'

import { useState, useEffect } from 'react'
import { RankingRecord, defaultKeywords } from '@/types/ranking'

interface RankingHistoryProps {
  storeId: string
  rankings?: any[]
}

// 샘플 순위 데이터
const sampleRankings: RankingRecord[] = [
  {
    id: 'ranking1',
    storeId: 'store1',
    keywordId: 'keyword1',
    date: '2025-01-28',
    mobileRank: 13,
    pcRank: 15,
    isAutoTracked: true,
    createdAt: new Date('2025-01-28')
  },
  {
    id: 'ranking2',
    storeId: 'store1',
    keywordId: 'keyword2',
    date: '2025-01-27',
    mobileRank: 8,
    pcRank: 12,
    isAutoTracked: true,
    createdAt: new Date('2025-01-27')
  }
]

export default function RankingHistory({ storeId, rankings: propRankings = [] }: RankingHistoryProps) {
  const [rankings, setRankings] = useState<RankingRecord[]>([])
  const [selectedKeyword, setSelectedKeyword] = useState<string>('')

  useEffect(() => {
    // 해당 지점의 키워드만 필터링
    const storeKeywords = defaultKeywords.filter(k => k.storeId === storeId)
    if (storeKeywords.length > 0) {
      setSelectedKeyword(storeKeywords[0].id)
    }
    
    // 전달받은 순위 데이터가 있으면 사용, 없으면 샘플 데이터 사용
    const storeRankings = propRankings.length > 0 
      ? propRankings 
      : sampleRankings.filter(r => r.storeId === storeId)
    setRankings(storeRankings)
  }, [storeId, propRankings])

  const handleDeleteRanking = (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      setRankings(rankings.filter(r => r.id !== id))
    }
  }

  const generateDateRange = () => {
    const dates = []
    const today = new Date()
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      dates.push(date.toISOString().split('T')[0])
    }
    
    return dates.reverse()
  }

  const getRankingForDate = (date: string, keywordId: string) => {
    return rankings.find(r => r.date === date && r.keywordId === keywordId)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return `${date.getMonth() + 1}/${date.getDate()}(${days[date.getDay()]})`
  }

  const storeKeywords = defaultKeywords.filter(k => k.storeId === storeId)
  const dateRange = generateDateRange()

  return (
    <div className="space-y-6">
      {/* 키워드 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          키워드 선택
        </label>
        <select
          value={selectedKeyword}
          onChange={(e) => setSelectedKeyword(e.target.value)}
          className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        >
          {storeKeywords.map((keyword) => (
            <option key={keyword.id} value={keyword.id}>
              {keyword.keyword}
            </option>
          ))}
        </select>
      </div>

      {/* 순위 기록 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            순위 기록
          </h3>
        </div>

        {selectedKeyword ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    날짜
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    모바일 순위
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    PC 순위
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {dateRange.map((date) => {
                  const ranking = getRankingForDate(date, selectedKeyword)
                  return (
                    <tr key={date} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatDate(date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {ranking?.mobileRank ? `${ranking.mobileRank}위` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {ranking?.pcRank ? `${ranking.pcRank}위` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {ranking ? (
                          <button
                            onClick={() => handleDeleteRanking(ranking.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            🗑️
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="text-gray-400 text-4xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              등록된 키워드가 없습니다
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              키워드를 먼저 등록해주세요.
            </p>
          </div>
        )}
      </div>

      {/* 안내 메시지 */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          💡 자동추적이 활성화되면 매일 정해진 시간에 순위가 자동으로 업데이트됩니다.
          현재는 샘플 데이터가 표시되고 있습니다.
        </p>
      </div>
    </div>
  )
}
