import { NextRequest, NextResponse } from 'next/server'

const KAKAO_WORK_WEBHOOK_URL = process.env.KAKAO_WORK_WEBHOOK_URL || ''

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, password } = body

    // 관리자 인증
    if (password !== '43084308') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!KAKAO_WORK_WEBHOOK_URL) {
      return NextResponse.json(
        { error: 'Kakao Work Webhook URL not configured' },
        { status: 500 }
      )
    }

    // 카카오워크 Webhook 형식으로 메시지 전송
    const response = await fetch(KAKAO_WORK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: message
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Kakao Work API Error:', errorText)
      return NextResponse.json(
        { error: 'Failed to send message', details: errorText },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Message sent successfully'
    })
  } catch (error) {
    console.error('Error sending Kakao Work message:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

