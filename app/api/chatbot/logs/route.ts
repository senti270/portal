import { NextRequest, NextResponse } from 'next/server'
import { getChatMessages } from '@/lib/chatbot-firestore'

const ADMIN_PASSWORD = '43084308'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const password = searchParams.get('password') || ''
    const limitParam = Number(searchParams.get('limit') || '50')
    const sessionId = searchParams.get('sessionId') || undefined
    const sinceParam = searchParams.get('since')

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 401 })
    }

    const limit = isNaN(limitParam) ? 50 : Math.max(1, Math.min(200, limitParam))
    const since = sinceParam ? new Date(sinceParam) : undefined

    const items = await getChatMessages({ limit, sessionId, since })
    return NextResponse.json({ success: true, count: items.length, messages: items })
  } catch (error) {
    console.error('챗봇 로그 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch chat logs' },
      { status: 500 }
    )
  }
}


