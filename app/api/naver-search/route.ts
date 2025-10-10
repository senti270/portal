import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('query')

  if (!query) {
    return NextResponse.json({ error: '검색어가 필요합니다.' }, { status: 400 })
  }

  try {
    const clientId = 't1k1bGJRdAJXSfjFkLOu'
    const clientSecret = 'j5rVHuhFFx'
    
    // 네이버 검색 API 호출
    const response = await fetch(
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=10&start=1&sort=random`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`네이버 API 오류: ${response.status}`)
    }

    const data = await response.json()
    
    // 네이버 API 응답을 우리 형식으로 변환
    const places = data.items?.map((item: any) => ({
      id: `naver-${item.link?.split('/').pop() || Math.random().toString(36).substr(2, 9)}`,
      name: item.title?.replace(/<[^>]*>/g, '') || '',
      address: item.address || item.roadAddress || '',
      category: item.category || '기타'
    })) || []

    return NextResponse.json({ places })
  } catch (error) {
    console.error('네이버 API 오류:', error)
    return NextResponse.json(
      { error: '네이버 검색 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
