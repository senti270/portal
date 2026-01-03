'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UserApproval {
  id: string;
  firebaseUid: string;
  kakaoId: string;
  kakaoNickname: string;
  kakaoEmail: string;
  realName: string;
  employeeId: string;
  employeeName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export default function UserApprovalManagement() {
  const [approvals, setApprovals] = useState<UserApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    // 실시간으로 승인 목록 구독
    let q = query(collection(db, 'userApprovals'));
    
    if (filter !== 'all') {
      q = query(collection(db, 'userApprovals'), where('status', '==', filter));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const docData = doc.data();
        return {
          id: doc.id,
          ...docData,
          createdAt: docData.createdAt?.toDate().toISOString() || '',
          approvedAt: docData.approvedAt?.toDate().toISOString(),
          rejectedAt: docData.rejectedAt?.toDate().toISOString(),
        } as UserApproval;
      });
      
      // 최신순 정렬
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setApprovals(data);
      setLoading(false);
    }, (error) => {
      console.error('승인 목록 조회 오류:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filter]);

  const handleApprove = async (approvalId: string, employeeId: string) => {
    if (!confirm('이 사용자를 승인하시겠습니까?')) {
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
          action: 'approve',
          employeeId,
          approvedBy: 'admin', // 실제로는 현재 로그인한 사용자 ID
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert('승인되었습니다.');
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
          rejectedBy: 'admin', // 실제로는 현재 로그인한 사용자 ID
          rejectionReason: reason,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert('거부되었습니다.');
      } else {
        alert(`거부 실패: ${data.error}`);
      }
    } catch (error) {
      console.error('거부 처리 오류:', error);
      alert('거부 처리에 실패했습니다.');
    }
  };

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">사용자 승인 관리</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            대기 중 ({pendingApprovals.length})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'approved' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            승인됨
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'rejected' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            거부됨
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">로딩 중...</div>
      ) : approvals.length === 0 ? (
        <div className="text-center py-8 text-gray-500">승인 요청이 없습니다.</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  직원명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  실명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  카카오톡 닉네임
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  신청일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {approvals.map((approval) => (
                <tr key={approval.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {approval.employeeName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {approval.realName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {approval.kakaoNickname}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        approval.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : approval.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {approval.status === 'pending'
                        ? '대기 중'
                        : approval.status === 'approved'
                        ? '승인됨'
                        : '거부됨'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(approval.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {approval.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(approval.id, approval.employeeId)}
                          className="text-green-600 hover:text-green-900"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => handleReject(approval.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          거부
                        </button>
                      </div>
                    )}
                    {approval.status === 'rejected' && approval.rejectionReason && (
                      <span className="text-xs text-gray-500">
                        사유: {approval.rejectionReason}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

