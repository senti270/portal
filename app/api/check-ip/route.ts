import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 요청자의 IP 주소 가져오기
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    
    // Vercel에서 실제 IP 찾기
    const clientIp = cfConnectingIp || realIp || forwarded?.split(',')[0] || 'unknown';
    
    // 모든 헤더 정보도 함께 반환
    const headers = Object.fromEntries(request.headers.entries());
    
    return NextResponse.json({
      success: true,
      clientIp,
      allHeaders: headers,
      message: '이 IP 주소를 네이버 API 호출 IP에 등록하세요'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'IP 확인 실패',
      details: error
    }, { status: 500 });
  }
}
