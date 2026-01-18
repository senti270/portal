'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AttendanceMainPage() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // 1초마다 시간 업데이트
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // 컴포넌트 언마운트 시 타이머 정리
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-5xl font-bold text-gray-800 text-center mb-12">
          출퇴근 기록
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 출근 버튼 */}
          <button
            onClick={() => router.push('/attendance/checkin')}
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
            onClick={() => router.push('/attendance/checkout')}
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

