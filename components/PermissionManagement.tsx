'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { SystemId, PermissionLevel, systemPermissions, UserRole, getRoleText, getRoleDescription } from '@/lib/permissions';
import { usePermissions } from '@/contexts/PermissionContext';

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface Branch {
  id: string;
  name: string;
}

export default function PermissionManagement() {
  const { isSuperAdmin, isMaster, isAdmin } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [permissions, setPermissions] = useState<Record<SystemId, PermissionLevel>>({} as Record<SystemId, PermissionLevel>);
  const [role, setRole] = useState<UserRole | 'super_admin' | 'admin' | 'user'>('employee');
  const [allowedBranches, setAllowedBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isSuperAdmin && !isMaster && !isAdmin) {
      return;
    }
    loadUsers();
    loadBranches();
  }, [isSuperAdmin, isMaster, isAdmin]);

  const loadUsers = async () => {
    try {
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

  const loadBranches = async () => {
    try {
      const branchesSnapshot = await getDocs(collection(db, 'branches'));
      const branchesList: Branch[] = branchesSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || '이름 없음',
      }));
      setBranches(branchesList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('지점 목록 로드 오류:', error);
    }
  };

  const loadUserPermissions = async (userId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/permissions/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setPermissions(data.permission.permissions || {});
        setRole(data.permission.role || 'employee');
        setAllowedBranches(data.permission.allowedBranches || []);
      } else {
        const defaultPermissions = {} as Record<SystemId, PermissionLevel>;
        Object.keys(systemPermissions).forEach((systemId) => {
          defaultPermissions[systemId as SystemId] = systemPermissions[systemId as SystemId].defaultPermission;
        });
        setPermissions(defaultPermissions);
        setRole('employee');
        setAllowedBranches([]);
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

  const handleBranchToggle = (branchId: string) => {
    setAllowedBranches((prev) => {
      if (prev.includes(branchId)) {
        return prev.filter((id) => id !== branchId);
      } else {
        return [...prev, branchId];
      }
    });
  };

  const handleSelectAllBranches = () => {
    setAllowedBranches([]);
  };

  const handleDeselectAllBranches = () => {
    setAllowedBranches(branches.map((b) => b.id));
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
          allowedBranches: allowedBranches.length === 0 ? [] : allowedBranches,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        alert('권한이 저장되었습니다.');
        await loadUserPermissions(selectedUserId);
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

  if (!isSuperAdmin && !isMaster && !isAdmin) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">권한 관리 기능은 관리자만 사용할 수 있습니다.</p>
      </div>
    );
  }

  const filteredUsers = users.filter((user) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (user.email?.toLowerCase().includes(searchLower) || false) ||
      (user.displayName?.toLowerCase().includes(searchLower) || false) ||
      user.uid.toLowerCase().includes(searchLower)
    );
  });

  // 마스터/부마스터/지점매니저는 지점 제한 없음
  const showBranchSettings = role !== 'master' && role !== 'deputy_master' && role !== 'super_admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">권한 관리</h2>
          <p className="text-sm text-gray-600 mt-1">사용자별 시스템 접근 권한 및 지점 접근 권한을 관리합니다.</p>
        </div>
      </div>

      {/* 사용자 선택 */}
      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          사용자 검색 및 선택
        </label>
        <input
          type="text"
          placeholder="이메일, 이름, UID로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-3"
        />
        <select
          value={selectedUserId}
          onChange={(e) => handleUserSelect(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">사용자를 선택하세요</option>
          {filteredUsers.map((user) => (
            <option key={user.uid} value={user.uid}>
              {user.displayName || user.email || user.uid}
            </option>
          ))}
        </select>
        {selectedUserId && (
          <p className="mt-2 text-sm text-gray-500">선택된 사용자: {users.find(u => u.uid === selectedUserId)?.displayName || users.find(u => u.uid === selectedUserId)?.email || selectedUserId}</p>
        )}
      </div>

      {selectedUserId && !loading && (
        <div className="space-y-6">
          {/* 회원 등급 설정 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">회원 등급</h3>
            <div className="space-y-3">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole | 'super_admin' | 'admin' | 'user')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="master">마스터</option>
                <option value="deputy_master">부마스터</option>
                <option value="branch_manager">지점매니저</option>
                <option value="employee">일반직원</option>
                <option value="super_admin">최고 관리자 (레거시)</option>
                <option value="admin">관리자 (레거시)</option>
                <option value="user">일반 사용자 (레거시)</option>
              </select>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-medium">{getRoleText(role)}</p>
                <p className="text-xs text-blue-700 mt-1">{getRoleDescription(role)}</p>
              </div>
            </div>
          </div>

          {/* 시스템별 권한 설정 */}
          {role !== 'master' && role !== 'super_admin' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">시스템별 접근 권한</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(systemPermissions).map(([systemId, system]) => (
                    <div key={systemId} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-gray-900">{systemId}</span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          기본: {system.defaultPermission}
                        </span>
                      </div>
                      <select
                        value={permissions[systemId as SystemId] || 'none'}
                        onChange={(e) =>
                          handlePermissionChange(
                            systemId as SystemId,
                            e.target.value as PermissionLevel
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="none">❌ 접근 불가</option>
                        <option value="read">👁️ 조회만 가능</option>
                        <option value="write">✏️ 조회 및 수정</option>
                        <option value="admin">⚙️ 관리 (모든 권한)</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 지점별 접근 권한 설정 */}
          {showBranchSettings && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">지점별 접근 권한</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectAllBranches}
                    className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                  >
                    전체 선택
                  </button>
                  <button
                    onClick={handleDeselectAllBranches}
                    className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                  >
                    전체 해제
                  </button>
                </div>
              </div>
              <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  {allowedBranches.length === 0 ? (
                    <span className="text-green-600 font-medium">✅ 모든 지점 접근 가능</span>
                  ) : (
                    <span className="text-orange-600 font-medium">
                      ⚠️ 선택된 {allowedBranches.length}개 지점만 접근 가능
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {allowedBranches.length === 0
                    ? '모든 지점에 접근할 수 있습니다. 특정 지점만 제한하려면 아래에서 선택하세요.'
                    : '선택되지 않은 지점에는 접근할 수 없습니다.'}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                {branches.map((branch) => (
                  <label
                    key={branch.id}
                    className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                      allowedBranches.includes(branch.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={allowedBranches.includes(branch.id)}
                      onChange={() => handleBranchToggle(branch.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-900">{branch.name}</span>
                  </label>
                ))}
              </div>
              {branches.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  등록된 지점이 없습니다. 지점을 먼저 등록해주세요.
                </p>
              )}
            </div>
          )}

          {/* 저장 버튼 */}
          <div className="bg-white rounded-lg shadow p-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '저장 중...' : '✅ 권한 저장'}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">권한 정보를 불러오는 중...</p>
        </div>
      )}
    </div>
  );
}
