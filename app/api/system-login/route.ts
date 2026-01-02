import { NextRequest, NextResponse } from 'next/server'
import { getSystemLogins, addSystemLogin } from '@/lib/system-login-firestore'
import { SystemLoginFormData } from '@/types/system-login'
import { getStore } from '@/lib/manual-firestore'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const systemName = searchParams.get('systemName')

    let logins
    if (storeId && systemName) {
      const { getSystemLoginsByStoreAndSystem } = await import('@/lib/system-login-firestore')
      logins = await getSystemLoginsByStoreAndSystem(storeId, systemName)
    } else {
      logins = await getSystemLogins()
    }

    return NextResponse.json({ success: true, data: logins })
  } catch (error) {
    console.error('시스템 로그인 정보 조회 실패:', error)
    return NextResponse.json(
      { error: '시스템 로그인 정보를 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const loginId = await addSystemLogin(
      { storeId, systemName, username, password, note },
      store.name
    )

    return NextResponse.json({ success: true, id: loginId })
  } catch (error) {
    console.error('시스템 로그인 정보 추가 실패:', error)
    return NextResponse.json(
      { error: '시스템 로그인 정보 추가에 실패했습니다.' },
      { status: 500 }
    )
  }
}

