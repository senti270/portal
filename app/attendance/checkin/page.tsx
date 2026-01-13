'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EmployeeScheduleInfo, AttendanceRecord } from '@/types/attendance';
import { checkAttendanceStatus, parseTimeString, formatDate } from '@/lib/attendance-utils';
import { toLocalDate, toLocalDateString } from '@/utils/work-schedule/dateUtils';

function CheckInPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branchId = searchParams.get('branchId') || ''; // 나중에 매장별 접근 제어 시 사용
  
  const [loading, setLoading] = useState(true);
  const [employeesWithSchedule, setEmployeesWithSchedule] = useState<EmployeeScheduleInfo[]>([]);
  const [employeesWithoutSchedule, setEmployeesWithoutSchedule] = useState<EmployeeScheduleInfo[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeScheduleInfo | null>(null);
  const [showScheduleInfo, setShowScheduleInfo] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [reasonOther, setReasonOther] = useState('');
  const [note, setNote] = useState('');
  const [showManualTimeInput, setShowManualTimeInput] = useState(false);
  const [manualCheckInTime, setManualCheckInTime] = useState('');

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
      const scheduledEmployeeIds = new Set<string>();
      
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
          scheduledEmployeeIds.add(employeeId);
        }
      });
      
      setEmployeesWithSchedule(Array.from(employeeMap.values()));
      
      // 스케줄 없는 직원 조회 (전체 직원에서 스케줄 있는 직원 제외)
      // 나중에 지점별 필터링 추가 필요
      const allEmployeesSnapshot = await getDocs(collection(db, 'employees'));
      const withoutSchedule: EmployeeScheduleInfo[] = [];
      
      allEmployeesSnapshot.docs.forEach(doc => {
        if (!scheduledEmployeeIds.has(doc.id)) {
          withoutSchedule.push({
            employeeId: doc.id,
            employeeName: doc.data().name || '',
            hasSchedule: false
          });
        }
      });
      
      setEmployeesWithoutSchedule(withoutSchedule);
    } catch (error) {
      console.error('직원 목록 로드 실패:', error);
      alert('직원 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeSelect = async (employee: EmployeeScheduleInfo) => {
    // 이미 출근 기록이 있는지 확인
    const hasExisting = await checkExistingCheckIn(employee.employeeId);
    if (hasExisting) {
      return; // 이미 출근 기록이 있으면 종료
    }
    
    setSelectedEmployee(employee);
    setShowScheduleInfo(true);
    
    // 출근 시간 확인
    if (employee.scheduledStartTime) {
      const scheduledTime = parseTimeString(employee.scheduledStartTime);
      const actualTime = new Date();
      const result = checkAttendanceStatus(scheduledTime, actualTime);
      setCheckResult(result);
    } else {
      setCheckResult({
        status: 'on_time',
        minutesDiff: 0,
        message: '스케줄 정보가 없습니다.'
      });
    }
  };

  const checkExistingCheckIn = async (employeeId: string): Promise<boolean> => {
    try {
      const today = new Date();
      const todayStr = formatDate(today);
      
      const attendanceQuery = query(
        collection(db, 'attendanceRecords'),
        where('employeeId', '==', employeeId),
        where('date', '==', todayStr),
        where('type', '==', 'checkin')
      );
      
      const attendanceSnapshot = await getDocs(attendanceQuery);
      
      if (!attendanceSnapshot.empty) {
        const record = attendanceSnapshot.docs[0].data();
        const checkInTime = record.actualTime?.toDate ? record.actualTime.toDate() : new Date(record.actualTime);
        const timeStr = checkInTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        alert(`이미 ${timeStr} 출근기록이 있습니다.`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('출근 기록 확인 실패:', error);
      return false;
    }
  };

  const handleConfirmCheckIn = async () => {
    if (!selectedEmployee) return;

    try {
      const today = new Date();
      const todayStr = formatDate(today);
      const actualTime = new Date();

      // 출근 상태 확인
      let status: 'on_time' | 'late' | 'early' = 'on_time';
      let lateMinutes = 0;
      let earlyMinutes = 0;

      if (selectedEmployee.scheduledStartTime) {
        const scheduledTime = parseTimeString(selectedEmployee.scheduledStartTime);
        const result = checkAttendanceStatus(scheduledTime, actualTime);
        status = result.status;
        if (result.status === 'late') {
          lateMinutes = result.minutesDiff;
        } else if (result.status === 'early') {
          earlyMinutes = result.minutesDiff;
        }
      }

      // 수동 입력 시간이 있으면 사용
      let actualCheckInTime = actualTime;
      if (manualCheckInTime) {
        const [hours, minutes] = manualCheckInTime.split(':').map(Number);
        actualCheckInTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, 0);
        
        // 수동 입력 시간으로 상태 다시 계산
        if (selectedEmployee.scheduledStartTime) {
          const scheduledTime = parseTimeString(selectedEmployee.scheduledStartTime);
          const result = checkAttendanceStatus(scheduledTime, actualCheckInTime);
          status = result.status;
          if (result.status === 'late') {
            lateMinutes = result.minutesDiff;
            earlyMinutes = 0;
          } else if (result.status === 'early') {
            earlyMinutes = result.minutesDiff;
            lateMinutes = 0;
          } else {
            lateMinutes = 0;
            earlyMinutes = 0;
          }
        }
      }

      // 출근 기록 저장
      const attendanceRecord: Omit<AttendanceRecord, 'id'> = {
        employeeId: selectedEmployee.employeeId,
        employeeName: selectedEmployee.employeeName,
        branchId: branchId || 'unknown', // 나중에 실제 지점 ID로 변경
        branchName: '', // 나중에 지점명 조회
        date: todayStr as any,
        type: 'checkin',
        scheduledStartTime: selectedEmployee.scheduledStartTime,
        scheduledEndTime: selectedEmployee.scheduledEndTime,
        scheduledBreakTime: selectedEmployee.scheduledBreakTime,
        actualTime: actualCheckInTime,
        actualTimeManual: manualCheckInTime ? actualCheckInTime : undefined,
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
        actualTime: Timestamp.fromDate(actualCheckInTime),
        actualTimeManual: manualCheckInTime ? Timestamp.fromDate(actualCheckInTime) : undefined,
        createdAt: Timestamp.fromDate(actualTime)
      });

      alert('출근 기록이 완료되었습니다.');
      router.push('/attendance');
    } catch (error) {
      console.error('출근 기록 저장 실패:', error);
      alert('출근 기록 저장 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-3xl font-bold text-gray-700">로딩 중...</div>
      </div>
    );
  }

  if (showScheduleInfo && selectedEmployee) {
    return (
      <ScheduleInfoScreen
        employee={selectedEmployee}
        checkResult={checkResult}
        onBack={() => {
          setShowScheduleInfo(false);
          setSelectedEmployee(null);
          setCheckResult(null);
          setShowReasonInput(false);
          setShowManualTimeInput(false);
          setManualCheckInTime('');
          setSelectedReason('');
          setReasonOther('');
          setNote('');
        }}
        onConfirm={handleConfirmCheckIn}
        selectedReason={selectedReason}
        setSelectedReason={setSelectedReason}
        reasonOther={reasonOther}
        setReasonOther={setReasonOther}
        note={note}
        setNote={setNote}
        showReasonInput={showReasonInput}
        setShowReasonInput={setShowReasonInput}
        showManualTimeInput={showManualTimeInput}
        setShowManualTimeInput={setShowManualTimeInput}
        manualCheckInTime={manualCheckInTime}
        setManualCheckInTime={setManualCheckInTime}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/attendance')}
            className="text-4xl font-bold text-gray-700 hover:text-gray-900 transition-colors"
          >
            ← 뒤로
          </button>
          <h1 className="text-4xl font-bold text-gray-800">출근 기록</h1>
          <div className="w-20"></div>
        </div>

        {/* 오늘 스케줄 있는 직원 */}
        {employeesWithSchedule.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">오늘 스케줄에 있는 직원목록</h2>
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

        {/* 오늘 스케줄 없는 직원 */}
        {employeesWithoutSchedule.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">오늘 스케줄 없는 직원목록</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {employeesWithoutSchedule.map((emp) => (
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

        {employeesWithSchedule.length === 0 && employeesWithoutSchedule.length === 0 && (
          <div className="text-center text-2xl text-gray-600 mt-20">
            오늘 출근할 직원이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

// 스케줄 정보 화면 컴포넌트
function ScheduleInfoScreen({
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
  setShowReasonInput,
  showManualTimeInput,
  setShowManualTimeInput,
  manualCheckInTime,
  setManualCheckInTime
}: {
  employee: EmployeeScheduleInfo;
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
  showManualTimeInput: boolean;
  setShowManualTimeInput: (show: boolean) => void;
  manualCheckInTime: string;
  setManualCheckInTime: (time: string) => void;
}) {
  const breakTimeDisplay = employee.scheduledBreakTime
    ? `${Math.floor(employee.scheduledBreakTime)}분`
    : '00분';

  // 정시 출근
  if (checkResult?.status === 'on_time' && !showReasonInput) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full text-center">
          <div className="text-6xl mb-6">✅</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-8">
            금일 {employee.employeeName} 님은
          </h2>
          {employee.scheduledStartTime && employee.scheduledEndTime ? (
            <>
              <p className="text-2xl text-gray-700 mb-4">
                {employee.scheduledStartTime} - {employee.scheduledEndTime} 근무스케줄이며
              </p>
              <p className="text-2xl text-gray-700 mb-8">
                휴게시간은 {breakTimeDisplay}입니다.
              </p>
            </>
          ) : (
            <p className="text-2xl text-gray-700 mb-8">
              스케줄이 없습니다.
            </p>
          )}
          <p className="text-3xl font-bold text-green-600 mb-8">
            정각 출근 멋지세요!
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

  // 실제 출근 시각 입력 화면
  if (showManualTimeInput) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full">
          <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">
            실제 출근 시각을 입력해주세요
          </h2>
          <div className="mb-6">
            <label className="block text-xl font-semibold text-gray-700 mb-3">
              출근 시각
            </label>
            <input
              type="time"
              value={manualCheckInTime}
              onChange={(e) => setManualCheckInTime(e.target.value)}
              className="w-full h-20 text-3xl text-center border-4 border-gray-300 rounded-2xl focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => {
                setShowManualTimeInput(false);
                setManualCheckInTime('');
              }}
              className="flex-1 h-16 bg-gray-300 hover:bg-gray-400 text-gray-800 text-xl font-bold rounded-2xl shadow-lg"
            >
              뒤로
            </button>
            <button
              onClick={() => {
                if (!manualCheckInTime) {
                  alert('출근 시각을 입력해주세요.');
                  return;
                }
                setShowManualTimeInput(false);
                setShowReasonInput(true);
              }}
              className="flex-1 h-16 bg-blue-500 hover:bg-blue-600 text-white text-xl font-bold rounded-2xl shadow-lg"
            >
              다음 (전달사항 입력)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 지각
  if (checkResult?.status === 'late' && !showReasonInput && !showManualTimeInput) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full text-center">
          <div className="text-6xl mb-6">⏰</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            {checkResult.minutesDiff}분 지각하셨습니다.
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            시급에 반영될 수 있습니다.
          </p>
          <div className="space-y-4 mb-8">
            <button
              onClick={() => setShowReasonInput(true)}
              className="w-full h-16 bg-blue-500 hover:bg-blue-600 text-white text-xl font-bold rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95"
            >
              네
            </button>
            <button
              onClick={() => setShowManualTimeInput(true)}
              className="w-full h-16 bg-gray-300 hover:bg-gray-400 text-gray-800 text-xl font-bold rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95"
            >
              아니오 (출근은 제때했으나 출근을 늦게 찍었습니다)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 일찍 출근
  if (checkResult?.status === 'early' && !showReasonInput && !showManualTimeInput) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full text-center">
          <div className="text-6xl mb-6">👏</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            {checkResult.minutesDiff}분 빨리 오셨습니다
          </h2>
          <div className="space-y-4 mb-8">
            <button
              onClick={onConfirm}
              className="w-full h-16 bg-blue-500 hover:bg-blue-600 text-white text-xl font-bold rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95"
            >
              네 (휴식하셨다가 스케줄 시간부터 일해주시기를 권장드립니다)
            </button>
            <button
              onClick={() => setShowReasonInput(true)}
              className="w-full h-16 bg-orange-500 hover:bg-orange-600 text-white text-xl font-bold rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95"
            >
              아니오 (지금부터 일하겠습니다)
            </button>
          </div>
          {showReasonInput && (
            <EarlyCheckInReasonForm
              selectedReason={selectedReason}
              setSelectedReason={setSelectedReason}
              reasonOther={reasonOther}
              setReasonOther={setReasonOther}
              note={note}
              setNote={setNote}
              onConfirm={onConfirm}
              onBack={() => setShowReasonInput(false)}
            />
          )}
        </div>
      </div>
    );
  }

  // 스케줄 정보만 표시 (스케줄 없는 경우)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-8">
          금일 {employee.employeeName} 님은
        </h2>
        <p className="text-2xl text-gray-700 mb-8">
          스케줄이 없습니다.
        </p>
        <div className="space-y-4">
          <button
            onClick={onConfirm}
            className="w-full h-16 bg-green-500 hover:bg-green-600 text-white text-2xl font-bold rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95"
          >
            출근 기록하기
          </button>
          <button
            onClick={onBack}
            className="w-full h-16 bg-gray-300 hover:bg-gray-400 text-gray-800 text-xl font-bold rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95"
          >
            뒤로
          </button>
        </div>
      </div>
    </div>
  );
}

// 일찍 출근 사유 선택 폼 컴포넌트
function EarlyCheckInReasonForm({
  selectedReason,
  setSelectedReason,
  reasonOther,
  setReasonOther,
  note,
  setNote,
  onConfirm,
  onBack
}: {
  selectedReason: string;
  setSelectedReason: (reason: string) => void;
  reasonOther: string;
  setReasonOther: (reason: string) => void;
  note: string;
  setNote: (note: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const reasons = [
    '사장님 요청으로 일찍 출근했습니다',
    '매장이 바빠보여 지금부터 일하겠습니다'
  ];

  return (
    <div className="mt-8 space-y-4">
      <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">사유 선택</h3>
      <div className="space-y-3 mb-4">
        {reasons.map((reason) => (
          <button
            key={reason}
            onClick={() => setSelectedReason(reason)}
            className={`w-full h-16 rounded-xl font-semibold text-lg transition-all duration-200 ${
              selectedReason === reason
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {reason}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="전달사항 (선택사항)"
        className="w-full h-24 p-4 border-2 border-gray-300 rounded-xl text-lg resize-none focus:outline-none focus:border-blue-500"
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
          disabled={!selectedReason}
          className={`flex-1 h-14 text-white text-xl font-bold rounded-xl shadow-lg ${
            selectedReason
              ? 'bg-green-500 hover:bg-green-600'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          확인
        </button>
      </div>
    </div>
  );
}

// 사유 입력 폼 컴포넌트 (지각/일반)
function ReasonInputForm({
  selectedReason,
  setSelectedReason,
  reasonOther,
  setReasonOther,
  note,
  setNote,
  onConfirm,
  onBack
}: {
  selectedReason: string;
  setSelectedReason: (reason: string) => void;
  reasonOther: string;
  setReasonOther: (reason: string) => void;
  note: string;
  setNote: (note: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const reasons = [
    '매장이 바빠서',
    '사장님 요청',
    '개인사정',
    '교통사고',
    '기타'
  ];

  return (
    <div className="mt-8 space-y-4">
      <h3 className="text-xl font-bold text-gray-800 mb-4">사유 선택</h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
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
          className="w-full h-24 p-4 border-2 border-gray-300 rounded-xl text-lg resize-none focus:outline-none focus:border-blue-500"
        />
      )}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="전달사항 (선택사항)"
        className="w-full h-24 p-4 border-2 border-gray-300 rounded-xl text-lg resize-none focus:outline-none focus:border-blue-500"
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
          확인
        </button>
      </div>
    </div>
  );
}

