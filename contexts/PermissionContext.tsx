'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserPermission, SystemId, PermissionLevel, hasPermission } from '@/lib/permissions';

interface PermissionContextType {
  permissions: UserPermission | null;
  loading: boolean;
  hasSystemPermission: (systemId: SystemId, requiredLevel?: PermissionLevel) => boolean;
  getUserPermission: (systemId: SystemId) => PermissionLevel;
  isSuperAdmin: boolean;
  isAdmin: boolean;
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
          setPermissions({
            userId: user.uid,
            email: user.email || undefined,
            name: data.name || undefined,
            permissions: data.permissions || {},
            role: data.role || 'user',
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as UserPermission);
        } else {
          // 권한이 없으면 기본 권한 생성
          const defaultPermission: UserPermission = {
            userId: user.uid,
            email: user.email || undefined,
            permissions: {},
            role: 'user',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          setPermissions(defaultPermission);
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
    
    // super_admin은 모든 권한
    if (permissions.role === 'super_admin') return true;
    
    // admin은 대부분 권한 (특정 시스템 제외 가능)
    if (permissions.role === 'admin') {
      // 특정 시스템에 명시적으로 'none'이 설정된 경우만 제외
      const systemPermission = permissions.permissions[systemId];
      if (systemPermission === 'none') return false;
      return true;
    }
    
    // 일반 사용자는 개별 권한 확인
    const userPermission = permissions.permissions[systemId];
    return hasPermission(userPermission, requiredLevel);
  };

  const getUserPermission = (systemId: SystemId): PermissionLevel => {
    if (!permissions) return 'none';
    
    if (permissions.role === 'super_admin') return 'admin';
    if (permissions.role === 'admin') {
      const systemPermission = permissions.permissions[systemId];
      return systemPermission === 'none' ? 'none' : 'admin';
    }
    
    return permissions.permissions[systemId] || 'none';
  };

  const isSuperAdmin = permissions?.role === 'super_admin';
  const isAdmin = permissions?.role === 'admin' || isSuperAdmin;

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        loading,
        hasSystemPermission,
        getUserPermission,
        isSuperAdmin,
        isAdmin,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

