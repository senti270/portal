import { NextRequest, NextResponse } from 'next/server'

const NAVER_COMMERCE_CLIENT_ID = process.env.NAVER_COMMERCE_CLIENT_ID || ''
const NAVER_COMMERCE_CLIENT_SECRET = process.env.NAVER_COMMERCE_CLIENT_SECRET || ''

// 네이버 커머스 API 테스트
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const password = searchParams.get('password')

    // 관리자 인증
    if (password !== '43084308') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // API 키 확인
    if (!NAVER_COMMERCE_CLIENT_ID || !NAVER_COMMERCE_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'API keys not configured' },
        { status: 500 }
      )
    }

    console.log('🔑 API 키 확인:', {
      clientId: NAVER_COMMERCE_CLIENT_ID ? '설정됨' : '미설정',
      clientSecret: NAVER_COMMERCE_CLIENT_SECRET ? '설정됨' : '미설정'
    })

    // 1. 스토어 정보 조회 (가장 기본적인 API)
    const storeApiUrl = 'https://api.commerce.naver.com/external/v1/seller/stores'
    
    console.log('📡 스토어 정보 API 호출 중...')
    
    const storeResponse = await fetch(storeApiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Naver-Client-Id': NAVER_COMMERCE_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_COMMERCE_CLIENT_SECRET,
      },
    })

    console.log('📡 스토어 API 응답 상태:', storeResponse.status)

    if (!storeResponse.ok) {
      const errorText = await storeResponse.text()
      console.error('❌ 스토어 API 에러:', errorText)
      
      return NextResponse.json({
        success: false,
        error: '스토어 API 호출 실패',
        status: storeResponse.status,
        details: errorText,
        apiUrl: storeApiUrl,
        headers: {
          'X-Naver-Client-Id': NAVER_COMMERCE_CLIENT_ID ? '설정됨' : '미설정',
          'X-Naver-Client-Secret': NAVER_COMMERCE_CLIENT_SECRET ? '설정됨' : '미설정'
        }
      }, { status: storeResponse.status })
    }

    const storeData = await storeResponse.json()
    
    return NextResponse.json({
      success: true,
      message: '네이버 커머스 API 연결 성공!',
      storeData,
      apiUrl: storeApiUrl
    })

  } catch (error) {
    console.error('❌ 네이버 커머스 API 테스트 실패:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'API 테스트 실패',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
