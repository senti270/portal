import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { query, latitude, longitude, display = 50 } = await request.json()

    if (!query) {
      return NextResponse.json({ error: '검색어가 필요합니다.' }, { status: 400 })
    }

    const clientId = process.env.NAVER_CLIENT_ID
    const clientSecret = process.env.NAVER_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    // 네이버 로컬 검색 API 호출
    const searchUrl = new URL('https://openapi.naver.com/v1/search/local.json')
    searchUrl.searchParams.append('query', query)
    searchUrl.searchParams.append('display', display.toString())
    searchUrl.searchParams.append('sort', 'random') // random 정렬로 실제 순위 반영
    
    // 좌표가 있으면 추가
    if (latitude && longitude) {
      searchUrl.searchParams.append('x', longitude.toString())
      searchUrl.searchParams.append('y', latitude.toString())
    }

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Naver API Error:', errorText)
      return NextResponse.json(
        { error: '네이버 API 호출 실패', details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()

    console.log(`✅ 네이버 검색 성공: "${query}" - 총 ${data.total}개 결과`)
    console.log(`   첫 번째 결과: ${data.items?.[0]?.title || 'N/A'}`)

    return NextResponse.json({
      success: true,
      total: data.total,
      items: data.items.map((item: any, index: number) => ({
        rank: index + 1,
        title: item.title.replace(/<[^>]*>/g, ''), // HTML 태그 제거
        link: item.link,
        category: item.category,
        address: item.address,
        roadAddress: item.roadAddress,
        mapx: item.mapx,
        mapy: item.mapy,
      })),
    })
  } catch (error) {
    console.error('Search API Error:', error)
    return NextResponse.json(
      { error: '검색 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
