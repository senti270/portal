import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { query, latitude, longitude, display = 50 } = await request.json()

    if (!query) {
      return NextResponse.json({ error: '검색어가 필요합니다.' }, { status: 400 })
    }

    const clientId = process.env.NAVER_CLIENT_ID
    const clientSecret = process.env.NAVER_CLIENT_SECRET

    console.log('🔍 Search API - Environment variables check:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdLength: clientId?.length || 0,
      clientSecretLength: clientSecret?.length || 0
    })

    if (!clientId || !clientSecret) {
      console.error('❌ Search API - API keys missing:', { clientId: !!clientId, clientSecret: !!clientSecret })
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

        // 네이버 로컬 검색 API 호출
        const searchUrl = new URL('https://openapi.naver.com/v1/search/local.json')
        searchUrl.searchParams.append('query', query)
        searchUrl.searchParams.append('display', Math.min(display, 100).toString()) // 최대 100개까지
        searchUrl.searchParams.append('start', '1') // 시작점 명시
        searchUrl.searchParams.append('sort', 'comment') // 댓글순 정렬 (더 많은 결과)
        
        console.log('🔍 API 요청 URL:', searchUrl.toString())
    
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

        console.log(`✅ 네이버 검색 성공: "${query}" - 총 ${data.total}개 결과, 실제 반환: ${data.items.length}개`)
        console.log(`   첫 번째 결과: ${data.items?.[0]?.title || 'N/A'}`)

        // 여러 페이지 결과 수집 (최대 3페이지)
        let allItems = [...data.items]
        let currentStart = data.start + data.display
        
        while (allItems.length < Math.min(display, data.total) && allItems.length < 100 && currentStart <= data.total) {
          console.log(`📄 추가 페이지 요청: start=${currentStart}, display=${Math.min(20, data.total - currentStart + 1)}`)
          
          const nextSearchUrl = new URL('https://openapi.naver.com/v1/search/local.json')
          nextSearchUrl.searchParams.append('query', query)
          nextSearchUrl.searchParams.append('display', Math.min(20, data.total - currentStart + 1).toString())
          nextSearchUrl.searchParams.append('start', currentStart.toString())
          
          if (latitude && longitude) {
            nextSearchUrl.searchParams.append('x', longitude.toString())
            nextSearchUrl.searchParams.append('y', latitude.toString())
          }

          const nextResponse = await fetch(nextSearchUrl.toString(), {
            headers: {
              'X-Naver-Client-Id': clientId,
              'X-Naver-Client-Secret': clientSecret,
            },
          })

          if (nextResponse.ok) {
            const nextData = await nextResponse.json()
            allItems = [...allItems, ...nextData.items]
            currentStart += nextData.display
            console.log(`📄 추가 페이지 결과: ${nextData.items.length}개 추가, 총 ${allItems.length}개`)
          } else {
            console.log(`📄 추가 페이지 실패: ${nextResponse.status}`)
            break
          }
        }

        return NextResponse.json({
          success: true,
          total: data.total,
          items: allItems.map((item: any, index: number) => ({
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
