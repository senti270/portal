'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, query, where, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { SystemId, PermissionLevel, systemPermissions, UserRole, getRoleText, getRoleDescription } from '@/lib/permissions';
import { usePermissions } from '@/contexts/PermissionContext';

interface Branch {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  name: string;
  firebaseUid?: string;
  email?: string;
  resignationDate?: Date;
  status?: 'active' | 'inactive';
}

interface UserApproval {
  id: string;
  firebaseUid: string;
  kakaoId: string;
  kakaoNickname: string;
  realName: string;
  employeeId?: string;
  employeeName?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

interface UserPermission {
  userId: string;
  email?: string;
  name?: string;
  role?: UserRole | 'super_admin' | 'admin' | 'user';
  permissions: Record<SystemId, PermissionLevel>;
  allowedBranches?: string[];
}

interface UnifiedUser {
  employeeId?: string;
  employeeName: string;
  firebaseUid?: string;
  email?: string;
  realName?: string;
  kakaoNickname?: string;
  kakaoId?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'not_applied';
  approvalId?: string;
  permission?: UserPermission;
  canCreateInvite: boolean;
  employeeStatus?: 'active' | 'inactive'; // 재직 상태
  resignationDate?: Date; // 퇴사일
}

export default function PermissionManagement() {
  const { isSuperAdmin, isMaster, isAdmin, isDeputyMaster } = usePermissions();
  const [unifiedUsers, setUnifiedUsers] = useState<UnifiedUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [permissions, setPermissions] = useState<Record<SystemId, PermissionLevel>>({} as Record<SystemId, PermissionLevel>);
  const [role, setRole] = useState<UserRole | 'super_admin' | 'admin' | 'user'>('employee');
  const [allowedBranches, setAllowedBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'not_registered'>('all');
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin && !isMaster && !isAdmin) {
      return;
    }
    loadBranches();
    loadUnifiedUsers();
  }, [isSuperAdmin, isMaster, isAdmin]);

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

  const loadUnifiedUsers = async () => {
    try {
      setLoading(true);
      
      // 1. 직원 목록 로드
      const employeesSnapshot = await getDocs(collection(db, 'employees'));
      const employeesMap = new Map<string, Employee>();
      employeesSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const resignationDate = data.resignationDate?.toDate ? data.resignationDate.toDate() : undefined;
        employeesMap.set(doc.id, {
          id: doc.id,
          name: data.name || '이름 없음',
          firebaseUid: data.firebaseUid,
          email: data.email,
          resignationDate: resignationDate,
          status: resignationDate ? 'inactive' : 'active',
        });
      });

      // 2. 승인 요청 로드
      const approvalsSnapshot = await getDocs(collection(db, 'userApprovals'));
      const approvalsMap = new Map<string, UserApproval>();
      const approvalsByEmployeeId = new Map<string, UserApproval>();
      approvalsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const approval: UserApproval = {
          id: doc.id,
          firebaseUid: data.firebaseUid || '',
          kakaoId: data.kakaoId || '',
          kakaoNickname: data.kakaoNickname || '',
          realName: data.realName || '',
          employeeId: data.employeeId,
          employeeName: data.employeeName,
          status: data.status || 'pending',
          createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
          approvedAt: data.approvedAt?.toDate().toISOString(),
          rejectedAt: data.rejectedAt?.toDate().toISOString(),
          rejectionReason: data.rejectionReason,
        };
        const uidOrKakao = (data.firebaseUid || data.kakaoId || '').toString();
        if (uidOrKakao) approvalsMap.set(uidOrKakao, approval);
        const empId = data.employeeId != null ? String(data.employeeId) : '';
        if (empId) approvalsByEmployeeId.set(empId, approval);
      });

      // 3. 권한 정보 로드
      const permissionsSnapshot = await getDocs(collection(db, 'userPermissions'));
      const permissionsMap = new Map<string, UserPermission>();
      permissionsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        permissionsMap.set(doc.id, {
          userId: doc.id,
          email: data.email,
          name: data.name,
          role: data.role || 'employee',
          permissions: data.permissions || {},
          allowedBranches: data.allowedBranches || [],
        });
      });

      // 4. 통합 데이터 생성
      const unified: UnifiedUser[] = [];
      
      // 직원 기준으로 통합 (직원이 없는 승인 요청도 포함)
      employeesMap.forEach((employee) => {
        const approvalByUid = employee.firebaseUid ? approvalsMap.get(String(employee.firebaseUid)) : undefined;
        const approvalByEmployeeId = approvalsByEmployeeId.get(String(employee.id));
        // firebaseUid로 찾은 승인 우선, 없으면 employeeId로 찾은 승인(방금 가입·승인 대기) 사용
        const approval = approvalByUid || approvalByEmployeeId;

        // 퇴사한 직원이면서 카카오 가입도 없고 승인 대기 건도 없으면 리스트에서 제외
        if (employee.status === 'inactive' && !employee.firebaseUid && !approvalByEmployeeId) {
          return;
        }

        unified.push({
          employeeId: employee.id,
          employeeName: employee.name,
          firebaseUid: employee.firebaseUid || approval?.firebaseUid,
          email: employee.email,
          realName: approval?.realName,
          kakaoNickname: approval?.kakaoNickname,
          kakaoId: approval?.kakaoId,
          approvalStatus: approval?.status || (employee.firebaseUid ? 'approved' : 'not_applied'),
          approvalId: approval?.id,
          permission: (employee.firebaseUid || approval?.firebaseUid) ? permissionsMap.get(employee.firebaseUid || approval!.firebaseUid) : undefined,
          canCreateInvite: !employee.firebaseUid && !approvalByEmployeeId,
          employeeStatus: employee.status,
          resignationDate: employee.resignationDate,
        });
      });

      // 승인 요청 중 직원이 없는 것들도 추가
      approvalsMap.forEach((approval) => {
        const empId = approval.employeeId != null ? String(approval.employeeId) : '';
        if (!empId || !employeesMap.has(empId)) {
          const existing = unified.find(u => u.firebaseUid === approval.firebaseUid || u.kakaoId === approval.kakaoId);
          if (!existing) {
            unified.push({
              employeeName: approval.employeeName || approval.realName || '이름 없음',
              firebaseUid: approval.firebaseUid,
              realName: approval.realName,
              kakaoNickname: approval.kakaoNickname,
              kakaoId: approval.kakaoId,
              approvalStatus: approval.status,
              approvalId: approval.id,
              permission: approval.firebaseUid ? permissionsMap.get(approval.firebaseUid) : undefined,
              canCreateInvite: false,
            });
          }
        }
      });

      // 직원 ID로 승인 대기가 있는데 아직 not_applied로 남은 행 보정 (매칭 누락 방지)
      approvalsByEmployeeId.forEach((approval, empId) => {
        if (approval.status !== 'pending') return;
        const u = unified.find((x) => x.employeeId === empId);
        if (u && u.approvalStatus === 'not_applied') {
          u.approvalStatus = 'pending';
          u.approvalId = approval.id;
          u.firebaseUid = u.firebaseUid || approval.firebaseUid;
          u.realName = u.realName || approval.realName;
          u.kakaoNickname = approval.kakaoNickname;
          u.kakaoId = approval.kakaoId;
        }
      });

      // 이름순 정렬
      unified.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
      
      setUnifiedUsers(unified);
    } catch (error) {
      console.error('통합 사용자 목록 로드 오류:', error);
    } finally {
      setLoading(false);
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

  const handleApprove = async (approvalId: string, firebaseUid: string) => {
    if (!confirm('이 사용자를 승인하시겠습니까?')) {
      return;
    }

    try {
      const approval = unifiedUsers.find(u => u.approvalId === approvalId);
      const response = await fetch('/api/work-schedule/user-approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approvalId,
          action: 'approve',
          employeeId: approval?.employeeId || '',
          approvedBy: auth.currentUser?.uid || 'admin',
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert('승인되었습니다.');
        await loadUnifiedUsers();
      } else {
        alert(`승인 실패: ${data.error}`);
      }
    } catch (error) {
      console.error('승인 처리 오류:', error);
      alert('승인 처리에 실패했습니다.');
    }
  };

  const handleReject = async (approvalId: string) => {
    const reason = prompt('거부 사유를 입력해주세요:');
    if (!reason) {
      return;
    }

    try {
      const response = await fetch('/api/work-schedule/user-approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approvalId,
          action: 'reject',
          rejectedBy: auth.currentUser?.uid || 'admin',
          rejectionReason: reason,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert('거부되었습니다.');
        await loadUnifiedUsers();
      } else {
        alert(`거부 실패: ${data.error}`);
      }
    } catch (error) {
      console.error('거부 처리 오류:', error);
      alert('거부 처리에 실패했습니다.');
    }
  };

  const sendInviteLink = async (employeeId: string, employeeName: string) => {
    try {
      const response = await fetch('/api/work-schedule/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId,
          employeeName,
          invitedBy: auth.currentUser?.uid || 'admin',
        }),
      });

      const data = await response.json();
      if (data.success) {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(data.inviteUrl);
          alert(`초대링크가 생성되었습니다!\n\n링크: ${data.inviteUrl}\n\n링크가 클립보드에 복사되었습니다.`);
        } else {
          alert(`초대링크가 생성되었습니다!\n\n링크: ${data.inviteUrl}\n\n링크를 복사해서 전송해주세요.`);
        }
      } else {
        alert(`초대링크 생성 실패: ${data.error}`);
      }
    } catch (error) {
      console.error('초대링크 생성 오류:', error);
      alert('초대링크 생성에 실패했습니다.');
    }
  };

  const handleDeleteUser = async (user: UnifiedUser) => {
    if (!user.firebaseUid) {
      alert('탈퇴할 사용자의 Firebase UID가 없습니다.');
      return;
    }

    const confirmMessage = user.employeeStatus === 'inactive'
      ? `${user.employeeName}님은 이미 퇴사한 직원입니다. 시스템에서 탈퇴 처리하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
      : `정말로 ${user.employeeName}님을 시스템에서 탈퇴 처리하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${user.firebaseUid}/delete`, {
        method: 'POST',
      });

      const data = await response.json();
      if (data.success) {
        alert('탈퇴 처리가 완료되었습니다.');
        await loadUnifiedUsers();
      } else {
        alert(`탈퇴 처리 실패: ${data.error}`);
      }
    } catch (error) {
      console.error('탈퇴 처리 오류:', error);
      alert('탈퇴 처리에 실패했습니다.');
    }
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
        await loadUnifiedUsers();
        setShowPermissionModal(false);
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

  const openPermissionModal = async (user: UnifiedUser) => {
    if (!user.firebaseUid) {
      alert('Firebase UID가 없어 권한을 설정할 수 없습니다. 먼저 가입을 승인해주세요.');
      return;
    }
    setSelectedUserId(user.firebaseUid);
    await loadUserPermissions(user.firebaseUid);
    setShowPermissionModal(true);
  };

  if (!isSuperAdmin && !isMaster && !isAdmin) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">권한 관리 기능은 관리자만 사용할 수 있습니다.</p>
      </div>
    );
  }

  const filteredUsers = unifiedUsers.filter((user) => {
    const matchesSearch = 
      user.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.realName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.kakaoNickname?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      filterStatus === 'all' ||
      (filterStatus === 'pending' && user.approvalStatus === 'pending') ||
      (filterStatus === 'approved' && user.approvalStatus === 'approved') ||
      (filterStatus === 'not_registered' && !user.firebaseUid);
    
    return matchesSearch && matchesFilter;
  });

  const pendingCount = unifiedUsers.filter(u => u.approvalStatus === 'pending').length;
  const showBranchSettings = role !== 'master' && role !== 'deputy_master' && role !== 'super_admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">통합 권한 관리</h2>
          <p className="text-sm text-gray-600 mt-1">사용자 승인, 권한 설정, 초대링크 생성을 한 곳에서 관리합니다.</p>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <input
              type="text"
              placeholder="이름, 이메일, 카카오톡 닉네임으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg text-sm ${
                filterStatus === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
                filterStatus === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              대기 중
              {pendingCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilterStatus('approved')}
              className={`px-4 py-2 rounded-lg text-sm ${
                filterStatus === 'approved' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              승인됨
            </button>
            <button
              onClick={() => setFilterStatus('not_registered')}
              className={`px-4 py-2 rounded-lg text-sm ${
                filterStatus === 'not_registered' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              미가입
            </button>
          </div>
        </div>
      </div>

      {/* 통합 사용자 목록 */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">사용자 목록을 불러오는 중...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  직원명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  실명/닉네임
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  권한
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.employeeId || user.firebaseUid || user.kakaoId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.employeeName}</div>
                    {user.email && (
                      <div className="text-xs text-gray-500">{user.email}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.realName || '-'}</div>
                    {user.kakaoNickname && (
                      <div className="text-xs text-gray-500">카카오: {user.kakaoNickname}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      {user.approvalStatus === 'pending' && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          대기 중
                        </span>
                      )}
                      {user.approvalStatus === 'approved' && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          승인됨
                        </span>
                      )}
                      {user.approvalStatus === 'rejected' && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          거부됨
                        </span>
                      )}
                      {user.approvalStatus === 'not_applied' && !user.firebaseUid && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                          미가입
                        </span>
                      )}
                      {user.firebaseUid && !user.approvalStatus && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          등록됨
                        </span>
                      )}
                      {user.employeeStatus === 'inactive' && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          퇴사
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.permission ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {getRoleText(user.permission.role || 'employee')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {Object.keys(user.permission.permissions || {}).filter(
                            (key) => user.permission?.permissions[key as SystemId] !== 'none'
                          ).length}개 시스템
                        </div>
                      </div>
                    ) : user.firebaseUid ? (
                      <span className="text-xs text-gray-500">권한 미설정</span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2 flex-wrap">
                      {user.approvalStatus === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(user.approvalId!, user.firebaseUid!)}
                            className="text-green-600 hover:text-green-900 font-medium"
                          >
                            승인
                          </button>
                          <button
                            onClick={() => handleReject(user.approvalId!)}
                            className="text-red-600 hover:text-red-900 font-medium"
                          >
                            거부
                          </button>
                        </>
                      )}
                      {user.firebaseUid && (
                        <button
                          onClick={() => openPermissionModal(user)}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          권한 설정
                        </button>
                      )}
                      {user.canCreateInvite && user.employeeId && (
                        <button
                          onClick={() => sendInviteLink(user.employeeId!, user.employeeName)}
                          className="text-purple-600 hover:text-purple-900 font-medium"
                        >
                          초대링크
                        </button>
                      )}
                      {/* 퇴사한 직원이면서 시스템에 가입되어 있는 경우 탈퇴 버튼 표시 (마스터/부마스터만) */}
                      {user.employeeStatus === 'inactive' && 
                       user.firebaseUid && 
                       (isMaster || isDeputyMaster) && (
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="text-red-600 hover:text-red-900 font-medium"
                        >
                          탈퇴 처리
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      )}

      {/* 권한 설정 모달 */}
      {showPermissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">권한 설정</h3>
                <button
                  onClick={() => setShowPermissionModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* 회원 등급 설정 */}
              <div>
                <h4 className="text-lg font-semibold mb-4">회원 등급</h4>
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
                <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900 font-medium">{getRoleText(role)}</p>
                  <p className="text-xs text-blue-700 mt-1">{getRoleDescription(role)}</p>
                </div>
              </div>

              {/* 시스템별 권한 설정 */}
              {role !== 'master' && role !== 'super_admin' && (
                <div>
                  <h4 className="text-lg font-semibold mb-4">시스템별 접근 권한</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(systemPermissions).map(([systemId, system]) => (
                      <div key={systemId} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium text-gray-900">{systemId}</span>
                        </div>
                        <select
                          value={permissions[systemId as SystemId] || 'none'}
                          onChange={(e) =>
                            handlePermissionChange(
                              systemId as SystemId,
                              e.target.value as PermissionLevel
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
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
              )}

              {/* 지점별 접근 권한 설정 */}
              {showBranchSettings && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold">지점별 접근 권한</h4>
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
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                    {branches.map((branch) => (
                      <label
                        key={branch.id}
                        className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
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
                </div>
              )}

              {/* 저장 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '저장 중...' : '✅ 권한 저장'}
                </button>
                <button
                  onClick={() => setShowPermissionModal(false)}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
