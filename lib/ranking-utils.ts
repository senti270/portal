// 순위 조회 및 데이터 처리 유틸리티
import * as XLSX from 'xlsx'

// 네이버 플레이스 검색 API 함수
export const searchNaverPlace = async (query: string): Promise<{
  places?: Array<{
    id: string
    name: string
    address: string
    category: string
  }>
  error?: string
}> => {
  try {
    // Next.js API 라우트를 통해 네이버 검색 API 호출
    const response = await fetch(`/api/naver-search?query=${encodeURIComponent(query)}`)
    
    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.error) {
      throw new Error(data.error)
    }
    
    return { places: data.places || [] }
  } catch (error) {
    console.error('네이버 플레이스 검색 오류:', error)
    
    // API 오류 시 샘플 데이터 반환
    const samplePlaces = [
      {
        id: 'place1',
        name: '청담장어마켓',
        address: '송파대로 111 202동 1층 165, 166, 167, 168, 169, 170호',
        category: '장어요리'
      },
      {
        id: 'place2', 
        name: '청담장어마켓 동탄점',
        address: '동탄대로 446 1층 1002호~1006호, 1009호, 1010호',
        category: '장어요리'
      },
      {
        id: 'place3',
        name: '청담장어마켓 송파점',
        address: '서울 송파구 백제고분로 451',
        category: '장어요리'
      },
      {
        id: 'place4',
        name: '카페드로잉 석촌호수점',
        address: '서울 송파구 석촌호수로 268',
        category: '카페'
      },
      {
        id: 'place5',
        name: '카페드로잉 정자점',
        address: '경기 성남시 분당구 정자일로 197',
        category: '카페'
      }
    ]
    
    // 검색어에 따라 필터링
    const filteredPlaces = samplePlaces.filter(place => 
      place.name.toLowerCase().includes(query.toLowerCase()) ||
      place.address.toLowerCase().includes(query.toLowerCase())
    )
    
    return { places: filteredPlaces }
  }
}

// 네이버 스마트플레이스 순위 조회 함수
// 주소를 좌표로 변환
export const getCoordinates = async (address: string): Promise<{
  latitude: number
  longitude: number
  error?: string
}> => {
  try {
    console.log('🔍 Testing geocode API with:', address)
    
    // 먼저 테스트 API로 확인
    const testResponse = await fetch('/api/test-geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    })
    
    if (testResponse.ok) {
      const testData = await testResponse.json()
      console.log('✅ Test API works:', testData)
    } else {
      console.log('❌ Test API failed:', testResponse.status)
    }
    
    // 실제 geocode API 호출
    const response = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || '좌표 변환 실패')
    }

    return {
      latitude: data.latitude,
      longitude: data.longitude,
    }
  } catch (error) {
    console.error('좌표 변환 오류:', error)
    return {
      latitude: 0,
      longitude: 0,
      error: error instanceof Error ? error.message : '좌표 변환 실패',
    }
  }
}

// 실제 네이버 검색 API로 순위 조회
export const fetchNaverRanking = async (keyword: string, storeName: string, storeAddress?: string): Promise<{
  mobileRank?: number
  pcRank?: number
  error?: string
}> => {
  try {
    console.log(`🔍 네이버 순위 조회 시작: "${keyword}" - "${storeName}"`)
    
    // 1. 매장 주소를 좌표로 변환 (위치 기준 검색)
    let latitude: number | undefined
    let longitude: number | undefined
    
    if (storeAddress) {
      console.log(`📍 주소로 좌표 변환 중: ${storeAddress}`)
      const coords = await getCoordinates(storeAddress)
      if (!coords.error) {
        latitude = coords.latitude
        longitude = coords.longitude
        console.log(`✅ 좌표: (${latitude}, ${longitude})`)
      } else {
        console.warn(`⚠️ 좌표 변환 실패: ${coords.error}, 위치 기준 없이 검색합니다.`)
      }
    }
    
    // 2. 사용자가 입력한 키워드 그대로 검색
    console.log(`🔎 검색어: "${keyword}" ${latitude && longitude ? `(위치: ${storeAddress})` : '(전국 검색)'}`)
    
    // 3. 네이버 로컬 검색 API 호출
    const response = await fetch('/api/naver-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: keyword,
        latitude,    // 매장 위치 좌표 전달
        longitude,   // 매장 위치 좌표 전달
        display: 50, // 상위 50개 검색
      }),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || '네이버 검색 실패')
    }

    // 4. 검색 결과에서 해당 매장의 순위 찾기
    console.log(`📋 검색 결과 (상위 10개):`)
    data.items.slice(0, 10).forEach((item: any, idx: number) => {
      console.log(`  ${idx + 1}위: ${item.title} (${item.category})`)
    })
    
    const targetStoreIndex = data.items.findIndex((item: any) => {
      const itemTitle = item.title.toLowerCase().replace(/<[^>]*>/g, '') // HTML 태그 제거
      const searchName = storeName.toLowerCase()
      
      // 정확한 매장명 매칭 (완전 일치 또는 포함)
      // 예: "청담장어마켓 동탄점" === "청담장어마켓 동탄점"
      if (itemTitle === searchName || itemTitle.includes(searchName) || searchName.includes(itemTitle)) {
        console.log(`🎯 매칭 성공: "${item.title}" ≈ "${storeName}"`)
        return true
      }
      
      return false
    })

    if (targetStoreIndex >= 0) {
      const rank = targetStoreIndex + 1
      console.log(`✅ 순위 발견: ${rank}위 (총 ${data.total}개 중)`)
      
      // 모바일과 PC 동일한 순위로 가정 (네이버 API는 구분 안함)
      return {
        mobileRank: rank,
        pcRank: rank,
      }
    } else {
      console.log(`❌ 상위 50위 안에서 "${storeName}"을 찾을 수 없습니다.`)
      console.log(`💡 팁: 매장 이름을 더 간단하게 수정해보세요 (예: "청담장어마켓")`)
      return {
        mobileRank: undefined,
        pcRank: undefined,
        error: '순위권 밖 (50위 이하)',
      }
    }
  } catch (error) {
    console.error('❌ 순위 조회 오류:', error)
    
    return {
      mobileRank: undefined,
      pcRank: undefined,
      error: error instanceof Error ? error.message : '순위 조회 실패',
    }
  }
}

// Excel 파일 생성 및 다운로드
export const exportToExcel = (data: any[], filename: string = '순위추적데이터') => {
  try {
    // 워크시트 생성
    const ws = XLSX.utils.json_to_sheet(data)
    
    // 워크북 생성
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '순위추적데이터')
    
    // 파일 다운로드
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`)
  } catch (error) {
    console.error('Excel export error:', error)
    throw new Error('Excel 파일 생성 중 오류가 발생했습니다.')
  }
}

// 순위 데이터를 Excel 형식으로 변환
export const formatRankingDataForExcel = (keywords: any[], rankings: any[], storeName: string) => {
  const exportData = keywords.map(keyword => {
    // 해당 키워드의 최신 순위 찾기
    const latestRanking = rankings
      .filter(r => r.keywordId === keyword.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    
    return {
      '지점명': storeName,
      '키워드': keyword.keyword,
      '월검색량': keyword.monthlySearchVolume,
      '모바일검색량': keyword.mobileVolume,
      'PC검색량': keyword.pcVolume,
      '최신모바일순위': latestRanking?.mobileRank || '-',
      '최신PC순위': latestRanking?.pcRank || '-',
      '최신순위날짜': latestRanking?.date || '-',
      '상태': keyword.isActive ? '활성' : '비활성'
    }
  })
  
  return exportData
}
