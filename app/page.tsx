'use client'

import { useState, useEffect } from 'react'
import SystemCard from '@/components/SystemCard'
import SearchBar from '@/components/SearchBar'
import ThemeToggle from '@/components/ThemeToggle'
import AdminLogin from '@/components/AdminLogin'
import AdminPanel from '@/components/AdminPanel'
import { System, systems } from '@/data/systems'
import { getSystems } from '@/lib/firestore'

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('')
  const [allSystems, setAllSystems] = useState<System[]>(systems)
  const [filteredSystems, setFilteredSystems] = useState<System[]>(systems)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // 다크모드 초기 설정
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true)
      document.documentElement.classList.add('dark')
    }
    
    // Firestore에서 시스템 데이터 로드
    loadSystems()
  }, [])

  const loadSystems = async () => {
    try {
      const firestoreSystems = await getSystems()
      if (firestoreSystems.length > 0) {
        setAllSystems(firestoreSystems)
        setFilteredSystems(firestoreSystems)
      } else {
        // Firestore가 비어있으면 기본 데이터 사용
        setAllSystems(systems)
        setFilteredSystems(systems)
      }
    } catch (error) {
      console.error('Error loading systems:', error)
      // 오류 시 로컬 스토리지에서 로드
      const savedSystems = localStorage.getItem('portal-systems')
      if (savedSystems) {
        const parsedSystems = JSON.parse(savedSystems)
        setAllSystems(parsedSystems)
        setFilteredSystems(parsedSystems)
      } else {
        setAllSystems(systems)
        setFilteredSystems(systems)
      }
    }
  }

  useEffect(() => {
    // 검색 필터링 및 정렬
    const filtered = allSystems.filter(system =>
      system.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      system.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      system.category.toLowerCase().includes(searchTerm.toLowerCase())
    )
    
    // order 필드로 정렬 (드래그 앤 드롭 순서 유지)
    const sorted = filtered.sort((a, b) => {
      const aOrder = a.order ?? 999
      const bOrder = b.order ?? 999
      return aOrder - bOrder
    })
    
    setFilteredSystems(sorted)
  }, [searchTerm, allSystems])

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      {/* 헤더 */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl font-bold">C</span>
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    드로잉컴퍼니
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">통합 업무 포털</p>
                </div>
                <ThemeToggle isDark={isDark} toggleTheme={toggleTheme} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 검색바 */}
        <div className="mb-8 animate-fade-in">
          <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
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
            © 2025 드로잉컴퍼니 | 통합 업무 포털 시스템
          </p>
        </div>
      </footer>

      {/* 관리자 기능 */}
      <AdminLogin />
      <AdminPanel 
        systemsList={allSystems}
        onSystemsUpdate={setAllSystems}
      />
    </main>
  )
}

