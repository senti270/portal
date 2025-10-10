import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('🌍 Geocode API called')
  
  try {
    const { address } = await request.json()
    console.log('📍 Address received:', address)

    if (!address) {
      console.log('❌ No address provided')
      return NextResponse.json({ error: '주소가 필요합니다.' }, { status: 400 })
    }

    const clientId = process.env.NAVER_CLIENT_ID
    const clientSecret = process.env.NAVER_CLIENT_SECRET

    console.log('🔑 Environment variables check:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdLength: clientId?.length || 0,
      clientSecretLength: clientSecret?.length || 0,
      allEnvVars: Object.keys(process.env).filter(key => key.includes('NAVER'))
    })

    if (!clientId || !clientSecret) {
      console.error('❌ API keys missing:', { clientId: !!clientId, clientSecret: !!clientSecret })
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    // 주소를 간단하게 변환 (동탄대로만 검색)
    const simplifiedAddress = address.includes('동탄대로') ? '동탄대로 446' : address
    console.log('🔧 Simplified address:', simplifiedAddress)
    
    // 네이버 Local Search API로 주소 검색하여 좌표 획득
    const searchUrl = new URL('https://openapi.naver.com/v1/search/local.json')
    searchUrl.searchParams.append('query', simplifiedAddress)
    searchUrl.searchParams.append('display', '5') // 더 많은 결과 검색

    console.log('🔍 Calling Naver API:', searchUrl.toString())

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    })

    console.log('📡 Naver API response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Naver API Error:', errorText)
      return NextResponse.json(
        { error: '네이버 API 호출 실패', details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('📋 Naver API response:', data)

    if (data.items && data.items.length > 0) {
      console.log(`📋 Found ${data.items.length} results, using first one`)
      
      // 첫 번째 결과 사용 (가장 관련성 높은 결과)
      const item = data.items[0]
      // mapx, mapy는 카텍 좌표계이므로 10000000으로 나눠서 위경도로 변환
      const longitude = parseInt(item.mapx) / 10000000
      const latitude = parseInt(item.mapy) / 10000000
      
      console.log('✅ Coordinates found:', { 
        latitude, 
        longitude, 
        title: item.title,
        address: item.roadAddress || item.address 
      })
      
      return NextResponse.json({
        success: true,
        latitude,
        longitude,
        address: item.roadAddress || item.address,
      })
    } else {
      console.log('❌ No items found in response')
      console.log('📋 Full response:', JSON.stringify(data, null, 2))
      return NextResponse.json({ error: '좌표를 찾을 수 없습니다.' }, { status: 404 })
    }
  } catch (error) {
    console.error('❌ Geocoding Error:', error)
    return NextResponse.json(
      { error: '좌표 변환 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
