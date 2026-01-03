import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserPermission } from '@/lib/permissions';

// 사용자 권한 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    
    const userPermissionRef = doc(db, 'userPermissions', userId);
    const snapshot = await getDoc(userPermissionRef);
    
    if (!snapshot.exists()) {
      return NextResponse.json(
        { error: '권한 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    const data = snapshot.data();
    const permission: UserPermission = {
      userId,
      email: data.email,
      name: data.name,
      permissions: data.permissions || {},
      role: data.role || 'user',
      allowedBranches: data.allowedBranches || [],
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
    
    return NextResponse.json({
      success: true,
      permission,
    });
  } catch (error: any) {
    console.error('권한 조회 오류:', error);
    return NextResponse.json(
      { error: '권한 조회에 실패했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

// 사용자 권한 생성/업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const body = await request.json();
    const { permissions, role, name, email, allowedBranches } = body;
    
    if (!permissions && !role) {
      return NextResponse.json(
        { error: '권한 또는 역할 정보가 필요합니다.' },
        { status: 400 }
      );
    }
    
    const userPermissionRef = doc(db, 'userPermissions', userId);
    const snapshot = await getDoc(userPermissionRef);
    
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (permissions) {
      updateData.permissions = permissions;
    }
    
    if (role) {
      updateData.role = role;
    }
    
    if (name) {
      updateData.name = name;
    }
    
    if (email) {
      updateData.email = email;
    }
    
    if (allowedBranches !== undefined) {
      updateData.allowedBranches = allowedBranches;
    }
    
    if (snapshot.exists()) {
      // 기존 문서 업데이트
      await updateDoc(userPermissionRef, updateData);
    } else {
      // 새 문서 생성
      await setDoc(userPermissionRef, {
        userId,
        email: email || '',
        name: name || '',
        permissions: permissions || {},
        role: role || 'user',
        allowedBranches: allowedBranches || [],
        createdAt: new Date(),
        ...updateData,
      });
    }
    
    return NextResponse.json({
      success: true,
      message: '권한이 업데이트되었습니다.',
    });
  } catch (error: any) {
    console.error('권한 업데이트 오류:', error);
    return NextResponse.json(
      { error: '권한 업데이트에 실패했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

// 사용자 권한 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    
    const userPermissionRef = doc(db, 'userPermissions', userId);
    const snapshot = await getDoc(userPermissionRef);
    
    if (!snapshot.exists()) {
      return NextResponse.json(
        { error: '권한 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    // Firestore에서 문서 삭제
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(userPermissionRef);
    
    return NextResponse.json({
      success: true,
      message: '권한이 삭제되었습니다.',
    });
  } catch (error: any) {
    console.error('권한 삭제 오류:', error);
    return NextResponse.json(
      { error: '권한 삭제에 실패했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

