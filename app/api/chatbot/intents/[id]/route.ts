import { NextRequest, NextResponse } from 'next/server'
import { getIntent, updateIntent, deleteIntent } from '@/lib/chatbot-intents-firestore'

const ADMIN_PASSWORD = '43084308'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await getIntent(id)
    if (!item) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, item })
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Failed to fetch intent' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { password, data } = body
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 401 })
    }
    await updateIntent(id, data)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Failed to update intent' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const password = searchParams.get('password') || ''
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 401 })
    }
    await deleteIntent(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Failed to delete intent' }, { status: 500 })
  }
}


