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

    // 여러 엔드포인트 테스트
    const endpoints = [
      'https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders',
      'https://api.commerce.naver.com/external/v1/seller/stores',
      'https://api.commerce.naver.com/external/v1/seller',
      'https://api.commerce.naver.com/external/v1/stores'
    ]

    const results = []

    for (const apiUrl of endpoints) {
      console.log(`📡 API 테스트: ${apiUrl}`)
      
      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Naver-Client-Id': NAVER_COMMERCE_CLIENT_ID,
            'X-Naver-Client-Secret': NAVER_COMMERCE_CLIENT_SECRET,
          },
        })

        console.log(`📡 ${apiUrl} 응답 상태:`, response.status)

        if (response.ok) {
          const data = await response.json()
          results.push({
            url: apiUrl,
            status: response.status,
            success: true,
            data: data
          })
          break // 성공한 엔드포인트 찾으면 중단
        } else {
          const errorText = await response.text()
          results.push({
            url: apiUrl,
            status: response.status,
            success: false,
            error: errorText
          })
        }
      } catch (error) {
        results.push({
          url: apiUrl,
          status: 'ERROR',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successfulResult = results.find(r => r.success)
    
    if (successfulResult) {
      return NextResponse.json({
        success: true,
        message: '네이버 커머스 API 연결 성공!',
        workingEndpoint: successfulResult.url,
        data: successfulResult.data,
        allResults: results
      })
    } else {
      return NextResponse.json({
        success: false,
        error: '모든 엔드포인트 테스트 실패',
        results: results
      }, { status: 404 })
    }

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
