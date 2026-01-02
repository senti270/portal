import { NextRequest, NextResponse } from 'next/server'

const NAVER_COMMERCE_CLIENT_ID = process.env.NAVER_COMMERCE_CLIENT_ID || ''
const NAVER_COMMERCE_CLIENT_SECRET = process.env.NAVER_COMMERCE_CLIENT_SECRET || ''

// 네이버 커머스 API 디버깅
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

    // 다양한 날짜 범위로 테스트
    const dateRanges = [
      { start: '2024-01-01 00:00:00', end: '2024-12-31 23:59:59', desc: '올해 전체' },
      { start: '2024-10-01 00:00:00', end: '2024-10-31 23:59:59', desc: '10월' },
      { start: '2024-10-11 00:00:00', end: '2024-10-11 23:59:59', desc: '오늘' },
      { start: '2023-01-01 00:00:00', end: '2023-12-31 23:59:59', desc: '작년 전체' }
    ]

    const results = []

    for (const range of dateRanges) {
      console.log(`📅 ${range.desc} 기간 테스트: ${range.start} ~ ${range.end}`)
      
      try {
        const apiUrl = 'https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders'
        const params = new URLSearchParams({
          startDate: range.start,
          endDate: range.end,
          page: '1',
          limit: '10'
        })
        
        const response = await fetch(`${apiUrl}?${params}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Naver-Client-Id': NAVER_COMMERCE_CLIENT_ID,
            'X-Naver-Client-Secret': NAVER_COMMERCE_CLIENT_SECRET,
          },
        })

        console.log(`📡 ${range.desc} 응답 상태:`, response.status)

        if (response.ok) {
          const data = await response.json()
          results.push({
            period: range.desc,
            status: response.status,
            success: true,
            orderCount: data.data?.length || 0,
            data: data
          })
          
          // 주문이 있으면 해당 기간으로 중단
          if (data.data && data.data.length > 0) {
            break
          }
        } else {
          const errorText = await response.text()
          results.push({
            period: range.desc,
            status: response.status,
            success: false,
            error: errorText
          })
        }
      } catch (error) {
        results.push({
          period: range.desc,
          status: 'ERROR',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successfulResult = results.find(r => r.success && r.orderCount > 0)
    
    if (successfulResult) {
      return NextResponse.json({
        success: true,
        message: `주문 데이터 발견! (${successfulResult.period})`,
        workingPeriod: successfulResult.period,
        orderCount: successfulResult.orderCount,
        data: successfulResult.data,
        allResults: results
      })
    } else {
      return NextResponse.json({
        success: false,
        error: '모든 기간에서 주문 데이터 없음 또는 권한 오류',
        results: results,
        suggestion: '네이버 개발자 센터에서 API 권한을 확인하거나 스마트스토어에 실제 주문이 있는지 확인하세요'
      }, { status: 404 })
    }

  } catch (error) {
    console.error('❌ 네이버 커머스 API 디버깅 실패:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'API 디버깅 실패',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}






