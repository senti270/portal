'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/contexts/AdminContext';

interface Branch {
  id: string;
  name: string;
}

export default function AttendanceRegisterDevicePage() {
  const router = useRouter();
  const { isAdmin } = useAdmin();
  const [deviceId, setDeviceId] = useState<string>('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        if (!isAdmin) {
          setError('관리자만 기기를 등록할 수 있습니다.');
          setLoading(false);
          return;
        }

        let storedId =
          typeof window !== 'undefined'
            ? localStorage.getItem('attendanceDeviceId')
            : null;

        if (!storedId) {
          const newId =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? (crypto as any).randomUUID()
              : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          if (typeof window !== 'undefined') {
            localStorage.setItem('attendanceDeviceId', newId);
          }
          storedId = newId;
        }

        setDeviceId(storedId);

        const branchesSnap = await getDocs(collection(db, 'branches'));
        const list: Branch[] = branchesSnap.docs.map((d) => ({
          id: d.id,
          name: (d.data() as any).name || d.id,
        }));
        list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        setBranches(list);
      } catch (e: any) {
        console.error('지점 목록/기기 초기화 실패:', e);
        setError(e?.message || '초기화 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [isAdmin]);

  const handleSave = async () => {
    if (!selectedBranchId) {
      alert('지점을 선택해주세요.');
      return;
    }
    if (!deviceId) {
      alert('기기 ID를 불러오지 못했습니다.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const branch = branches.find((b) => b.id === selectedBranchId);
      await setDoc(
        doc(db, 'attendanceDevices', deviceId),
        {
          deviceId,
          branchId: selectedBranchId,
          branchName: branch?.name || '',
          deviceName: deviceName || null,
          isActive: true,
          updatedAt: new Date(),
          createdAt: new Date(),
        },
        { merge: true },
      );

      setSuccess('기기 등록이 완료되었습니다. 이 기기에서는 해당 지점만 사용됩니다.');
    } catch (e: any) {
      console.error('기기 등록 실패:', e);
      setError(e?.message || '기기 등록 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-3xl font-bold text-gray-700">로딩 중...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">접근 권한 없음</h1>
          <p className="text-gray-600 mb-6">
            관리자만 출퇴근용 기기를 등록할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => router.push('/attendance')}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg"
          >
            출퇴근 메인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-2xl p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4 text-center">
          출퇴근용 기기 등록
        </h1>
        <p className="text-sm text-gray-600 mb-6 text-center">
          이 기기를 특정 지점의 출퇴근용 POS로 등록합니다.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            이 기기 ID
          </label>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-mono text-xs break-all text-gray-800">
            {deviceId}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            지점 선택
          </label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">지점을 선택하세요</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            기기 이름 (선택)
          </label>
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="예: 동탄점 POS1"
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
        {success && <p className="text-sm text-green-600 mb-3">{success}</p>}

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={() => router.push('/attendance')}
            className="flex-1 h-11 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-xl shadow"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl shadow"
          >
            {saving ? '등록 중...' : '기기 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}


