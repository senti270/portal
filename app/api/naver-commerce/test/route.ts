import { NextRequest, NextResponse } from 'next/server'

const NAVER_COMMERCE_CLIENT_ID = process.env.NAVER_COMMERCE_CLIENT_ID || ''
const NAVER_COMMERCE_CLIENT_SECRET = process.env.NAVER_COMMERCE_CLIENT_SECRET || ''

// 네이버 커머스 API 올바른 인증 방식 구현
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

    // 1. 전자서명 생성 (공식 문서 방식)
    console.log('🔑 네이버 커머스 API 전자서명 생성 중...')
    
    const bcrypt = require("bcrypt")
    const timestamp = Date.now() // 밀리초 단위 Unix 시간
    
    // 밑줄로 연결하여 password 생성
    const signaturePassword = `${NAVER_COMMERCE_CLIENT_ID}_${timestamp}`
    
    console.log('📝 Password 생성:', signaturePassword)
    console.log('📝 Timestamp:', timestamp)
    
    // bcrypt 해싱 (공식 문서 방식)
    const hashed = bcrypt.hashSync(signaturePassword, NAVER_COMMERCE_CLIENT_SECRET)
    // base64 인코딩
    const client_secret_sign = Buffer.from(hashed, "utf-8").toString("base64")
    
    console.log('🔐 전자서명 생성 완료:', client_secret_sign.substring(0, 30) + '...')

    // OAuth 2.0 토큰 발급
    const authTokenUrl = 'https://api.commerce.naver.com/external/v1/oauth2/token'
    
    const tokenResponse = await fetch(authTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'client_id': NAVER_COMMERCE_CLIENT_ID,
        'timestamp': timestamp.toString(),
        'client_secret_sign': client_secret_sign,
        'grant_type': 'client_credentials',
        'type': 'SELF'
      }),
    })

    console.log('📡 토큰 발급 응답 상태:', tokenResponse.status)

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text()
      console.error('❌ 토큰 발급 실패:', tokenError)
      return NextResponse.json({
        success: false,
        error: '토큰 발급 실패',
        status: tokenResponse.status,
        details: tokenError,
        debug: {
          timestamp,
          signaturePassword,
          client_secret_sign: client_secret_sign.substring(0, 20) + '...'
        }
      }, { status: tokenResponse.status })
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ 토큰 발급 성공:', tokenData.access_token ? '발급됨' : '실패')

    // 2. 주문 조회 API 호출 (토큰 사용)
    const ordersUrl = 'https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders'
    const params = new URLSearchParams({
      startDate: '2024-01-01 00:00:00',
      endDate: '2024-12-31 23:59:59',
      page: '1',
      limit: '10'
    })

    console.log('📡 주문 조회 API 호출 중...')
    
    const ordersResponse = await fetch(`${ordersUrl}?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    })

    console.log('📡 주문 API 응답 상태:', ordersResponse.status)

    if (!ordersResponse.ok) {
      const ordersError = await ordersResponse.text()
      console.error('❌ 주문 조회 실패:', ordersError)
      return NextResponse.json({
        success: false,
        error: '주문 조회 실패',
        status: ordersResponse.status,
        details: ordersError,
        tokenIssued: true
      }, { status: ordersResponse.status })
    }

    const ordersData = await ordersResponse.json()
    
    return NextResponse.json({
      success: true,
      message: '네이버 커머스 API 연결 성공!',
      tokenIssued: true,
      orderCount: ordersData.data?.length || 0,
      orders: ordersData.data || [],
      debug: {
        timestamp,
        tokenLength: tokenData.access_token?.length || 0
      }
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
