import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// 사용자 승인 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending, approved, rejected

    let q = query(collection(db, 'userApprovals'));
    
    if (status) {
      q = query(collection(db, 'userApprovals'), where('status', '==', status));
    }

    const snapshot = await getDocs(q);
    const approvals = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      approvals,
    });
  } catch (error: any) {
    console.error('승인 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '승인 목록 조회에 실패했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

// 사용자 승인/거부
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { approvalId, action, employeeId } = body; // action: 'approve' | 'reject'

    if (!approvalId || !action) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const approvalDoc = doc(db, 'userApprovals', approvalId);
    const approvalSnap = await getDoc(approvalDoc);

    if (!approvalSnap.exists()) {
      return NextResponse.json(
        { error: '승인 요청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const approvalData = approvalSnap.data();

    if (action === 'approve') {
      // 승인 처리
      await updateDoc(approvalDoc, {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: body.approvedBy || 'admin',
      });

      // 직원 데이터에 Firebase UID와 카카오 ID 연결
      if (approvalData.employeeId) {
        const employeeDoc = doc(db, 'employees', approvalData.employeeId);
        await updateDoc(employeeDoc, {
          firebaseUid: approvalData.firebaseUid,
          kakaoId: approvalData.kakaoId,
          realName: approvalData.realName,
          updatedAt: new Date(),
        });
      }

      return NextResponse.json({
        success: true,
        message: '승인되었습니다.',
      });
    } else if (action === 'reject') {
      // 거부 처리
      await updateDoc(approvalDoc, {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: body.rejectedBy || 'admin',
        rejectionReason: body.rejectionReason || '',
      });

      return NextResponse.json({
        success: true,
        message: '거부되었습니다.',
      });
    } else {
      return NextResponse.json(
        { error: '잘못된 액션입니다.' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('승인 처리 오류:', error);
    return NextResponse.json(
      { error: '승인 처리에 실패했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

