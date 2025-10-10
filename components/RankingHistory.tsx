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
    return `${date.getFullYear()} ${date.getMonth() + 1}/${date.getDate()} (${days[date.getDay()]})`
  }

  const dateRange = generateDateRange()

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
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
            {dateRange.map((date) => (
              <th key={date} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider relative">
                {formatDate(date)}
                <button className="absolute -top-1 -right-1 text-red-500 hover:text-red-700 text-xs">
                  🗑️
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {keywords.map((keyword) => (
            <tr key={keyword.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              {/* 키워드 */}
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                {keyword.keyword}
              </td>
              
              {/* 월 검색량 */}
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                {keyword.monthlySearchVolume.toLocaleString()}
              </td>
              
              {/* 모바일 검색량 */}
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                {keyword.mobileVolume.toLocaleString()}
              </td>
              
              {/* PC 검색량 */}
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                {keyword.pcVolume.toLocaleString()}
              </td>
              
              {/* 날짜별 순위 */}
              {dateRange.map((date) => {
                const ranking = getRankingForDate(date, keyword.id)
                return (
                  <td key={`${keyword.id}-${date}`} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                    {ranking ? (
                      <div className="flex flex-col">
                        <span className="font-medium">{ranking.mobileRank}위</span>
                        {ranking.pcRank && ranking.pcRank !== ranking.mobileRank && (
                          <span className="text-xs text-gray-500">({ranking.pcRank}위)</span>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
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