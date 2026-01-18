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
  // 테스트용: 기본값으로 청담장어마켓 송파점 사용 (나중에 지점 ID로 변경 필요)
  const branchId = searchParams.get('branchId') || '';
  
  const [loading, setLoading] = useState(true);
  const [branchName, setBranchName] = useState<string>('');
  const [targetBranchId, setTargetBranchId] = useState<string>('');
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
    // 초기 로딩
    loadEmployees();
    
    // 5분마다 데이터 새로고침 (스케줄 변경 시 반영)
    const refreshInterval = setInterval(() => {
      loadEmployees();
    }, 5 * 60 * 1000); // 5분 = 5 * 60 * 1000ms
    
    // 컴포넌트 언마운트 시 인터벌 정리
    return () => clearInterval(refreshInterval);
  }, [branchId]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const todayStr = formatDate(today);
      
      // 지점 정보 로드 (지점명 표시용)
      let targetBranchId = branchId;
      let targetBranchName = '';
      
      if (targetBranchId) {
        // 지점 ID로 지점명 조회
        try {
          const branchDoc = await getDocs(query(collection(db, 'branches'), where('__name__', '==', targetBranchId)));
          if (!branchDoc.empty) {
            targetBranchName = branchDoc.docs[0].data().name || '';
          }
        } catch (e) {
          // 지점 ID로 조회 실패 시 이름으로 조회
          const branchesSnapshot = await getDocs(collection(db, 'branches'));
          const branch = branchesSnapshot.docs.find(doc => doc.id === targetBranchId);
          if (branch) {
            targetBranchName = branch.data().name || '';
          }
        }
      } else {
        // 테스트용: 청담장어마켓 송파점 찾기
        const branchesSnapshot = await getDocs(collection(db, 'branches'));
        const testBranch = branchesSnapshot.docs.find(doc => 
          doc.data().name?.includes('송파') || doc.data().name?.includes('청담')
        );
        if (testBranch) {
          targetBranchId = testBranch.id;
          targetBranchName = testBranch.data().name || '';
        } else if (branchesSnapshot.docs.length > 0) {
          // 첫 번째 지점 사용
          targetBranchId = branchesSnapshot.docs[0].id;
          targetBranchName = branchesSnapshot.docs[0].data().name || '';
        }
      }
      
      setBranchName(targetBranchName);
      setTargetBranchId(targetBranchId);
      
      // 모든 스케줄 조회 후 클라이언트에서 필터링
      const schedulesQuery = collection(db, 'schedules');
      const schedulesSnapshot = await getDocs(schedulesQuery);
      
      const employeeMap = new Map<string, EmployeeScheduleInfo>();
      const scheduledEmployeeIds = new Set<string>();
      
      // 직원 정보 조회 (퇴사일 확인용)
      const employeesSnapshot = await getDocs(collection(db, 'employees'));
      const employeeResignationMap = new Map<string, Date | null>();
      employeesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const resignationDate = data.resignationDate?.toDate 
          ? data.resignationDate.toDate() 
          : (data.resignationDate ? new Date(data.resignationDate) : null);
        employeeResignationMap.set(doc.id, resignationDate);
      });
      
      // 오늘 날짜 + 지점 필터링
      schedulesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const scheduleDate = toLocalDate(data.date);
        const scheduleDateStr = toLocalDateString(scheduleDate);
        
        // 오늘 날짜 필터링
        if (scheduleDateStr !== todayStr) return;
        
        // 지점 필터링
        if (targetBranchId && data.branchId !== targetBranchId) return;
        
        const employeeId = data.employeeId;
        
        // 퇴사한 직원 제외 (퇴사일이 오늘 이전이면 제외)
        const resignationDate = employeeResignationMap.get(employeeId);
        if (resignationDate) {
          const resignationDateStr = formatDate(resignationDate);
          if (resignationDateStr <= todayStr) {
            return; // 퇴사한 직원 제외
          }
        }
        
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
      
      // 스케줄 없는 직원 조회 (해당 지점에 소속되어 있지만 오늘 스케줄이 없는 직원)
      const allEmployeesSnapshot = await getDocs(collection(db, 'employees'));
      const withoutSchedule: EmployeeScheduleInfo[] = [];
      
      // employeeBranches 컬렉션에서 해당 지점에 소속된 직원 확인
      let branchEmployeeIds = new Set<string>();
      
      if (targetBranchId) {
        try {
          const employeeBranchesSnapshot = await getDocs(collection(db, 'employeeBranches'));
          employeeBranchesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            // 해당 지점에 소속되어 있고 활성화된 직원만
            if (data.branchId === targetBranchId && data.isActive === true) {
              branchEmployeeIds.add(data.employeeId);
            }
          });
        } catch (e) {
          console.log('employeeBranches 조회 실패, branchNames 필드 사용');
        }
        
        // employeeBranches에서 찾지 못한 경우 branchNames로 대체
        if (branchEmployeeIds.size === 0) {
          try {
            const branchesSnapshotForFilter = await getDocs(collection(db, 'branches'));
            const targetBranch = branchesSnapshotForFilter.docs.find((b: any) => b.id === targetBranchId);
            
            if (targetBranch) {
              const targetBranchName = targetBranch.data().name;
              allEmployeesSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const branchNames = data.branchNames;
                if (Array.isArray(branchNames) && branchNames.includes(targetBranchName)) {
                  branchEmployeeIds.add(doc.id);
                }
              });
            }
          } catch (e) {
            console.log('branchNames로 지점 직원 찾기 실패');
          }
        }
      } else {
        // 지점 ID가 없으면 모든 직원을 지점 직원으로 간주
        allEmployeesSnapshot.docs.forEach(doc => {
          branchEmployeeIds.add(doc.id);
        });
      }
      
      // 해당 지점에 소속되어 있지만 오늘 스케줄이 없는 직원만 추가
      allEmployeesSnapshot.docs.forEach(doc => {
        const employeeId = doc.id;
        const data = doc.data();
        
        // 이미 스케줄이 있는 직원은 제외
        if (scheduledEmployeeIds.has(employeeId)) return;
        
        // 퇴사한 직원 제외 (퇴사일이 오늘 이전이면 제외)
        const resignationDate = data.resignationDate?.toDate 
          ? data.resignationDate.toDate() 
          : (data.resignationDate ? new Date(data.resignationDate) : null);
        if (resignationDate) {
          const resignationDateStr = formatDate(resignationDate);
          if (resignationDateStr <= todayStr) {
            return; // 퇴사한 직원 제외
          }
        }
        
        // 해당 지점에 소속되어 있는지 확인
        if (targetBranchId && !branchEmployeeIds.has(employeeId)) return;
        
        withoutSchedule.push({
          employeeId,
          employeeName: data.name || '',
          hasSchedule: false
        });
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
        branchId: targetBranchId || branchId || 'unknown',
        branchName: branchName || '',
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
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-800">출근 기록</h1>
            {branchName && (
              <div className="text-2xl font-semibold text-blue-600 mt-2">
                {branchName}
              </div>
            )}
          </div>
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

  // 사유 입력 화면 (수동 시간 입력 후 또는 지각/일찍 출근 후)
  if (showReasonInput && !showManualTimeInput) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full">
          {/* 스케줄 정보 표시 (있는 경우) */}
          {employee.scheduledStartTime && employee.scheduledEndTime && (
            <div className="mb-6 text-center">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                금일 {employee.employeeName} 님
              </h3>
              <p className="text-xl text-gray-600">
                {employee.scheduledStartTime} - {employee.scheduledEndTime} 근무스케줄
              </p>
              <p className="text-lg text-gray-500 mt-1">
                휴게시간: {breakTimeDisplay}
              </p>
            </div>
          )}
          
          <ReasonInputForm
            selectedReason={selectedReason}
            setSelectedReason={setSelectedReason}
            reasonOther={reasonOther}
            setReasonOther={setReasonOther}
            note={note}
            setNote={setNote}
            onConfirm={onConfirm}
            onBack={() => setShowReasonInput(false)}
          />
        </div>
      </div>
    );
  }

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
    // 현재 시간을 기본값으로 설정 (아직 입력 안했으면)
    const currentTime = new Date();
    const defaultHour = currentTime.getHours();
    const defaultMinute = currentTime.getMinutes();
    
    // manualCheckInTime 파싱
    let displayHour = defaultHour;
    let displayMinute = defaultMinute;
    
    if (manualCheckInTime) {
      const [h, m] = manualCheckInTime.split(':').map(Number);
      displayHour = h;
      displayMinute = m;
    }
    
    const handleTimeChange = (type: 'hour' | 'minute', delta: number) => {
      let newHour = displayHour;
      let newMinute = displayMinute;
      
      if (type === 'hour') {
        newHour = (newHour + delta + 24) % 24;
      } else {
        newMinute = (newMinute + delta + 60) % 60;
      }
      
      const timeString = `${String(newHour).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`;
      setManualCheckInTime(timeString);
    };
    
    const handleSetCurrentTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      setManualCheckInTime(timeString);
    };
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-3xl w-full">
          <h2 className="text-4xl font-bold text-gray-800 mb-10 text-center">
            실제 출근 시각을 입력해주세요
          </h2>
          
          {/* 시간 입력 영역 */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-8 mb-6">
              {/* 시 */}
              <div className="flex flex-col items-center">
                <div className="text-2xl font-semibold text-gray-600 mb-4">시</div>
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={() => handleTimeChange('hour', 1)}
                    className="w-20 h-20 bg-blue-100 hover:bg-blue-200 active:bg-blue-300 text-blue-600 rounded-2xl shadow-lg text-4xl font-bold transition-all duration-200 active:scale-95"
                  >
                    ▲
                  </button>
                  <div className="w-32 h-32 bg-blue-50 border-4 border-blue-300 rounded-3xl flex items-center justify-center">
                    <span className="text-6xl font-bold text-gray-800">
                      {String(displayHour).padStart(2, '0')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleTimeChange('hour', -1)}
                    className="w-20 h-20 bg-blue-100 hover:bg-blue-200 active:bg-blue-300 text-blue-600 rounded-2xl shadow-lg text-4xl font-bold transition-all duration-200 active:scale-95"
                  >
                    ▼
                  </button>
                </div>
              </div>
              
              {/* 구분선 */}
              <div className="text-6xl font-bold text-gray-400 mt-12">:</div>
              
              {/* 분 */}
              <div className="flex flex-col items-center">
                <div className="text-2xl font-semibold text-gray-600 mb-4">분</div>
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={() => handleTimeChange('minute', 5)}
                    className="w-20 h-20 bg-green-100 hover:bg-green-200 active:bg-green-300 text-green-600 rounded-2xl shadow-lg text-4xl font-bold transition-all duration-200 active:scale-95"
                  >
                    ▲
                  </button>
                  <div className="w-32 h-32 bg-green-50 border-4 border-green-300 rounded-3xl flex items-center justify-center">
                    <span className="text-6xl font-bold text-gray-800">
                      {String(displayMinute).padStart(2, '0')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleTimeChange('minute', -5)}
                    className="w-20 h-20 bg-green-100 hover:bg-green-200 active:bg-green-300 text-green-600 rounded-2xl shadow-lg text-4xl font-bold transition-all duration-200 active:scale-95"
                  >
                    ▼
                  </button>
                </div>
              </div>
            </div>
            
            {/* 현재 시간으로 설정 버튼 */}
            <div className="text-center">
              <button
                onClick={handleSetCurrentTime}
                className="px-8 py-4 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-700 rounded-2xl text-xl font-semibold shadow-lg transition-all duration-200 active:scale-95"
              >
                🕐 현재 시간으로 설정
              </button>
            </div>
            
            {/* 선택된 시간 미리보기 */}
            <div className="mt-6 text-center">
              <div className="text-xl text-gray-600 mb-2">선택된 시간</div>
              <div className="text-5xl font-bold text-blue-600">
                {String(displayHour).padStart(2, '0')}:{String(displayMinute).padStart(2, '0')}
              </div>
            </div>
          </div>
          
          {/* 버튼 영역 */}
          <div className="flex space-x-4">
            <button
              onClick={() => {
                setShowManualTimeInput(false);
                setManualCheckInTime('');
              }}
              className="flex-1 h-20 bg-gray-300 hover:bg-gray-400 active:bg-gray-500 text-gray-800 text-2xl font-bold rounded-2xl shadow-lg transition-all duration-200 active:scale-95"
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
              className="flex-1 h-20 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-2xl font-bold rounded-2xl shadow-lg transition-all duration-200 active:scale-95"
            >
              다음 (전달사항 입력)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 지각 (사유 입력 화면이 아닐 때만)
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

  // 일찍 출근 (사유 입력 화면이 아닐 때만)
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


export default function CheckInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-3xl font-bold text-gray-700">로딩 중...</div>
      </div>
    }>
      <CheckInPageContent />
    </Suspense>
  );
}

