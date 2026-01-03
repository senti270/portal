import { NextRequest, NextResponse } from 'next/server'
import { getManual, updateManual, deleteManual } from '@/lib/manual-firestore'
import { ManualFormData } from '@/types/manual'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const manual = await getManual(id)
    
    if (!manual) {
      return NextResponse.json({ error: '매뉴얼을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: manual })
  } catch (error) {
    console.error('매뉴얼 조회 실패:', error)
    return NextResponse.json({ error: '매뉴얼 조회에 실패했습니다.' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, content, storeTags } = body as ManualFormData

    if (!title || !content || !storeTags || storeTags.length === 0) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 })
    }

    const manualData: ManualFormData = { title, content, storeTags }
    await updateManual(id, manualData)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('매뉴얼 수정 실패:', error)
    return NextResponse.json({ error: '매뉴얼 수정에 실패했습니다.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteManual(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('매뉴얼 삭제 실패:', error)
    return NextResponse.json({ error: '매뉴얼 삭제에 실패했습니다.' }, { status: 500 })
  }
}
