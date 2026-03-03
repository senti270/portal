import { NextRequest, NextResponse } from 'next/server'

// 카카오톡 메시지 전송 API
// TODO: 실제 카카오톡 비즈니스 API 또는 알림톡 API 연동 필요
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneNumber, contractUrl, employeeName } = body

    if (!phoneNumber || !contractUrl) {
      return NextResponse.json(
        { success: false, error: '전화번호와 계약서 URL이 필요합니다.' },
        { status: 400 }
      )
    }

    // TODO: 카카오톡 API 연동
    // 현재는 로그만 출력
    console.log('카카오톡 전송 요청:', {
      phoneNumber,
      contractUrl,
      employeeName
    })

    // 실제 구현 시:
    // 1. 카카오톡 비즈니스 API 또는 알림톡 API 사용
    // 2. 또는 카카오톡 링크 공유 API 사용
    // 3. 메시지 템플릿: "근로계약서가 작성되었습니다. 아래 링크에서 확인하세요: {contractUrl}"

    return NextResponse.json({
      success: true,
      message: '카카오톡 전송 기능은 준비 중입니다.'
    })
  } catch (error) {
    console.error('카카오톡 전송 오류:', error)
    return NextResponse.json(
      { success: false, error: '카카오톡 전송 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

