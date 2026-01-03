import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, deleteDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    
    // 1. userPermissions 삭제
    const userPermissionRef = doc(db, 'userPermissions', userId);
    const permissionSnapshot = await getDoc(userPermissionRef);
    if (permissionSnapshot.exists()) {
      await deleteDoc(userPermissionRef);
      console.log(`userPermissions 삭제 완료: ${userId}`);
    }
    
    // 2. employees의 firebaseUid 제거
    const employeesSnapshot = await getDocs(
      query(collection(db, 'employees'), where('firebaseUid', '==', userId))
    );
    
    for (const employeeDoc of employeesSnapshot.docs) {
      await updateDoc(doc(db, 'employees', employeeDoc.id), {
        firebaseUid: null,
        updatedAt: new Date(),
      });
      console.log(`employees firebaseUid 제거 완료: ${employeeDoc.id}`);
    }
    
    // 3. userApprovals에서 상태 업데이트
    const approvalsSnapshot = await getDocs(
      query(collection(db, 'userApprovals'), where('firebaseUid', '==', userId))
    );
    
    for (const approvalDoc of approvalsSnapshot.docs) {
      await updateDoc(doc(db, 'userApprovals', approvalDoc.id), {
        status: 'rejected',
        rejectionReason: '시스템에서 탈퇴 처리됨',
        rejectedAt: new Date(),
      });
      console.log(`userApprovals 상태 업데이트 완료: ${approvalDoc.id}`);
    }
    
    // 참고: Firebase Auth 계정 삭제는 Admin SDK가 필요합니다.
    // 현재는 Firestore 데이터만 정리하고, Auth 계정은 Firebase Console에서 수동 삭제해야 할 수 있습니다.
    
    return NextResponse.json({
      success: true,
      message: '사용자가 탈퇴 처리되었습니다. (Firestore 데이터 정리 완료)',
    });
  } catch (error: any) {
    console.error('사용자 탈퇴 처리 오류:', error);
    return NextResponse.json(
      { success: false, error: '사용자 탈퇴 처리에 실패했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

