import { NextRequest, NextResponse } from 'next/server'
import {
  getSystemLogin,
  updateSystemLogin,
  deleteSystemLogin
} from '@/lib/system-login-firestore'
import { SystemLoginFormData } from '@/types/system-login'
import { getStore } from '@/lib/manual-firestore'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const login = await getSystemLogin(params.id)
    
    if (!login) {
      return NextResponse.json(
        { error: '시스템 로그인 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: login })
  } catch (error) {
    console.error('시스템 로그인 정보 조회 실패:', error)
    return NextResponse.json(
      { error: '시스템 로그인 정보를 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { storeId, systemName, username, password, note } = body as SystemLoginFormData

    if (!storeId || !systemName || !username || !password) {
      return NextResponse.json(
        { error: '필수 항목을 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    const store = await getStore(storeId)
    if (!store) {
      return NextResponse.json(
        { error: '지점을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    await updateSystemLogin(
      params.id,
      { storeId, systemName, username, password, note },
      store.name
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('시스템 로그인 정보 수정 실패:', error)
    return NextResponse.json(
      { error: '시스템 로그인 정보 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteSystemLogin(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('시스템 로그인 정보 삭제 실패:', error)
    return NextResponse.json(
      { error: '시스템 로그인 정보 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}

