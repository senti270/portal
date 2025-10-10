import { NextRequest, NextResponse } from 'next/server'
import { getDeposits } from '@/lib/todo-firestore'

// Android 위젯 전용 API - 입금 요청 요약 정보
export async function GET(request: NextRequest) {
  try {
    const deposits = await getDeposits()
    
    // 미완료 입금만 필터링
    const incompleteDeposits = deposits.filter(deposit => !deposit.isCompleted)
    
    // 위젯용 요약 데이터
    const totalAmount = incompleteDeposits.reduce((sum, d) => sum + d.amount, 0)
    const recentDeposits = incompleteDeposits.slice(0, 3).map(deposit => ({
      id: deposit.id,
      companyName: deposit.companyName.length > 15 ? deposit.companyName.substring(0, 15) + '...' : deposit.companyName,
      amount: deposit.amount.toLocaleString(),
      requester: deposit.requester
    }))

    return NextResponse.json({
      success: true,
      deposits: recentDeposits,
      totalCount: deposits.length,
      incompleteCount: incompleteDeposits.length,
      totalAmount: totalAmount.toLocaleString(),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Widget API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Widget API failed' },
      { status: 500 }
    )
  }
}
