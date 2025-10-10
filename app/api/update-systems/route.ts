import { NextRequest, NextResponse } from 'next/server'
import { updateSystemsFile } from '@/utils/githubApi'

export async function POST(request: NextRequest) {
  try {
    const { systems } = await request.json()
    
    if (!systems || !Array.isArray(systems)) {
      return NextResponse.json({ error: 'Invalid systems data' }, { status: 400 })
    }

    // GitHub 파일 업데이트
    await updateSystemsFile(systems)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update systems error:', error)
    return NextResponse.json({ error: 'Failed to update systems' }, { status: 500 })
  }
}
