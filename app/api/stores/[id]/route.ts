import { NextRequest, NextResponse } from 'next/server'
import { getStore, updateStore, deleteStore } from '@/lib/manual-firestore'
import { StoreFormData } from '@/types/manual'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const store = await getStore(params.id)
    
    if (!store) {
      return NextResponse.json({ error: '지점을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: store })
  } catch (error) {
    console.error('지점 조회 실패:', error)
    return NextResponse.json({ error: '지점 조회에 실패했습니다.' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name } = body as StoreFormData

    if (!name || !name.trim()) {
      return NextResponse.json({ error: '지점명이 필요합니다.' }, { status: 400 })
    }

    const storeData: StoreFormData = { name: name.trim() }
    await updateStore(params.id, storeData)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('지점 수정 실패:', error)
    return NextResponse.json({ error: '지점 수정에 실패했습니다.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteStore(params.id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('지점 삭제 실패:', error)
    return NextResponse.json({ 
      error: error.message || '지점 삭제에 실패했습니다.' 
    }, { status: 500 })
  }
}
