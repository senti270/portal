import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { randomUUID } from 'crypto';

// 초대링크 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, employeeName, invitedBy } = body;

    if (!employeeId || !employeeName || !invitedBy) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 고유한 초대 토큰 생성
    const inviteToken = randomUUID();
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/signup?token=${inviteToken}`;

    // 초대 정보를 Firestore에 저장
    const inviteData = {
      token: inviteToken,
      employeeId,
      employeeName,
      invitedBy,
      status: 'pending', // pending, used, expired
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후 만료
    };

    const docRef = await addDoc(collection(db, 'invitations'), inviteData);

    return NextResponse.json({
      success: true,
      inviteUrl,
      token: inviteToken,
      id: docRef.id,
    });
  } catch (error: any) {
    console.error('초대링크 생성 오류:', error);
    return NextResponse.json(
      { error: '초대링크 생성에 실패했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

// 초대링크 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const employeeId = searchParams.get('employeeId');

    if (token) {
      // 토큰으로 초대 정보 조회
      const invitationsSnapshot = await getDocs(
        query(collection(db, 'invitations'), where('token', '==', token))
      );

      if (invitationsSnapshot.empty) {
        return NextResponse.json(
          { error: '유효하지 않은 초대링크입니다.' },
          { status: 404 }
        );
      }

      const inviteData = invitationsSnapshot.docs[0].data();
      
      // 만료 확인
      if (inviteData.expiresAt.toDate() < new Date()) {
        return NextResponse.json(
          { error: '만료된 초대링크입니다.' },
          { status: 400 }
        );
      }

      // 사용 여부 확인
      if (inviteData.status !== 'pending') {
        return NextResponse.json(
          { error: '이미 사용된 초대링크입니다.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        invite: {
          id: invitationsSnapshot.docs[0].id,
          ...inviteData,
          expiresAt: inviteData.expiresAt.toDate().toISOString(),
          createdAt: inviteData.createdAt.toDate().toISOString(),
        },
      });
    } else if (employeeId) {
      // 직원 ID로 초대 목록 조회
      const invitationsSnapshot = await getDocs(
        query(collection(db, 'invitations'), where('employeeId', '==', employeeId))
      );

      const invitations = invitationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        expiresAt: doc.data().expiresAt.toDate().toISOString(),
        createdAt: doc.data().createdAt.toDate().toISOString(),
      }));

      return NextResponse.json({
        success: true,
        invitations,
      });
    } else {
      // 전체 초대 목록 조회 (관리자용)
      const invitationsSnapshot = await getDocs(collection(db, 'invitations'));
      const invitations = invitationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        expiresAt: doc.data().expiresAt.toDate().toISOString(),
        createdAt: doc.data().createdAt.toDate().toISOString(),
      }));

      return NextResponse.json({
        success: true,
        invitations,
      });
    }
  } catch (error: any) {
    console.error('초대링크 조회 오류:', error);
    return NextResponse.json(
      { error: '초대링크 조회에 실패했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

