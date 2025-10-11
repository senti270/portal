import { NextRequest, NextResponse } from 'next/server'

const KAKAO_WORK_WEBHOOK_URL = process.env.KAKAO_WORK_WEBHOOK_URL || ''

// 매일 오전 9시 실행 - 전일 12시 ~ 당일 9시 주문 내역
export async function GET(request: NextRequest) {
  try {
    // Vercel Cron 인증 (선택적)
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🌅 오전 9시 주문 리포트 생성 시작...')

    // 시간 계산: 전일 12시 ~ 당일 9시
    const now = new Date()
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0)
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 1)
    startDate.setHours(12, 0, 0)

    const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' ')
    const endDateStr = endDate.toISOString().slice(0, 19).replace('T', ' ')

    console.log('📅 조회 기간:', startDateStr, '~', endDateStr)

    // 네이버 주문 조회
    const ordersResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/naver-commerce/orders?startDate=${encodeURIComponent(startDateStr)}&endDate=${encodeURIComponent(endDateStr)}&password=43084308`,
      { method: 'GET' }
    )

    if (!ordersResponse.ok) {
      throw new Error('Failed to fetch orders')
    }

    const ordersData = await ordersResponse.json()
    const { orders, summary } = ordersData

    // 메시지 포맷팅
    const message = `
🌅 **오전 9시 주문 리포트**
📅 ${startDateStr.split(' ')[0]} 12:00 ~ ${endDateStr.split(' ')[0]} 09:00

📊 **주문 요약**
• 총 주문: ${summary.total}건
• 신규 주문: ${summary.newOrders}건
• 배송 준비: ${summary.preparing}건
• 배송 완료: ${summary.completed}건
• 취소: ${summary.cancelled}건

${orders.length > 0 ? '━━━━━━━━━━━━━━━━' : ''}
${orders.slice(0, 5).map((order: any, index: number) => `
${index + 1}. ${order.productName || '상품명'}
   주문번호: ${order.productOrderId}
   상태: ${order.productOrderStatus}
   금액: ${order.totalPaymentAmount?.toLocaleString()}원
`).join('\n')}
${orders.length > 5 ? `\n... 외 ${orders.length - 5}건` : ''}
    `.trim()

    // 카카오워크로 메시지 전송
    if (KAKAO_WORK_WEBHOOK_URL) {
      await fetch(KAKAO_WORK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message })
      })
    }

    // Firebase에 로그 저장 (선택적)
    // await saveReportLog('morning', summary, orders)

    console.log('✅ 오전 리포트 발송 완료')

    return NextResponse.json({
      success: true,
      message: 'Morning report sent',
      summary
    })
  } catch (error) {
    console.error('❌ 오전 리포트 오류:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate morning report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

