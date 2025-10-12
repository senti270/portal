import { NextRequest, NextResponse } from 'next/server'
import { getManuals, addManual } from '@/lib/manual-firestore'
import { ManualFormData } from '@/types/manual'

export async function GET() {
  try {
    const manuals = await getManuals()
    return NextResponse.json({ success: true, data: manuals })
  } catch (error) {
    console.error('매뉴얼 목록 조회 실패:', error)
    return NextResponse.json({ error: '매뉴얼 목록을 불러오는데 실패했습니다.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, content, storeTags, createdBy } = body as ManualFormData & { createdBy: string }

    if (!title || !content || !storeTags || storeTags.length === 0) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 })
    }

    const manualData: ManualFormData = { title, content, storeTags }
    const manualId = await addManual(manualData, createdBy)

    return NextResponse.json({ success: true, id: manualId })
  } catch (error) {
    console.error('매뉴얼 추가 실패:', error)
    return NextResponse.json({ error: '매뉴얼 추가에 실패했습니다.' }, { status: 500 })
  }
}
