'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/contexts/AdminContext';

interface AttendanceDevice {
  deviceId: string;
  branchId: string;
  branchName?: string;
  deviceName?: string;
  isActive?: boolean;
}

export default function AttendanceMainPage() {
  const router = useRouter();
  const { isAdmin, login } = useAdmin();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<AttendanceDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    // 1초마다 시간 업데이트
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const initDevice = async () => {
      try {
        let storedId: string | null = null;
        if (typeof window !== 'undefined') {
          storedId = localStorage.getItem('attendanceDeviceId');
        }

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

        const ref = doc(db, 'attendanceDevices', storedId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as any;
          if (data.isActive !== false && data.branchId) {
            setDeviceInfo({
              deviceId: storedId,
              branchId: data.branchId,
              branchName: data.branchName,
              deviceName: data.deviceName,
              isActive: data.isActive,
            });
          }
        }
      } catch (e) {
        console.error('출퇴근 기기 정보 로드 실패:', e);
      } finally {
        setLoading(false);
      }
    };

    initDevice();
  }, []);

  const handleAdminLogin = () => {
    const ok = login(loginPassword);
    if (!ok) {
      setLoginError('비밀번호가 올바르지 않습니다.');
    } else {
      setLoginError('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-3xl font-bold text-gray-700">로딩 중...</div>
      </div>
    );
  }

  // 아직 이 기기가 어느 지점에도 등록되지 않은 경우
  if (!deviceInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4 text-center">
            출퇴근용 기기 등록 필요
          </h1>
          <p className="text-gray-700 mb-4 text-center">
            이 기기는 아직 특정 지점의 출퇴근용 POS로 등록되지 않았습니다.
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 mb-6">
            <div className="text-sm text-gray-500 mb-1">이 기기 ID</div>
            <div className="font-mono text-sm break-all text-gray-800">
              {deviceId}
            </div>
          </div>

          {!isAdmin && (
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-3">
                관리자 비밀번호를 입력하면, 이 기기를 특정 지점에 등록할 수 있습니다.
              </p>
              <div className="flex gap-2 items-center mb-2">
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="관리자 비밀번호"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAdminLogin}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                >
                  관리자 로그인
                </button>
              </div>
              {loginError && (
                <p className="text-sm text-red-500">{loginError}</p>
              )}
            </div>
          )}

          {isAdmin && (
            <div className="mb-6">
              <p className="text-sm text-gray-700 mb-3">
                이 기기를 특정 지점 출퇴근용으로 등록하려면 아래 버튼을 눌러
                지점을 선택해 주세요.
              </p>
              <button
                type="button"
                onClick={() => router.push('/attendance/register-device')}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg transition-colors"
              >
                이 기기 지점 등록하러 가기
              </button>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center mt-4">
            ※ 이 화면의 기기 ID를 관리자에게 전달하면, 관리자가 지점에 매핑해 드립니다.
          </p>
        </div>
      </div>
    );
  }

  // 지점이 매핑된 정상 기기 화면
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-5xl font-bold text-gray-800 text-center mb-4">
          출퇴근 기록
        </h1>
        {deviceInfo.branchName && (
          <p className="text-xl text-center text-blue-600 font-semibold mb-6">
            {deviceInfo.branchName}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 출근 버튼 */}
          <button
            onClick={() =>
              router.push(
                `/attendance/checkin?branchId=${encodeURIComponent(
                  deviceInfo.branchId,
                )}`,
              )
            }
            className="h-64 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-3xl shadow-2xl transform transition-all duration-200 hover:scale-105 active:scale-95 flex flex-col items-center justify-center group"
          >
            <div className="text-8xl mb-4 group-hover:scale-110 transition-transform duration-200">
              📥
            </div>
            <div className="text-4xl font-bold">출근</div>
            <div className="text-xl mt-2 opacity-90">CHECK IN</div>
          </button>

          {/* 퇴근 버튼 */}
          <button
            onClick={() =>
              router.push(
                `/attendance/checkout?branchId=${encodeURIComponent(
                  deviceInfo.branchId,
                )}`,
              )
            }
            className="h-64 bg-gradient-to-br from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-3xl shadow-2xl transform transition-all duration-200 hover:scale-105 active:scale-95 flex flex-col items-center justify-center group"
          >
            <div className="text-8xl mb-4 group-hover:scale-110 transition-transform duration-200">
              📤
            </div>
            <div className="text-4xl font-bold">퇴근</div>
            <div className="text-xl mt-2 opacity-90">CHECK OUT</div>
          </button>
        </div>

        {/* 현재 시간 표시 */}
        <div className="mt-12 text-center">
          <div className="text-2xl text-gray-600 font-semibold">
            {currentTime.toLocaleString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

