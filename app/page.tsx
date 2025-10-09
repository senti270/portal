'use client'

import { useState, useEffect } from 'react'
import SystemCard from '@/components/SystemCard'
import SearchBar from '@/components/SearchBar'
import ThemeToggle from '@/components/ThemeToggle'
import { System, systems } from '@/data/systems'

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredSystems, setFilteredSystems] = useState<System[]>(systems)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // 다크모드 초기 설정
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  useEffect(() => {
    // 검색 필터링
    const filtered = systems.filter(system =>
      system.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      system.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      system.category.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredSystems(filtered)
  }, [searchTerm])

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      {/* 헤더 */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl font-bold">C</span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  cdcdcd.kr
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">통합 업무 포털</p>
              </div>
            </div>
            <ThemeToggle isDark={isDark} toggleTheme={toggleTheme} />
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 검색바 */}
        <div className="mb-8 animate-fade-in">
          <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        </div>

        {/* 통계 정보 */}
        <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4 animate-slide-up">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md transition-all duration-300 hover:shadow-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {systems.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">전체 시스템</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md transition-all duration-300 hover:shadow-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {systems.filter(s => s.status === 'active').length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">활성 시스템</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md transition-all duration-300 hover:shadow-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {new Set(systems.map(s => s.category)).size}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">카테고리</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md transition-all duration-300 hover:shadow-lg">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {filteredSystems.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">검색 결과</div>
          </div>
        </div>

        {/* 시스템 카드 그리드 */}
        {filteredSystems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
            {filteredSystems.map((system, index) => (
              <SystemCard key={system.id} system={system} index={index} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              검색 결과가 없습니다
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              다른 검색어를 시도해보세요
            </p>
          </div>
        )}
      </div>

      {/* 푸터 */}
      <footer className="mt-20 py-8 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            © 2025 cdcdcd.kr | 통합 업무 포털 시스템
          </p>
        </div>
      </footer>
    </main>
  )
}

