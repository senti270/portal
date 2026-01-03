'use client'

import { useState, useEffect } from 'react'
import SystemCard from '@/components/SystemCard'
import SearchBar from '@/components/SearchBar'
import ThemeToggle from '@/components/ThemeToggle'
import AdminLogin from '@/components/AdminLogin'
import AdminPanel from '@/components/AdminPanel'
import PortalAuth from '@/components/PortalAuth'
import { System, systems } from '@/data/systems'
import { getSystems } from '@/lib/firestore'
import { searchManuals } from '@/lib/manual-firestore'
import { getPurchaseItems } from '@/lib/purchase-firestore'
import { getKeywords } from '@/lib/keyword-firestore'
import { getStores } from '@/lib/store-firestore'

function PortalContent() {
  const [searchTerm, setSearchTerm] = useState('')
  const [allSystems, setAllSystems] = useState<System[]>(systems)
  const [filteredSystems, setFilteredSystems] = useState<System[]>(systems)
  const [isDark, setIsDark] = useState(false)
  const [searchResults, setSearchResults] = useState<{
    manuals: any[]
    purchases: any[]
    keywords: any[]
  } | null>(null)
  const [isSearching, setIsSearching] = useState(false)

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
      console.log('🔄 시스템 로딩 시작...')
      const firestoreSystems = await getSystems()
          console.log('📊 Firebase에서 로드된 시스템:', firestoreSystems.length, '개')
          console.log('📋 로드된 시스템 목록:', firestoreSystems.map(s => s.title))
          console.log('🔢 메인 페이지에서 받은 order 값들:', firestoreSystems.map(s => `${s.title}: ${s.order}`))
      
      if (firestoreSystems.length > 0) {
        console.log('✅ Firebase 데이터 사용')
        // Firebase에 없는 기본 시스템들을 병합
        const firestoreSystemIds = new Set(firestoreSystems.map(s => s.id))
        const missingSystems = systems.filter(s => !firestoreSystemIds.has(s.id))
        const mergedSystems = [...firestoreSystems, ...missingSystems]
        // order 기준으로 정렬
        mergedSystems.sort((a, b) => (a.order || 999) - (b.order || 999))
        setAllSystems(mergedSystems)
        setFilteredSystems(mergedSystems)
      } else {
        console.log('⚠️ Firebase가 비어있음, 기본 데이터 사용')
        // Firestore가 비어있으면 기본 데이터 사용
        setAllSystems(systems)
        setFilteredSystems(systems)
      }
    } catch (error) {
      console.error('❌ Firebase 로딩 오류:', error)
      // 오류 시 로컬 스토리지에서 로드
      const savedSystems = localStorage.getItem('portal-systems')
      if (savedSystems) {
        console.log('💾 로컬 스토리지에서 로드')
        const parsedSystems = JSON.parse(savedSystems)
        // 로컬 스토리지에도 없는 기본 시스템들을 병합
        const savedSystemIds = new Set(parsedSystems.map((s: System) => s.id))
        const missingSystems = systems.filter(s => !savedSystemIds.has(s.id))
        const mergedSystems = [...parsedSystems, ...missingSystems]
        mergedSystems.sort((a: System, b: System) => (a.order || 999) - (b.order || 999))
        setAllSystems(mergedSystems)
        setFilteredSystems(mergedSystems)
      } else {
        console.log('🔄 기본 시스템 데이터 사용')
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

  useEffect(() => {
    const performSearch = async () => {
      if (!searchTerm.trim() || searchTerm.length < 2) {
        setSearchResults(null)
        return
      }

      setIsSearching(true)
      try {
        const [manuals, purchases, stores] = await Promise.all([
          searchManuals(searchTerm),
          getPurchaseItems(),
          getStores()
        ])

        const filteredPurchases = purchases.filter(item =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.purchaseSource?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (Array.isArray(item.category) && item.category.some(cat => cat.toLowerCase().includes(searchTerm.toLowerCase())))
        )

        const allKeywordsArrays = await Promise.all(
          stores.map(s => getKeywords(s.id))
        )
        const allKeywords = allKeywordsArrays.flat()
        const filteredKeywords = allKeywords.filter(k =>
          k.keyword.toLowerCase().includes(searchTerm.toLowerCase())
        )

        setSearchResults({
          manuals: manuals || [],
          purchases: filteredPurchases || [],
          keywords: filteredKeywords || []
        })
      } catch (error) {
        console.error('검색 오류:', error)
        setSearchResults(null)
      } finally {
        setIsSearching(false)
      }
    }

    const timeoutId = setTimeout(performSearch, 300)
    return () => clearTimeout(timeoutId)
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
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
                <img 
                  src="/apple-touch-icon.png" 
                  alt="드로잉컴퍼니 로고" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    카페드로잉&청담장어마켓
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
          <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="통합 검색... (매뉴얼, 구매물품, 키워드 등)" />
        </div>

        {/* 통합 검색 결과 */}
        {searchResults && searchTerm.trim() && (
          <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">검색 결과: "{searchTerm}"</h2>
            {isSearching ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">검색 중...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 매뉴얼 결과 */}
                {searchResults.manuals.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">📚 매뉴얼 ({searchResults.manuals.length}개)</h3>
                    <div className="space-y-2">
                      {searchResults.manuals.slice(0, 5).map((m: any) => (
                        <div key={m.id} className="border-l-4 border-blue-500 pl-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                          <a href={`/manual-viewer?manual=${m.id}`} className="block">
                            <div className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">{m.title}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                              {(m.content || '').toString().replace(/\n+/g, ' ').slice(0, 100)}...
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">링크: /manual-viewer?manual={m.id}</div>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 구매물품 결과 */}
                {searchResults.purchases.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">🛒 구매물품 ({searchResults.purchases.length}개)</h3>
                    <div className="space-y-2">
                      {searchResults.purchases.slice(0, 5).map((item: any) => (
                        <div key={item.id} className="border-l-4 border-green-500 pl-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                          <div className="font-semibold text-gray-900 dark:text-white">{item.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            카테고리: {item.category?.join(', ') || '미분류'} | 구매처: {item.purchaseSource || '미지정'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 키워드 결과 */}
                {searchResults.keywords.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">🔍 키워드 ({searchResults.keywords.length}개)</h3>
                    <div className="space-y-2">
                      {searchResults.keywords.slice(0, 5).map((k: any) => (
                        <div key={k.id} className="border-l-4 border-purple-500 pl-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                          <div className="font-semibold text-gray-900 dark:text-white">{k.keyword}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            월 검색량: {k.monthlySearchVolume?.toLocaleString() || 0} | 상태: {k.isActive ? '🟢 활성' : '🔴 비활성'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {searchResults.manuals.length === 0 && searchResults.purchases.length === 0 && searchResults.keywords.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    검색 결과가 없습니다.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 시스템 카드 그리드 */}
        {(!searchResults || !searchTerm.trim()) && filteredSystems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
            {filteredSystems.map((system, index) => (
              <SystemCard key={system.id} system={system} index={index} />
            ))}
          </div>
        )}
      </div>

      {/* 푸터 */}
      <footer className="mt-20 py-8 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            © 2025 카페드로잉&청담장어마켓 | 통합 업무 포털 시스템
          </p>
        </div>
      </footer>

      {/* 관리자 기능 */}
      <AdminLogin />
      <AdminPanel 
        systemsList={allSystems}
        onSystemsUpdate={(updatedSystems) => {
          setAllSystems(updatedSystems)
          setFilteredSystems(updatedSystems)
          // 상태 업데이트 강제
          setTimeout(() => {
            setFilteredSystems([...updatedSystems])
          }, 100)
        }}
      />
    </main>
  )
}

export default function Home() {
  return (
    <PortalAuth>
      <PortalContent />
    </PortalAuth>
  )
}

