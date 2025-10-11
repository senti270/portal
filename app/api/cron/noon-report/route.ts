import { NextRequest, NextResponse } from 'next/server'

const KAKAO_WORK_WEBHOOK_URL = process.env.KAKAO_WORK_WEBHOOK_URL || ''

// 매일 낮 12시 실행 - 오전 9시 ~ 낮 12시 변경/추가 주문
export async function GET(request: NextRequest) {
  try {
    // Vercel Cron 인증
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🌤️ 낮 12시 변경사항 리포트 생성 시작...')

    // 시간 계산: 당일 9시 ~ 12시
    const now = new Date()
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0)

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

    // 변경/추가 내역만 필터링 (실제로는 상태 변경 추적 필요)
    const changedOrders = orders // 추후 변경 내역 추적 로직 추가

    // 메시지 포맷팅
    const message = changedOrders.length > 0 ? `
🌤️ **낮 12시 변경사항 리포트**
📅 ${startDateStr.split(' ')[0]} 09:00 ~ 12:00

📊 **변경/추가 주문**
• 총 ${summary.total}건
• 신규 주문: ${summary.newOrders}건
• 상태 변경: ${summary.preparing}건

${changedOrders.length > 0 ? '━━━━━━━━━━━━━━━━' : ''}
${changedOrders.slice(0, 5).map((order: any, index: number) => `
${index + 1}. ${order.productName || '상품명'}
   주문번호: ${order.productOrderId}
   상태: ${order.productOrderStatus}
   금액: ${order.totalPaymentAmount?.toLocaleString()}원
`).join('\n')}
${changedOrders.length > 5 ? `\n... 외 ${changedOrders.length - 5}건` : ''}
    `.trim() : `
🌤️ **낮 12시 변경사항 리포트**
📅 ${startDateStr.split(' ')[0]} 09:00 ~ 12:00

변경/추가된 주문이 없습니다.
    `.trim()

    // 카카오워크로 메시지 전송 (변경사항이 있을 때만)
    if (KAKAO_WORK_WEBHOOK_URL && changedOrders.length > 0) {
      await fetch(KAKAO_WORK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message })
      })
    }

    console.log('✅ 낮 리포트 발송 완료')

    return NextResponse.json({
      success: true,
      message: 'Noon report sent',
      summary,
      hasChanges: changedOrders.length > 0
    })
  } catch (error) {
    console.error('❌ 낮 리포트 오류:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate noon report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

