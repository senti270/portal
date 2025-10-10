import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json()

    if (!address) {
      return NextResponse.json({ error: '주소가 필요합니다.' }, { status: 400 })
    }

    const clientId = process.env.NAVER_CLIENT_ID
    const clientSecret = process.env.NAVER_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    // 네이버 Geocoding API 호출 (검색 API로 대체)
    // Geocoding API는 Cloud Platform 전용이므로, 검색 API를 사용
    const searchUrl = new URL('https://openapi.naver.com/v1/search/local.json')
    searchUrl.searchParams.append('query', address)
    searchUrl.searchParams.append('display', '1')

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Geocoding API Error:', errorText)
      return NextResponse.json(
        { error: '좌표 변환 실패', details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (data.items && data.items.length > 0) {
      const item = data.items[0]
      // mapx, mapy는 카텍 좌표계이므로 10000000으로 나눠서 위경도로 변환
      const longitude = parseInt(item.mapx) / 10000000
      const latitude = parseInt(item.mapy) / 10000000
      
      return NextResponse.json({
        success: true,
        latitude,
        longitude,
        address: item.roadAddress || item.address,
      })
    } else {
      return NextResponse.json({ error: '좌표를 찾을 수 없습니다.' }, { status: 404 })
    }
  } catch (error) {
    console.error('Geocoding Error:', error)
    return NextResponse.json(
      { error: '좌표 변환 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

