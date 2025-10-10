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
    // CORS 문제로 인해 직접 API 호출이 제한되므로
    // 백엔드 API 엔드포인트를 통해 호출하거나
    // 프록시 서버를 사용해야 합니다.
    
    // 현재는 샘플 데이터 반환
    console.log(`네이버 플레이스 검색: ${query}`)
    
    // 실제 구현 시에는 다음 중 하나의 방법 사용:
    // 1. 백엔드 API 엔드포인트 생성 (/api/naver-search)
    // 2. CORS 프록시 서버 사용
    // 3. 네이버 공식 API 사용 (API 키 필요)
    
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
  } catch (error) {
    console.error('네이버 플레이스 검색 오류:', error)
    return {
      error: '네이버 플레이스 검색 중 오류가 발생했습니다.'
    }
  }
}

// 네이버 스마트플레이스 순위 조회 함수
export const fetchNaverRanking = async (keyword: string, storeName: string, storeAddress?: string): Promise<{
  mobileRank?: number
  pcRank?: number
  error?: string
}> => {
  try {
    console.log(`네이버 스마트플레이스 순위 조회: "${keyword}" - "${storeName}"`)
    
    // 1. 먼저 해당 매장을 네이버 플레이스에서 검색
    const placeSearchResult = await searchNaverPlace(storeName)
    
    if (placeSearchResult.error || !placeSearchResult.places?.length) {
      console.log('매장을 네이버 플레이스에서 찾을 수 없습니다.')
      // 매장을 찾을 수 없어도 키워드 검색으로 순위 조회 시도
    }
    
    // 2. 키워드로 네이버 검색 결과에서 순위 찾기
    const searchQuery = `${keyword} ${storeName}`.trim()
    const rankingResult = await searchNaverPlace(searchQuery)
    
    if (rankingResult.error) {
      throw new Error(rankingResult.error)
    }
    
    // 3. 검색 결과에서 해당 매장의 순위 찾기
    const targetStoreIndex = rankingResult.places?.findIndex(place => 
      place.name.includes(storeName) || storeName.includes(place.name)
    ) || -1
    
    const rank = targetStoreIndex >= 0 ? targetStoreIndex + 1 : null
    
    if (rank) {
      // 모바일과 PC는 동일한 순위로 가정 (실제로는 별도 조회 필요)
      return {
        mobileRank: rank,
        pcRank: rank
      }
    } else {
      // 순위를 찾을 수 없는 경우
      return {
        mobileRank: undefined,
        pcRank: undefined
      }
    }
  } catch (error) {
    console.error('순위 조회 오류:', error)
    
    // 오류 발생 시 시뮬레이션 데이터 반환 (개발용)
    const mobileRank = Math.floor(Math.random() * 50) + 1
    const pcRank = Math.floor(Math.random() * 50) + 1
    
    return {
      mobileRank,
      pcRank,
      error: '순위 조회 중 오류가 발생했습니다. (시뮬레이션 데이터)'
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
