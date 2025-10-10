'use client'

import { useState, useEffect } from 'react'
import { RankingRecord, Keyword } from '@/types/ranking'

interface RankingHistoryProps {
  storeId: string
  keywords: Keyword[]
  rankings: RankingRecord[]
}

export default function RankingHistory({ storeId, keywords, rankings }: RankingHistoryProps) {
  // 날짜 범위 생성 (최근 7일)
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

  const formatYear = (dateString: string) => {
    const date = new Date(dateString)
    return date.getFullYear()
  }

  const dateRange = generateDateRange()

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          {/* 첫 번째 헤더 행: 키워드명들 */}
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              키워드
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              월 검색량
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              모바일
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              PC
            </th>
            {keywords.map((keyword) => (
              <th key={keyword.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {keyword.keyword}
              </th>
            ))}
          </tr>
          
          {/* 두 번째 헤더 행: 월 검색량 정보 */}
          <tr>
            <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400"></td>
            <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">월 검색량</td>
            <td className="px-4 py-2 text-center text-xs text-gray-500 dark:text-gray-400">📱</td>
            <td className="px-4 py-2 text-center text-xs text-gray-500 dark:text-gray-400">💻</td>
            {keywords.map((keyword) => (
              <td key={keyword.id} className="px-4 py-2 text-center text-xs text-gray-500 dark:text-gray-400">
                {keyword.monthlySearchVolume.toLocaleString()}
              </td>
            ))}
          </tr>
          
          {/* 세 번째 헤더 행: 모바일/PC 검색량 */}
          <tr>
            <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400"></td>
            <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400"></td>
            <td className="px-4 py-2 text-center text-xs text-gray-500 dark:text-gray-400">📱</td>
            <td className="px-4 py-2 text-center text-xs text-gray-500 dark:text-gray-400">💻</td>
            {keywords.map((keyword) => (
              <td key={keyword.id} className="px-4 py-2 text-center text-xs text-gray-500 dark:text-gray-400">
                <div className="flex justify-center gap-2">
                  <span>{keyword.mobileVolume.toLocaleString()}</span>
                  <span>{keyword.pcVolume.toLocaleString()}</span>
                </div>
              </td>
            ))}
          </tr>
        </thead>
        
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {/* 날짜별 행들 */}
          {dateRange.map((date) => (
            <tr key={date} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              {/* 날짜 */}
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                <div className="flex items-center gap-2">
                  <span>{formatDate(date)}</span>
                  <button className="text-red-500 hover:text-red-700 text-xs">
                    🗑️
                  </button>
                </div>
              </td>
              
              {/* 빈 셀들 */}
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3"></td>
              
              {/* 키워드별 순위 데이터 */}
              {keywords.map((keyword) => {
                const ranking = getRankingForDate(date, keyword.id)
                return (
                  <td key={`${date}-${keyword.id}`} className="px-4 py-3 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400 text-center">
                    {ranking ? `${ranking.mobileRank}위` : '-'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      
      {keywords.length === 0 && (
        <div className="p-8 text-center">
          <div className="text-gray-400 text-4xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            등록된 키워드가 없습니다
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            "키워드 관리" 버튼을 클릭하여 키워드를 추가해주세요.
          </p>
        </div>
      )}
    </div>
  )
}