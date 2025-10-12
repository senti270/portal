import { NextRequest, NextResponse } from 'next/server'
import { getStores, addStore } from '@/lib/manual-firestore'
import { StoreFormData } from '@/types/manual'

export async function GET() {
  try {
    const stores = await getStores()
    return NextResponse.json({ success: true, data: stores })
  } catch (error) {
    console.error('지점 목록 조회 실패:', error)
    return NextResponse.json({ error: '지점 목록을 불러오는데 실패했습니다.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name } = body as StoreFormData

    if (!name || !name.trim()) {
      return NextResponse.json({ error: '지점명이 필요합니다.' }, { status: 400 })
    }

    const storeData: StoreFormData = { name: name.trim() }
    const storeId = await addStore(storeData)

    return NextResponse.json({ success: true, id: storeId })
  } catch (error) {
    console.error('지점 추가 실패:', error)
    return NextResponse.json({ error: '지점 추가에 실패했습니다.' }, { status: 500 })
  }
}
