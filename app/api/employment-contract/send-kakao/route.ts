import { NextRequest, NextResponse } from 'next/server'

// 카카오톡 알림톡 전송 API
// 비즈 앱 전환 및 알림톡 템플릿 등록 완료 후 사용 가능

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

    const restApiKey = process.env.KAKAO_REST_API_KEY
    const templateId = process.env.KAKAO_TALK_TEMPLATE_ID

    if (!restApiKey) {
      console.error('KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.')
      return NextResponse.json(
        { 
          success: false, 
          error: '카카오톡 API 설정이 완료되지 않았습니다. 관리자에게 문의하세요.' 
        },
        { status: 500 }
      )
    }

    // 템플릿 ID가 없으면 준비 중 상태로 반환
    if (!templateId) {
      console.log('카카오톡 전송 요청 (템플릿 ID 대기 중):', {
        phoneNumber,
        contractUrl,
        employeeName
      })
      
      return NextResponse.json({
        success: true,
        message: '카카오톡 전송 기능은 준비 중입니다.',
        note: '알림톡 템플릿 등록 및 템플릿 ID 설정이 필요합니다.'
      })
    }

    // 알림톡 전송 API 호출
    // 참고: 실제 전송을 위해서는 카카오톡 비즈니스 API의 인증 토큰이 필요합니다.
    // 현재는 구조만 준비 (템플릿 ID 설정 후 활성화)
    
    try {
      // TODO: 카카오톡 비즈니스 API 인증 토큰 발급 필요
      // 1. Admin Key로 액세스 토큰 발급
      // 2. 액세스 토큰으로 알림톡 전송
      
      // 예시 API 호출 구조 (실제 구현은 템플릿 ID 확인 후)
      /*
      const accessToken = await getKakaoAccessToken(restApiKey)
      
      const response = await fetch('https://kapi.kakao.com/v2/api/talk/memo/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          template_id: templateId,
          template_args: JSON.stringify({
            employeeName: employeeName || '근로자',
            contractUrl: contractUrl
          }),
          receiver_uuids: JSON.stringify([phoneNumber])
        })
      })
      
      const result = await response.json()
      */
      
      console.log('카카오톡 알림톡 전송 준비 완료:', {
        phoneNumber,
        contractUrl,
        employeeName,
        templateId
      })

      // 현재는 준비 완료 상태로 반환 (템플릿 ID 확인 후 실제 전송 활성화)
      return NextResponse.json({
        success: true,
        message: '카카오톡 전송 준비 완료',
        note: '템플릿 ID가 설정되었습니다. 비즈 앱 전환 완료 후 실제 전송이 가능합니다.'
      })
    } catch (apiError) {
      console.error('카카오톡 API 호출 오류:', apiError)
      return NextResponse.json(
        { 
          success: false, 
          error: '카카오톡 API 호출 중 오류가 발생했습니다.',
          details: apiError instanceof Error ? apiError.message : '알 수 없는 오류'
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('❌ 카카오톡 전송 API 오류:', error)
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error('오류 상세:', {
      errorMessage,
      errorStack
    })
    
    return NextResponse.json(
      { 
        success: false, 
        error: '카카오톡 전송 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

