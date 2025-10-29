import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('🧪 Test Geocode API called')
  
  try {
    const { address } = await request.json()
    console.log('📍 Test Address:', address)

    // 임시로 성공 응답 반환
    return NextResponse.json({
      success: true,
      latitude: 37.123456,
      longitude: 127.123456,
      address: address || 'test address'
    })
  } catch (error) {
    console.error('❌ Test API Error:', error)
    return NextResponse.json(
      { error: 'Test API 오류', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}




