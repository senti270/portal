// 권한 관리 유틸리티

export type SystemId = 
  | 'work-schedule'
  | 'purchase'
  | 'naver-ranking'
  | 'naver-refund'
  | 'ranking-tracker'
  | 'manual-management'
  | 'chatbot-management'
  | 'system-login';

export type PermissionLevel = 'none' | 'read' | 'write' | 'admin';

export interface UserPermission {
  userId: string; // Firebase UID
  email?: string;
  name?: string;
  permissions: {
    [systemId in SystemId]?: PermissionLevel;
  };
  role?: 'super_admin' | 'admin' | 'user'; // 전체 권한 레벨
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemPermission {
  systemId: SystemId;
  defaultPermission: PermissionLevel; // 기본 권한 (권한이 없을 때)
  requiredPermission: PermissionLevel; // 접근에 필요한 최소 권한
}

// 시스템별 기본 권한 설정
export const systemPermissions: Record<SystemId, SystemPermission> = {
  'work-schedule': {
    systemId: 'work-schedule',
    defaultPermission: 'none',
    requiredPermission: 'read',
  },
  'purchase': {
    systemId: 'purchase',
    defaultPermission: 'read',
    requiredPermission: 'read',
  },
  'naver-ranking': {
    systemId: 'naver-ranking',
    defaultPermission: 'read',
    requiredPermission: 'read',
  },
  'naver-refund': {
    systemId: 'naver-refund',
    defaultPermission: 'read',
    requiredPermission: 'read',
  },
  'ranking-tracker': {
    systemId: 'ranking-tracker',
    defaultPermission: 'read',
    requiredPermission: 'read',
  },
  'manual-management': {
    systemId: 'manual-management',
    defaultPermission: 'read',
    requiredPermission: 'read',
  },
  'chatbot-management': {
    systemId: 'chatbot-management',
    defaultPermission: 'none',
    requiredPermission: 'read',
  },
  'system-login': {
    systemId: 'system-login',
    defaultPermission: 'none',
    requiredPermission: 'read',
  },
};

// 권한 레벨 비교 함수
export function hasPermission(
  userPermission: PermissionLevel | undefined,
  requiredPermission: PermissionLevel
): boolean {
  const permissionOrder: PermissionLevel[] = ['none', 'read', 'write', 'admin'];
  const userLevel = permissionOrder.indexOf(userPermission || 'none');
  const requiredLevel = permissionOrder.indexOf(requiredPermission);
  return userLevel >= requiredLevel;
}

// 권한 레벨 텍스트
export function getPermissionText(level: PermissionLevel): string {
  const texts = {
    none: '접근 불가',
    read: '조회',
    write: '수정',
    admin: '관리',
  };
  return texts[level];
}

