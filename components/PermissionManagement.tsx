'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { SystemId, PermissionLevel, systemPermissions } from '@/lib/permissions';
import { usePermissions } from '@/contexts/PermissionContext';

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export default function PermissionManagement() {
  const { isSuperAdmin, isAdmin } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [permissions, setPermissions] = useState<Record<SystemId, PermissionLevel>>({} as Record<SystemId, PermissionLevel>);
  const [role, setRole] = useState<'user' | 'admin' | 'super_admin'>('user');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin && !isAdmin) {
      return;
    }
    loadUsers();
  }, [isSuperAdmin, isAdmin]);

  const loadUsers = async () => {
    try {
      // Firebase Auth 사용자 목록은 서버 사이드에서만 가져올 수 있으므로
      // 현재는 userPermissions 컬렉션에서 사용자 목록을 가져옴
      const permissionsSnapshot = await getDocs(collection(db, 'userPermissions'));
      const usersList: User[] = [];
      
      permissionsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        usersList.push({
          uid: doc.id,
          email: data.email || null,
          displayName: data.name || null,
        });
      });
      
      setUsers(usersList);
    } catch (error) {
      console.error('사용자 목록 로드 오류:', error);
    }
  };

  const loadUserPermissions = async (userId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/permissions/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setPermissions(data.permission.permissions || {});
        setRole(data.permission.role || 'user');
      } else {
        // 권한이 없으면 기본값 설정
        const defaultPermissions = {} as Record<SystemId, PermissionLevel>;
        Object.keys(systemPermissions).forEach((systemId) => {
          defaultPermissions[systemId as SystemId] = systemPermissions[systemId as SystemId].defaultPermission;
        });
        setPermissions(defaultPermissions);
        setRole('user');
      }
    } catch (error) {
      console.error('권한 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    loadUserPermissions(userId);
  };

  const handlePermissionChange = (systemId: SystemId, level: PermissionLevel) => {
    setPermissions((prev) => ({
      ...prev,
      [systemId]: level,
    }));
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    
    try {
      setSaving(true);
      const response = await fetch(`/api/permissions/${selectedUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permissions,
          role,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        alert('권한이 저장되었습니다.');
      } else {
        alert(`권한 저장 실패: ${data.error}`);
      }
    } catch (error) {
      console.error('권한 저장 오류:', error);
      alert('권한 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin && !isAdmin) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">권한 관리 기능은 관리자만 사용할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">권한 관리</h2>
      </div>

      {/* 사용자 선택 */}
      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          사용자 선택
        </label>
        <select
          value={selectedUserId}
          onChange={(e) => handleUserSelect(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">사용자를 선택하세요</option>
          {users.map((user) => (
            <option key={user.uid} value={user.uid}>
              {user.displayName || user.email || user.uid}
            </option>
          ))}
        </select>
      </div>

      {selectedUserId && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              역할
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'user' | 'admin' | 'super_admin')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="user">일반 사용자</option>
              <option value="admin">관리자</option>
              <option value="super_admin">최고 관리자</option>
            </select>
            <p className="mt-2 text-sm text-gray-500">
              {role === 'super_admin' && '최고 관리자는 모든 시스템에 접근 가능합니다.'}
              {role === 'admin' && '관리자는 대부분 시스템에 접근 가능합니다.'}
              {role === 'user' && '일반 사용자는 개별 권한을 확인합니다.'}
            </p>
          </div>

          {role !== 'super_admin' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">시스템별 권한</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(systemPermissions).map(([systemId, system]) => (
                  <div key={systemId} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{systemId}</span>
                    </div>
                    <select
                      value={permissions[systemId as SystemId] || 'none'}
                      onChange={(e) =>
                        handlePermissionChange(
                          systemId as SystemId,
                          e.target.value as PermissionLevel
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="none">접근 불가</option>
                      <option value="read">조회</option>
                      <option value="write">수정</option>
                      <option value="admin">관리</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '저장 중...' : '권한 저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

