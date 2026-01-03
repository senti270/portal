'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserPermission, SystemId, PermissionLevel, hasPermission, UserRole } from '@/lib/permissions';

interface PermissionContextType {
  permissions: UserPermission | null;
  loading: boolean;
  hasSystemPermission: (systemId: SystemId, requiredLevel?: PermissionLevel) => boolean;
  getUserPermission: (systemId: SystemId) => PermissionLevel;
  canAccessBranch: (branchId: string) => boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isMaster: boolean;
  isDeputyMaster: boolean;
  isBranchManager: boolean;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionProvider');
  }
  return context;
}

interface PermissionProviderProps {
  children: ReactNode;
  user: User | null;
}

export function PermissionProvider({ children, user }: PermissionProviderProps) {
  const [permissions, setPermissions] = useState<UserPermission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    // Firestore에서 사용자 권한 로드
    const userPermissionRef = doc(db, 'userPermissions', user.uid);
    
    const unsubscribe = onSnapshot(
      userPermissionRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          // drawing555@naver.com은 항상 master 권한
          const userRole = user.email === 'drawing555@naver.com' ? 'master' : (data.role || 'user');
          setPermissions({
            userId: user.uid,
            email: user.email || undefined,
            name: data.name || undefined,
            permissions: data.permissions || {},
            role: userRole,
            allowedBranches: data.allowedBranches || [],
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as UserPermission);
        } else {
          // drawing555@naver.com은 항상 master 권한
          const defaultRole = user.email === 'drawing555@naver.com' ? 'master' : 'user';
          const defaultPermission: UserPermission = {
            userId: user.uid,
            email: user.email || undefined,
            permissions: {},
            role: defaultRole,
            allowedBranches: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          setPermissions(defaultPermission);
          
          // drawing555@naver.com이면 자동으로 권한 문서 생성
          if (user.email === 'drawing555@naver.com') {
            import('firebase/firestore').then(({ setDoc }) => {
              setDoc(userPermissionRef, {
                userId: user.uid,
                email: user.email,
                name: '마스터',
                permissions: {},
                role: 'master',
                allowedBranches: [],
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }).catch(console.error);
          }
        }
        setLoading(false);
      },
      (error) => {
        console.error('권한 로드 오류:', error);
        setPermissions(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const hasSystemPermission = (
    systemId: SystemId,
    requiredLevel: PermissionLevel = 'read'
  ): boolean => {
    if (!permissions) return false;
    
    // super_admin과 master는 모든 권한
    if (permissions.role === 'super_admin' || permissions.role === 'master') return true;
    
    // admin, deputy_master는 대부분 권한 (특정 시스템 제외 가능)
    if (permissions.role === 'admin' || permissions.role === 'deputy_master') {
      // 특정 시스템에 명시적으로 'none'이 설정된 경우만 제외
      const systemPermission = permissions.permissions[systemId];
      if (systemPermission === 'none') return false;
      return true;
    }
    
    // 일반 사용자는 개별 권한 확인
    const userPermission = permissions.permissions[systemId];
    return hasPermission(userPermission, requiredLevel);
  };

  // 지점 접근 권한 확인
  const canAccessBranch = (branchId: string): boolean => {
    if (!permissions) return false;
    
    // master, super_admin은 모든 지점 접근 가능
    if (permissions.role === 'master' || permissions.role === 'super_admin') return true;
    
    // deputy_master도 모든 지점 접근 가능
    if (permissions.role === 'deputy_master') return true;
    
    // allowedBranches가 없거나 비어있으면 모든 지점 접근 가능
    if (!permissions.allowedBranches || permissions.allowedBranches.length === 0) {
      return true;
    }
    
    // allowedBranches에 포함된 지점만 접근 가능
    return permissions.allowedBranches.includes(branchId);
  };

  const getUserPermission = (systemId: SystemId): PermissionLevel => {
    if (!permissions) return 'none';
    
    if (permissions.role === 'super_admin' || permissions.role === 'master') return 'admin';
    if (permissions.role === 'admin' || permissions.role === 'deputy_master') {
      const systemPermission = permissions.permissions[systemId];
      return systemPermission === 'none' ? 'none' : 'admin';
    }
    
    return permissions.permissions[systemId] || 'none';
  };

  const isSuperAdmin = permissions?.role === 'super_admin';
  const isMaster = permissions?.role === 'master';
  const isDeputyMaster = permissions?.role === 'deputy_master';
  const isBranchManager = permissions?.role === 'branch_manager';
  const isAdmin = permissions?.role === 'admin' || isSuperAdmin || isMaster || isDeputyMaster;

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        loading,
        hasSystemPermission,
        getUserPermission,
        canAccessBranch,
        isSuperAdmin,
        isAdmin,
        isMaster,
        isDeputyMaster,
        isBranchManager,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

