// 권한 관리 유틸리티

export type SystemId = 
  | 'work-schedule'
  | 'purchase'
  | 'naver-ranking'
  | 'naver-refund'
  | 'ranking-tracker'
  | 'manual-management'
  | 'chatbot-management'
  | 'system-login'
  | 'permission-management';

export type PermissionLevel = 'none' | 'read' | 'write' | 'admin';

// 회원 등급 타입
export type UserRole = 'master' | 'deputy_master' | 'branch_manager' | 'employee';

export interface UserPermission {
  userId: string; // Firebase UID
  email?: string;
  name?: string;
  permissions: {
    [systemId in SystemId]?: PermissionLevel;
  };
  role?: UserRole | 'super_admin' | 'admin' | 'user'; // 전체 권한 레벨 (기존 호환성 유지)
  // 지점별 접근 권한 (빈 배열이면 모든 지점 접근 가능, 값이 있으면 해당 지점만 접근 가능)
  allowedBranches?: string[]; // 지점 ID 배열
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
  'permission-management': {
    systemId: 'permission-management',
    defaultPermission: 'none',
    requiredPermission: 'admin',
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

// 회원 등급 텍스트
export function getRoleText(role: UserRole | 'super_admin' | 'admin' | 'user'): string {
  const texts: Record<UserRole | 'super_admin' | 'admin' | 'user', string> = {
    master: '마스터',
    deputy_master: '부마스터',
    branch_manager: '지점매니저',
    employee: '일반직원',
    super_admin: '최고 관리자',
    admin: '관리자',
    user: '일반 사용자',
  };
  return texts[role] || '알 수 없음';
}

// 회원 등급 설명
export function getRoleDescription(role: UserRole | 'super_admin' | 'admin' | 'user'): string {
  const descriptions: Record<UserRole | 'super_admin' | 'admin' | 'user', string> = {
    master: '모든 시스템과 지점에 대한 전체 권한을 가집니다.',
    deputy_master: '마스터와 유사한 권한을 가지며, 대부분의 시스템을 관리할 수 있습니다.',
    branch_manager: '지정된 지점에 대한 관리 권한을 가집니다.',
    employee: '일반 직원으로 기본 조회 권한을 가집니다.',
    super_admin: '최고 관리자 - 모든 시스템 접근 가능',
    admin: '관리자 - 대부분 시스템 접근 가능',
    user: '일반 사용자 - 개별 권한 확인',
  };
  return descriptions[role] || '';
}

