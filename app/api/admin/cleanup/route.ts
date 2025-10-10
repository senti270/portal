import { NextRequest, NextResponse } from 'next/server'
import { getSystems, deleteSystem } from '@/lib/firestore'

export async function POST(request: NextRequest) {
  try {
    // 보안: 관리자만 접근 가능하도록 비밀번호 확인
    const { password } = await request.json()
    
    if (password !== '43084308') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🧹 Firebase Systems 컬렉션 정리 시작...')
    
    const existingSystems = await getSystems()
    console.log(`📊 총 ${existingSystems.length}개 문서 발견`)
    
    let deletedCount = 0
    let errorCount = 0
    
    for (const system of existingSystems) {
      try {
        await deleteSystem(system.id)
        deletedCount++
        console.log(`✅ 삭제됨: ${system.title}`)
      } catch (error) {
        errorCount++
        console.error(`❌ 삭제 실패: ${system.id}`, error)
      }
    }
    
    console.log(`🧹 정리 완료: ${deletedCount}개 삭제, ${errorCount}개 오류`)
    
    return NextResponse.json({
      success: true,
      message: `Systems 컬렉션 정리 완료: ${deletedCount}개 삭제`,
      deletedCount,
      errorCount,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Cleanup API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Cleanup failed' },
      { status: 500 }
    )
  }
}
