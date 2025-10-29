import { NextRequest, NextResponse } from 'next/server'
import { listIntents, createIntent } from '@/lib/chatbot-intents-firestore'

const ADMIN_PASSWORD = '43084308'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const password = searchParams.get('password') || ''
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 401 })
    }
    const items = await listIntents()
    return NextResponse.json({ success: true, items })
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Failed to fetch intents' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { password, data } = body
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 401 })
    }
    const id = await createIntent(data)
    return NextResponse.json({ success: true, id })
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Failed to create intent' }, { status: 500 })
  }
}


