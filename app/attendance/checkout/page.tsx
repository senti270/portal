'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EmployeeScheduleInfo, AttendanceRecord } from '@/types/attendance';
import { checkAttendanceStatus, parseTimeString, formatDate } from '@/lib/attendance-utils';
import { toLocalDate, toLocalDateString } from '@/utils/work-schedule/dateUtils';

function CheckOutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branchId = searchParams.get('branchId') || '';
  
  const [loading, setLoading] = useState(true);
  const [branchName, setBranchName] = useState<string>('');
  const [targetBranchId, setTargetBranchId] = useState<string>('');
  const [employeesWithSchedule, setEmployeesWithSchedule] = useState<EmployeeScheduleInfo[]>([]);
  const [employeesWithCheckIn, setEmployeesWithCheckIn] = useState<Array<{employeeId: string; employeeName: string}>>([]);
  const [todayAttendanceMap, setTodayAttendanceMap] = useState<Map<string, { checkIn?: string; checkOut?: string }>>(new Map());
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showCheckoutInfo, setShowCheckoutInfo] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [reasonOther, setReasonOther] = useState('');
  const [note, setNote] = useState('');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    // 초기 로딩
    loadEmployees();
    
    // 5분마다 데이터 새로고침 (스케줄 변경 시 반영)
    const refreshInterval = setInterval(() => {
      loadEmployees();
    }, 5 * 60 * 1000); // 5분 = 5 * 60 * 1000ms
    
    // 컴포넌트 언마운트 시 인터벌 정리
    return () => clearInterval(refreshInterval);
  }, [branchId]);

  // 현재 시간 표시 (출근/퇴근 메인과 동일 형식)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const todayStr = formatDate(today);

      // 지점 정보 로드 (지점명 표시 및 필터링용)
      let targetId = branchId;
      let targetName = '';

      if (targetId) {
        // URL로 넘어온 branchId가 있으면 해당 지점명 조회
        try {
          const branchSnapshot = await getDocs(
            query(collection(db, 'branches'), where('__name__', '==', targetId))
          );
          if (!branchSnapshot.empty) {
            targetName = branchSnapshot.docs[0].data().name || '';
          }
        } catch (e) {
          // 실패 시 전체 지점에서 찾아봄
          const branchesSnapshot = await getDocs(collection(db, 'branches'));
          const branch = branchesSnapshot.docs.find((doc) => doc.id === targetId);
          if (branch) {
            targetName = branch.data().name || '';
          }
        }
      } else {
        // 테스트용 기본 지점: 청담장어마켓 동탄점
        const branchesSnapshot = await getDocs(collection(db, 'branches'));
        const testBranch = branchesSnapshot.docs.find((doc) =>
          doc.data().name?.includes('동탄')
        );
        if (testBranch) {
          targetId = testBranch.id;
          targetName = testBranch.data().name || '';
        } else if (branchesSnapshot.docs.length > 0) {
          // fallback: 첫 번째 지점
          targetId = branchesSnapshot.docs[0].id;
          targetName = branchesSnapshot.docs[0].data().name || '';
        }
      }

      setBranchName(targetName);
      setTargetBranchId(targetId);
      
      // 모든 스케줄 조회 후 (오늘 날짜 + 지점) 클라이언트에서 필터링
      const schedulesQuery = collection(db, 'schedules');
      const schedulesSnapshot = await getDocs(schedulesQuery);
      
      const employeeMap = new Map<string, EmployeeScheduleInfo>();
      
      // 오늘 날짜 + 지점 필터링 (클라이언트 사이드)
      schedulesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const scheduleDate = toLocalDate(data.date);
        const scheduleDateStr = toLocalDateString(scheduleDate);
        
        // 오늘 날짜인 스케줄만 포함
        if (scheduleDateStr !== todayStr) return;

        // 지점 필터링
        if (targetId && data.branchId !== targetId) return;
        
        const employeeId = data.employeeId;
        
        if (!employeeMap.has(employeeId)) {
          employeeMap.set(employeeId, {
            employeeId,
            employeeName: data.employeeName || '',
            scheduledStartTime: data.startTime || '',
            scheduledEndTime: data.endTime || '',
            scheduledBreakTime: data.breakTime ? parseFloat(String(data.breakTime)) : 0,
            hasSchedule: true
          });
        }
      });
      
      setEmployeesWithSchedule(Array.from(employeeMap.values()));
      
      // 오늘 출근/퇴근 기록 조회 (시각 표시용)
      const attendanceConstraints = [
        where('date', '==', todayStr),
      ];
      if (targetId) {
        attendanceConstraints.push(where('branchId', '==', targetId));
      }
      const attendanceQuery = query(collection(db, 'attendanceRecords'), ...attendanceConstraints);
      const attendanceSnapshot = await getDocs(attendanceQuery);

      const attendanceMap = new Map<string, { checkIn?: string; checkOut?: string }>();
      const checkInEmployeeIds = new Set(Array.from(employeeMap.keys()));
      const employeesWithCheckInOnly: Array<{ employeeId: string; employeeName: string }> = [];

      attendanceSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const empId = data.employeeId as string;
        const actualTime = data.actualTime?.toDate ? data.actualTime.toDate() : (data.actualTime ? new Date(data.actualTime) : null);
        if (!actualTime) return;

        const timeStr = actualTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        const type = data.type as string;

        const existing = attendanceMap.get(empId) || {};
        if (type === 'checkin') {
          existing.checkIn = timeStr;
        } else if (type === 'checkout') {
          existing.checkOut = timeStr;
        }
        attendanceMap.set(empId, existing);

        // 스케줄에는 없지만 출근 기록이 있는 직원 목록 구성
        if (type === 'checkin' && !checkInEmployeeIds.has(empId)) {
          employeesWithCheckInOnly.push({
            employeeId: empId,
            employeeName: data.employeeName || ''
          });
        }
      });

      setTodayAttendanceMap(attendanceMap);
      setEmployeesWithCheckIn(employeesWithCheckInOnly);
    } catch (error) {
      console.error('직원 목록 로드 실패:', error);
      alert('직원 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeSelect = async (employee: EmployeeScheduleInfo | {employeeId: string; employeeName: string}) => {
    const today = new Date();
    const todayStr = formatDate(today);
    
    // 이미 퇴근 기록이 있는지 확인
    const checkoutConstraints = [
      where('employeeId', '==', employee.employeeId),
      where('date', '==', todayStr),
      where('type', '==', 'checkout'),
    ];
    if (targetBranchId) {
      checkoutConstraints.push(where('branchId', '==', targetBranchId));
    }
    const checkoutQuery = query(collection(db, 'attendanceRecords'), ...checkoutConstraints);
    
    const checkoutSnapshot = await getDocs(checkoutQuery);
    
    if (!checkoutSnapshot.empty) {
      const record = checkoutSnapshot.docs[0].data();
      const checkoutTime = record.actualTime?.toDate ? record.actualTime.toDate() : new Date(record.actualTime);
      const timeStr = checkoutTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      alert(`이미 ${timeStr} 퇴근기록이 있습니다.`);
      return;
    }
    
    // 출근 기록 조회
    const checkInConstraints = [
      where('employeeId', '==', employee.employeeId),
      where('date', '==', todayStr),
      where('type', '==', 'checkin'),
    ];
    if (targetBranchId) {
      checkInConstraints.push(where('branchId', '==', targetBranchId));
    }
    const checkInQuery = query(collection(db, 'attendanceRecords'), ...checkInConstraints);
    
    const checkInSnapshot = await getDocs(checkInQuery);
    
    if (checkInSnapshot.empty) {
      alert('오늘 출근 기록이 없습니다. 먼저 출근 기록을 해주세요.');
      return;
    }
    
    const checkInRecord = checkInSnapshot.docs[0].data();
    const checkInTime = checkInRecord.actualTime?.toDate ? checkInRecord.actualTime.toDate() : new Date(checkInRecord.actualTime);
    
    // 스케줄 정보와 결합
    const employeeWithSchedule: EmployeeScheduleInfo = {
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      scheduledStartTime: (employee as EmployeeScheduleInfo).scheduledStartTime,
      scheduledEndTime: (employee as EmployeeScheduleInfo).scheduledEndTime,
      scheduledBreakTime: (employee as EmployeeScheduleInfo).scheduledBreakTime,
      hasSchedule: !!(employee as EmployeeScheduleInfo).scheduledEndTime
    };
    
    const actualTime = new Date();

    setSelectedEmployee({
      ...employeeWithSchedule,
      checkInTime,
      currentTime: actualTime
    });
    
    // 퇴근 시간 확인
    if (employeeWithSchedule.scheduledEndTime) {
      const scheduledTime = parseTimeString(employeeWithSchedule.scheduledEndTime);
      const result = checkAttendanceStatus(scheduledTime, actualTime);
      setCheckResult(result);

      // 출근과 동일하게: 정시가 아니면 바로 사유 입력 화면으로 이동
      if (result.status === 'late' || result.status === 'early') {
        setShowReasonInput(true);
      }
    }
    
    setShowCheckoutInfo(true);
  };

  const handleConfirmCheckOut = async () => {
    if (!selectedEmployee) return;

    try {
      const today = new Date();
      const todayStr = formatDate(today);
      const actualTime = new Date();

      // 퇴근 상태 확인
      let status: 'on_time' | 'late' | 'early' = 'on_time';
      let lateMinutes = 0;
      let earlyMinutes = 0;

      if (selectedEmployee.scheduledEndTime) {
        const scheduledTime = parseTimeString(selectedEmployee.scheduledEndTime);
        const result = checkAttendanceStatus(scheduledTime, actualTime);
        status = result.status;
        if (result.status === 'late') {
          lateMinutes = result.minutesDiff;
        } else if (result.status === 'early') {
          earlyMinutes = result.minutesDiff;
        }
      }

      // 퇴근 기록 저장
      const attendanceRecord: Omit<AttendanceRecord, 'id'> = {
        employeeId: selectedEmployee.employeeId,
        employeeName: selectedEmployee.employeeName,
        branchId: branchId || 'unknown',
        branchName: '',
        date: todayStr as any,
        type: 'checkout',
        scheduledStartTime: selectedEmployee.scheduledStartTime,
        scheduledEndTime: selectedEmployee.scheduledEndTime,
        scheduledBreakTime: selectedEmployee.scheduledBreakTime,
        actualTime: actualTime,
        status,
        lateMinutes: status === 'late' ? lateMinutes : undefined,
        earlyMinutes: status === 'early' ? earlyMinutes : undefined,
        reason: selectedReason || undefined,
        reasonOther: reasonOther || undefined,
        note: note || undefined,
        createdAt: actualTime
      };

      await addDoc(collection(db, 'attendanceRecords'), {
        ...attendanceRecord,
        date: todayStr,
        actualTime: Timestamp.fromDate(actualTime),
        createdAt: Timestamp.fromDate(actualTime)
      });

      alert('퇴근 기록이 완료되었습니다.\n오늘도 감사합니다.');
      router.push('/attendance');
    } catch (error) {
      console.error('퇴근 기록 저장 실패:', error);
      alert('퇴근 기록 저장 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center">
        <div className="text-3xl font-bold text-gray-700">로딩 중...</div>
      </div>
    );
  }

  if (showCheckoutInfo && selectedEmployee) {
    return (
      <CheckoutInfoScreen
        employee={selectedEmployee}
        checkResult={checkResult}
        onBack={() => {
          setShowCheckoutInfo(false);
          setSelectedEmployee(null);
          setCheckResult(null);
          setShowReasonInput(false);
          setSelectedReason('');
          setReasonOther('');
          setNote('');
        }}
        onConfirm={handleConfirmCheckOut}
        selectedReason={selectedReason}
        setSelectedReason={setSelectedReason}
        reasonOther={reasonOther}
        setReasonOther={setReasonOther}
        note={note}
        setNote={setNote}
        showReasonInput={showReasonInput}
        setShowReasonInput={setShowReasonInput}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/attendance')}
            className="text-4xl font-bold text-gray-700 hover:text-gray-900 transition-colors"
          >
            ← 뒤로
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-4xl font-bold text-gray-800">퇴근 기록</h1>
            {branchName && (
              <div className="text-2xl font-semibold text-orange-600 mt-2">
                {branchName}
              </div>
            )}
          </div>
          <div className="text-right w-56 text-sm text-gray-600 hidden md:block">
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

        {/* 오늘 스케줄 있는 직원 */}
        {employeesWithSchedule.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">오늘 스케줄 있는 직원목록</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {employeesWithSchedule.map((emp) => {
                const att = todayAttendanceMap.get(emp.employeeId);
                return (
                  <button
                    key={emp.employeeId}
                    onClick={() => handleEmployeeSelect(emp)}
                    className="h-24 bg-white rounded-2xl shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-105 active:scale-95 flex flex-col items-center justify-center text-xl font-semibold text-gray-800"
                  >
                    <div>{emp.employeeName}</div>
                    {(att?.checkIn || att?.checkOut) && (
                      <div className="mt-1 text-xs font-normal text-gray-500 space-y-0.5 text-center">
                        {att.checkIn && <div>출근 {att.checkIn}</div>}
                        {att.checkOut && <div>퇴근 {att.checkOut}</div>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 스케줄 없지만 출근 기록 있는 직원 */}
        {employeesWithCheckIn.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">
              스케줄은 없지만 출근기록이 있는 직원목록
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {employeesWithCheckIn.map((emp) => {
                const att = todayAttendanceMap.get(emp.employeeId);
                return (
                  <button
                    key={emp.employeeId}
                    onClick={() => handleEmployeeSelect(emp)}
                    className="h-24 bg-gray-100 rounded-2xl shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-105 active:scale-95 flex flex-col items-center justify-center text-xl font-semibold text-gray-600"
                  >
                    <div>{emp.employeeName}</div>
                    {(att?.checkIn || att?.checkOut) && (
                      <div className="mt-1 text-xs font-normal text-gray-500 space-y-0.5 text-center">
                        {att.checkIn && <div>출근 {att.checkIn}</div>}
                        {att.checkOut && <div>퇴근 {att.checkOut}</div>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {employeesWithSchedule.length === 0 && employeesWithCheckIn.length === 0 && (
          <div className="text-center text-2xl text-gray-600 mt-20">
            오늘 퇴근할 직원이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

// 퇴근 정보 화면 컴포넌트
function CheckoutInfoScreen({
  employee,
  checkResult,
  onBack,
  onConfirm,
  selectedReason,
  setSelectedReason,
  reasonOther,
  setReasonOther,
  note,
  setNote,
  showReasonInput,
  setShowReasonInput
}: {
  employee: any;
  checkResult: any;
  onBack: () => void;
  onConfirm: () => void;
  selectedReason: string;
  setSelectedReason: (reason: string) => void;
  reasonOther: string;
  setReasonOther: (reason: string) => void;
  note: string;
  setNote: (note: string) => void;
  showReasonInput: boolean;
  setShowReasonInput: (show: boolean) => void;
}) {
  // 스케줄 기준 휴게시간(분)
  const scheduledBreakMinutes = (() => {
    if (!employee.scheduledBreakTime || employee.scheduledBreakTime === 0) return 0;
    return Math.round(employee.scheduledBreakTime * 60);
  })();

  // 실제 근무시간(분) - 출근 시각 ~ 현재 시각
  const actualWorkMinutes = (() => {
    if (!employee.checkInTime || !employee.currentTime) return null;
    const workMs = employee.currentTime.getTime() - employee.checkInTime.getTime();
    if (workMs <= 0) return null;
    return Math.floor(workMs / (1000 * 60));
  })();

  const isOnTime = checkResult?.status === 'on_time';

  // 실제 적용 휴게시간(분)
  const effectiveBreakMinutes = (() => {
    if (actualWorkMinutes == null) return scheduledBreakMinutes;

    // ±30분 이내(정시)면 스케줄 휴게시간 그대로
    if (isOnTime) return scheduledBreakMinutes;

    // 그 이외에는 법정 휴게시간 기준: 4시간마다 30분
    const legalUnits = Math.floor(actualWorkMinutes / 240); // 240분 = 4시간
    const legalBreak = legalUnits * 30;
    return legalBreak;
  })();

  const scheduledBreakDisplay = (() => {
    if (!scheduledBreakMinutes || scheduledBreakMinutes === 0) return '0시간';
    const hours = Math.floor(scheduledBreakMinutes / 60);
    const minutes = scheduledBreakMinutes % 60;

    if (hours > 0 && minutes > 0) {
      return `${hours}시간 ${minutes}분`;
    } else if (hours > 0) {
      return `${hours}시간`;
    } else {
      return `${minutes}분`;
    }
  })();

  const effectiveBreakDisplay = (() => {
    if (!effectiveBreakMinutes || effectiveBreakMinutes === 0) return '0시간';
    const hours = Math.floor(effectiveBreakMinutes / 60);
    const minutes = effectiveBreakMinutes % 60;

    if (hours > 0 && minutes > 0) {
      return `${hours}시간 ${minutes}분`;
    } else if (hours > 0) {
      return `${hours}시간`;
    } else {
      return `${minutes}분`;
    }
  })();

  const isBreakRecalculated =
    actualWorkMinutes != null &&
    !isOnTime &&
    effectiveBreakMinutes > 0;

  // 총 근무시간 (출근 시각 ~ 현재 시각, 휴게시간 차감 후)
  const totalWorkDisplay = (() => {
    if (actualWorkMinutes == null) return null;
    const netMinutes = Math.max(0, actualWorkMinutes - (effectiveBreakMinutes || 0));
    const hours = Math.floor(netMinutes / 60);
    const minutes = netMinutes % 60;
    if (hours > 0 && minutes > 0) {
      return `${hours}시간 ${minutes}분`;
    } else if (hours > 0) {
      return `${hours}시간`;
    } else {
      return `${minutes}분`;
    }
  })();

  // 근무스케줄 기준 총 근무시간 (시작~종료 - 휴게시간)
  const scheduleTotalDisplay = (() => {
    if (!employee.scheduledStartTime || !employee.scheduledEndTime) return null;
    const [startH, startM] = employee.scheduledStartTime.split(':').map(Number);
    const [endH, endM] = employee.scheduledEndTime.split(':').map(Number);
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), startH, startM, 0);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), endH, endM, 0);
    let minutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    if (scheduledBreakMinutes) {
      minutes -= scheduledBreakMinutes;
    }
    if (minutes <= 0) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
      return `${hours}시간 ${mins}분`;
    } else if (hours > 0) {
      return `${hours}시간`;
    } else {
      return `${mins}분`;
    }
  })();

  // 스케줄과의 근무시간 차이 = (실제 근무시간 - 스케줄 기준 근무시간)
  const diffDisplay = (() => {
    if (actualWorkMinutes == null || !employee.scheduledStartTime || !employee.scheduledEndTime) {
      return null;
    }

    // 실제 근무시간(분) - 휴게시간 차감
    const netActualMinutes = Math.max(0, actualWorkMinutes - (effectiveBreakMinutes || 0));

    // 스케줄 근무시간(분) - 스케줄 휴게시간 차감
    const [sH, sM] = employee.scheduledStartTime.split(':').map(Number);
    const [eH, eM] = employee.scheduledEndTime.split(':').map(Number);
    const today = new Date();
    const s = new Date(today.getFullYear(), today.getMonth(), today.getDate(), sH, sM, 0);
    const e = new Date(today.getFullYear(), today.getMonth(), today.getDate(), eH, eM, 0);
    let scheduledMinutes = Math.floor((e.getTime() - s.getTime()) / (1000 * 60));
    if (scheduledBreakMinutes) {
      scheduledMinutes -= scheduledBreakMinutes;
    }
    if (scheduledMinutes < 0) scheduledMinutes = 0;

    const diff = netActualMinutes - scheduledMinutes;
    if (diff === 0) return '0분';

    const sign = diff >= 0 ? '+' : '-';
    const absMinutes = Math.abs(diff);
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;
    const hoursPart = hours > 0 ? `${hours}시간` : '';
    const minutesPart = minutes > 0 ? `${minutes}분` : hours === 0 ? `${minutes}분` : '';
    return `${sign}${hoursPart}${minutesPart || ''}`.trim();
  })();

  // 정시 퇴근
  if (checkResult?.status === 'on_time' && !showReasonInput) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full text-center">
          <div className="text-6xl mb-6">✅</div>
          <p className="text-3xl font-bold text-green-600 mb-4">
            정시 퇴근입니다.
          </p>
          {totalWorkDisplay && (
            <p className="text-2xl font-semibold text-gray-700 mb-2">
              오늘 총 근무시간: {totalWorkDisplay}
            </p>
          )}
          <p className="text-xl text-gray-600 mb-2">
            오늘 총 휴게시간: {effectiveBreakDisplay}
          </p>
          {isBreakRecalculated && (
            <p className="text-sm text-red-500 mb-6">
              * 참고 : 법정기준휴게시간 4시간마다 30분
            </p>
          )}
          {/* 전달사항 (선택사항)만 입력 가능 */}
          <div className="mb-8 text-left">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="전달사항 (선택사항)"
              className="w-full h-24 p-4 border-2 border-gray-300 rounded-xl text-lg resize-none focus:outline-none focus:border-green-500"
            />
          </div>
          <button
            onClick={onConfirm}
            className="w-full h-16 bg-green-500 hover:bg-green-600 text-white text-2xl font-bold rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95"
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  // 늦게 퇴근
  if (checkResult?.status === 'late' && !showReasonInput) {
    const workMinutes = checkResult.minutesDiff;
    const workHours = Math.floor(workMinutes / 60);
    const workMins = workMinutes % 60;
    const workTimeDisplay = workHours > 0 
      ? `${workHours}시간 ${workMins}분`
      : `${workMins}분`;

    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full text-center">
          <div className="text-6xl mb-6">⏰</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            {workTimeDisplay} 더 근무하셨습니다.
          </h2>
          {totalWorkDisplay && (
            <p className="text-2xl font-semibold text-gray-700 mb-2">
              오늘 총 근무시간: {totalWorkDisplay}
            </p>
          )}
          <p className="text-xl text-gray-600 mb-2">
            오늘 총 휴게시간: {effectiveBreakDisplay}
          </p>
          <p className="text-base text-gray-500 mb-6">
            (정시퇴근을 권장드립니다. 사유를 선택하거나 바로 퇴근 기록을 완료할 수 있습니다.)
          </p>
          <button
            onClick={() => setShowReasonInput(true)}
            className="w-full h-16 bg-blue-500 hover:bg-blue-600 text-white text-xl font-bold rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95 mb-4"
          >
            사유입력
          </button>
          <button
            onClick={onConfirm}
            className="w-full h-16 bg-green-500 hover:bg-green-600 text-white text-xl font-bold rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95"
          >
            확인 - 오늘도 감사합니다.
          </button>
        </div>
      </div>
    );
  }

  // 일찍 퇴근
  if (checkResult?.status === 'early' && !showReasonInput) {
    // 출근 시간부터 현재까지의 근무시간 계산
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full text-center">
          <div className="text-6xl mb-6">⚠️</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            오늘의 근무시간은 {totalWorkDisplay || '0분'}까지입니다.
          </h2>
          <p className="text-xl text-gray-600 mb-2">
            오늘 총 휴게시간: {effectiveBreakDisplay}
          </p>
          <p className="text-xl text-gray-600 mb-8">
            일찍 퇴근하시는 사유를 알려주세요.
          </p>
          <button
            onClick={() => setShowReasonInput(true)}
            className="w-full h-16 bg-orange-500 hover:bg-orange-600 text-white text-xl font-bold rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95 mb-4"
          >
            사유입력칸
          </button>
        </div>
      </div>
    );
  }

  // 스케줄 없는 경우
  if (!employee.scheduledEndTime && !showReasonInput) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-8">
            {employee.employeeName} 님
          </h2>
          <p className="text-2xl text-gray-700 mb-8">
            스케줄이 없지만 출근 기록이 있습니다.
          </p>
          <button
            onClick={onConfirm}
            className="w-full h-16 bg-green-500 hover:bg-green-600 text-white text-2xl font-bold rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95 mb-4"
          >
            퇴근 기록하기 - 오늘도 감사합니다.
          </button>
          <button
            onClick={onBack}
            className="w-full h-16 bg-gray-300 hover:bg-gray-400 text-gray-800 text-xl font-bold rounded-2xl shadow-lg"
          >
            뒤로
          </button>
        </div>
      </div>
    );
  }

  // 사유 입력 화면
  if (showReasonInput) {
    const checkInTimeDisplay =
      employee.checkInTime instanceof Date
        ? employee.checkInTime.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
        : '';
    const checkOutTimeDisplay =
      employee.currentTime instanceof Date
        ? employee.currentTime.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
        : '';

    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full">
          {/* 스케줄 정보 카드 (출근 화면과 유사) */}
          {employee.scheduledStartTime && employee.scheduledEndTime && (
            <div className="mb-8 text-center">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">
                금일 {employee.employeeName} 님 근무 정보
              </h3>
              <div className="inline-flex flex-col items-start bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-base text-gray-700">
                <p className="mb-1">
                  <span className="font-semibold text-gray-600">근무스케줄</span>
                  <span className="ml-2 tabular-nums">
                    {employee.scheduledStartTime} - {employee.scheduledEndTime}
                  </span>
                  <span className="ml-3 text-sm text-gray-500">
                    휴게시간 {scheduledBreakDisplay}
                    {scheduleTotalDisplay && ` (총 ${scheduleTotalDisplay})`}
                  </span>
                </p>
                <p className="mb-1">
                  <span className="font-semibold text-gray-600">실근무시간</span>
                  <span className="ml-2 tabular-nums">
                    {checkInTimeDisplay} - {checkOutTimeDisplay}
                  </span>
                  <span className="ml-3 text-sm text-gray-500">
                    휴게시간 {effectiveBreakDisplay}
                    {totalWorkDisplay && ` (총 ${totalWorkDisplay})`}
                  </span>
                </p>
                {isBreakRecalculated && (
                  <p className="mt-1 text-xs text-red-500">
                    * 참고 : 법정기준휴게시간 4시간마다 30분
                  </p>
                )}
                <p className="mt-1">
                  <span className="font-semibold text-gray-600">스케줄과의 근무시간차이</span>
                  <span className="ml-2 text-red-500 tabular-nums">{diffDisplay || '0분'}</span>
                </p>
              </div>
            </div>
          )}

          {/* 사유 선택 영역 */}
          <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            퇴근 시각이 스케줄과 다른 사유 선택
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {['사장님 요청', '매장이 바빠서', '개인사정', '기타'].map((reason) => (
              <button
                key={reason}
                onClick={() => setSelectedReason(reason)}
                className={`h-14 rounded-xl font-semibold text-lg transition-all duration-200 ${
                  selectedReason === reason
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
          {selectedReason === '기타' && (
            <textarea
              value={reasonOther}
              onChange={(e) => setReasonOther(e.target.value)}
              placeholder="사유를 입력하세요"
              className="w-full h-24 p-4 border-2 border-gray-300 rounded-xl text-lg resize-none focus:outline-none focus:border-blue-500 mb-4"
            />
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="전달사항 (선택사항)"
            className="w-full h-24 p-4 border-2 border-gray-300 rounded-xl text-lg resize-none focus:outline-none focus:border-blue-500 mb-6"
          />
          <div className="flex space-x-4">
            <button
              onClick={onBack}
              className="flex-1 h-14 bg-gray-300 hover:bg-gray-400 text-gray-800 text-xl font-bold rounded-xl shadow-lg"
            >
              뒤로
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 h-14 bg-green-500 hover:bg-green-600 text-white text-xl font-bold rounded-xl shadow-lg"
            >
              확인 - 오늘도 감사합니다.
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function CheckOutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center">
        <div className="text-3xl font-bold text-gray-700">로딩 중...</div>
      </div>
    }>
      <CheckOutPageContent />
    </Suspense>
  );
}

