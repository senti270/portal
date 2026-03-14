import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAdminAuth } from '@/lib/firebase-admin';

/**
 * 승인된 카카오 회원의 Firebase Auth 비밀번호를 로그인용 값(kakao_${kakaoId}_temp)으로 맞춤.
 * 가입 시 예전에 timestamp 비밀번호로 생성된 계정이 로그인 실패할 때 호출.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firebaseUid, kakaoId } = body as { firebaseUid?: string; kakaoId?: string };

    if (!firebaseUid && !kakaoId) {
      return NextResponse.json(
        { success: false, error: 'firebaseUid 또는 kakaoId가 필요합니다.' },
        { status: 400 }
      );
    }

    const q = kakaoId
      ? query(collection(db, 'userApprovals'), where('kakaoId', '==', String(kakaoId)))
      : query(collection(db, 'userApprovals'), where('firebaseUid', '==', firebaseUid));
    const snapshot = await getDocs(q);
    const approved = snapshot.docs.find((d) => d.data().status === 'approved');
    if (!approved) {
      return NextResponse.json(
        { success: false, error: '승인된 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const data = approved.data();
    const uid = (data.firebaseUid || firebaseUid) as string;
    const kid = (data.kakaoId || kakaoId) as string;
    if (!uid || !kid) {
      return NextResponse.json(
        { success: false, error: '승인 데이터에 firebaseUid 또는 kakaoId가 없습니다.' },
        { status: 400 }
      );
    }

    const newPassword = `kakao_${kid}_temp`;
    const auth = getAdminAuth();
    await auth.updateUser(uid, { password: newPassword });

    return NextResponse.json({ success: true, message: '비밀번호가 설정되었습니다.' });
  } catch (error: any) {
    console.error('reset-kakao-password 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || '비밀번호 설정에 실패했습니다.',
        code: error?.code,
      },
      { status: 500 }
    );
  }
}
