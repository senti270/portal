import { NextRequest, NextResponse } from 'next/server'

const NAVER_COMMERCE_CLIENT_ID = process.env.NAVER_COMMERCE_CLIENT_ID || ''
const NAVER_COMMERCE_CLIENT_SECRET = process.env.NAVER_COMMERCE_CLIENT_SECRET || ''

// 네이버 커머스 API - 주문 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') // YYYY-MM-DD HH:mm:ss
    const endDate = searchParams.get('endDate')
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

    // 네이버 커머스 API 호출 (올바른 엔드포인트)
    const apiUrl = 'https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders'
    
    const response = await fetch(
      `${apiUrl}?startDate=${startDate}&endDate=${endDate}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Naver-Client-Id': NAVER_COMMERCE_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_COMMERCE_CLIENT_SECRET,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Naver Commerce API Error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch orders', details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // 주문 정보 가공
    const orders = data.data?.lastChangeStatuses || []
    const summary = {
      total: orders.length,
      newOrders: orders.filter((o: any) => o.productOrderStatus === 'PAYED').length,
      preparing: orders.filter((o: any) => o.productOrderStatus === 'DELIVERING').length,
      completed: orders.filter((o: any) => o.productOrderStatus === 'DELIVERED').length,
      cancelled: orders.filter((o: any) => o.productOrderStatus === 'CANCELED').length,
    }

    return NextResponse.json({
      success: true,
      orders,
      summary,
      period: { startDate, endDate }
    })
  } catch (error) {
    console.error('Error fetching Naver orders:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch orders',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

