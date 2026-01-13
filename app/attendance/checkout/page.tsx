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
  const [employeesWithSchedule, setEmployeesWithSchedule] = useState<EmployeeScheduleInfo[]>([]);
  const [employeesWithCheckIn, setEmployeesWithCheckIn] = useState<Array<{employeeId: string; employeeName: string}>>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showCheckoutInfo, setShowCheckoutInfo] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [reasonOther, setReasonOther] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    loadEmployees();
  }, [branchId]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const todayStr = formatDate(today);
      
      // 모든 스케줄 조회 후 클라이언트에서 필터링
      const schedulesQuery = collection(db, 'schedules');
      const schedulesSnapshot = await getDocs(schedulesQuery);
      
      const employeeMap = new Map<string, EmployeeScheduleInfo>();
      
      // 오늘 날짜 필터링 (클라이언트 사이드)
      schedulesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const scheduleDate = toLocalDate(data.date);
        const scheduleDateStr = toLocalDateString(scheduleDate);
        
        // 오늘 날짜인 스케줄만 포함
        if (scheduleDateStr !== todayStr) return;
        
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
      
      // 오늘 출근 기록이 있는 직원 조회 (스케줄은 없지만)
      const checkInQuery = query(
        collection(db, 'attendanceRecords'),
        where('date', '==', todayStr),
        where('type', '==', 'checkin')
      );
      
      const checkInSnapshot = await getDocs(checkInQuery);
      const checkInEmployeeIds = new Set(
        Array.from(employeeMap.keys())
      );
      
      const employeesWithCheckInOnly: Array<{employeeId: string; employeeName: string}> = [];
      
      checkInSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!checkInEmployeeIds.has(data.employeeId)) {
          employeesWithCheckInOnly.push({
            employeeId: data.employeeId,
            employeeName: data.employeeName || ''
          });
        }
      });
      
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
    const checkoutQuery = query(
      collection(db, 'attendanceRecords'),
      where('employeeId', '==', employee.employeeId),
      where('date', '==', todayStr),
      where('type', '==', 'checkout')
    );
    
    const checkoutSnapshot = await getDocs(checkoutQuery);
    
    if (!checkoutSnapshot.empty) {
      const record = checkoutSnapshot.docs[0].data();
      const checkoutTime = record.actualTime?.toDate ? record.actualTime.toDate() : new Date(record.actualTime);
      const timeStr = checkoutTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      alert(`이미 ${timeStr} 퇴근기록이 있습니다.`);
      return;
    }
    
    // 출근 기록 조회
    const checkInQuery = query(
      collection(db, 'attendanceRecords'),
      where('employeeId', '==', employee.employeeId),
      where('date', '==', todayStr),
      where('type', '==', 'checkin')
    );
    
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
    
    setSelectedEmployee({
      ...employeeWithSchedule,
      checkInTime
    });
    
    // 퇴근 시간 확인
    if (employeeWithSchedule.scheduledEndTime) {
      const scheduledTime = parseTimeString(employeeWithSchedule.scheduledEndTime);
      const actualTime = new Date();
      const result = checkAttendanceStatus(scheduledTime, actualTime);
      setCheckResult(result);
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
          <h1 className="text-4xl font-bold text-gray-800">퇴근 기록</h1>
          <div className="w-20"></div>
        </div>

        {/* 오늘 스케줄 있는 직원 */}
        {employeesWithSchedule.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">오늘 스케줄 있는 직원목록</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {employeesWithSchedule.map((emp) => (
                <button
                  key={emp.employeeId}
                  onClick={() => handleEmployeeSelect(emp)}
                  className="h-24 bg-white rounded-2xl shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center text-xl font-semibold text-gray-800"
                >
                  {emp.employeeName}
                </button>
              ))}
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
              {employeesWithCheckIn.map((emp) => (
                <button
                  key={emp.employeeId}
                  onClick={() => handleEmployeeSelect(emp)}
                  className="h-24 bg-gray-100 rounded-2xl shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center text-xl font-semibold text-gray-600"
                >
                  {emp.employeeName}
                </button>
              ))}
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
  // 정시 퇴근
  if (checkResult?.status === 'on_time' && !showReasonInput) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full text-center">
          <div className="text-6xl mb-6">✅</div>
          <p className="text-3xl font-bold text-green-600 mb-8">
            정시 퇴근입니다.
          </p>
          <p className="text-2xl font-semibold text-gray-700 mb-8">
            오늘도 수고하셨습니다!
          </p>
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
          <p className="text-xl text-gray-600 mb-8">
            정시퇴근을 권장드립니다.
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
    const checkInTime = employee.checkInTime;
    const now = new Date();
    const workMs = now.getTime() - checkInTime.getTime();
    const workMinutes = Math.floor(workMs / (1000 * 60));
    const workHours = Math.floor(workMinutes / 60);
    const workMins = workMinutes % 60;
    const workTimeDisplay = workHours > 0 
      ? `${workHours}시간 ${workMins}분`
      : `${workMins}분`;

    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full text-center">
          <div className="text-6xl mb-6">⚠️</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            오늘의 근무시간은 {workTimeDisplay}까지입니다.
          </h2>
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
    const reasons = [
      '매장이 바빠서',
      '사장님 요청',
      '개인사정',
      '교통사고',
      '기타'
    ];

    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">사유 선택</h3>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {reasons.map((reason) => (
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
              onClick={() => setShowReasonInput(false)}
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

