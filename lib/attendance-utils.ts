// 출퇴근 관련 유틸리티 함수

import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { AttendanceCheckResult, EmployeeScheduleInfo } from '@/types/attendance';

/**
 * ±5분 허용 범위 내인지 확인
 */
export function isWithinTolerance(scheduledTime: Date, actualTime: Date, toleranceMinutes: number = 5): boolean {
  const diff = Math.abs(actualTime.getTime() - scheduledTime.getTime()) / (1000 * 60); // 분 단위
  return diff <= toleranceMinutes;
}

/**
 * 출근/퇴근 상태 확인 (정시/지각/일찍)
 */
export function checkAttendanceStatus(
  scheduledTime: Date | null,
  actualTime: Date,
  toleranceMinutes: number = 5
): AttendanceCheckResult {
  if (!scheduledTime) {
    return {
      status: 'on_time',
      minutesDiff: 0,
      message: '스케줄 정보가 없습니다.'
    };
  }

  const diffMinutes = (actualTime.getTime() - scheduledTime.getTime()) / (1000 * 60);

  // ±5분 이내면 정시
  if (Math.abs(diffMinutes) <= toleranceMinutes) {
    return {
      status: 'on_time',
      minutesDiff: 0,
      message: '정시 출근/퇴근입니다.'
    };
  }

  // 지각
  if (diffMinutes > toleranceMinutes) {
    return {
      status: 'late',
      minutesDiff: Math.round(diffMinutes),
      message: `${Math.round(diffMinutes)}분 지각하셨습니다.`
    };
  }

  // 일찍
  return {
    status: 'early',
    minutesDiff: Math.round(Math.abs(diffMinutes)),
    message: `${Math.round(Math.abs(diffMinutes))}분 일찍 오셨습니다.`
  };
}

/**
 * 시간 문자열을 Date 객체로 변환 (오늘 날짜 기준)
 */
export function parseTimeString(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
}

/**
 * 날짜를 YYYY-MM-DD 형식 문자열로 변환
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 오늘 날짜의 스케줄 있는 직원 목록 조회
 */
export async function getEmployeesWithScheduleToday(branchId: string): Promise<EmployeeScheduleInfo[]> {
  const today = new Date();
  const todayStr = formatDate(today);
  
  // 스케줄 조회
  const schedulesQuery = query(
    collection(db, 'schedules'),
    where('branchId', '==', branchId),
    where('date', '>=', new Date(today.getFullYear(), today.getMonth(), today.getDate())),
    where('date', '<', new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))
  );
  
  const schedulesSnapshot = await getDocs(schedulesQuery);
  
  const employeeMap = new Map<string, EmployeeScheduleInfo>();
  
  schedulesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const employeeId = data.employeeId;
    
    if (!employeeMap.has(employeeId)) {
      employeeMap.set(employeeId, {
        employeeId,
        employeeName: data.employeeName || '',
        scheduledStartTime: data.startTime || '',
        scheduledEndTime: data.endTime || '',
        scheduledBreakTime: data.breakTime ? parseFloat(data.breakTime) : 0,
        hasSchedule: true
      });
    }
  });
  
  return Array.from(employeeMap.values());
}

/**
 * 해당 지점의 모든 직원 목록 조회 (스케줄 없음)
 */
export async function getEmployeesWithoutScheduleToday(branchId: string): Promise<EmployeeScheduleInfo[]> {
  const today = new Date();
  const todayStr = formatDate(today);
  
  // 오늘 스케줄 있는 직원 ID 목록
  const employeesWithSchedule = await getEmployeesWithScheduleToday(branchId);
  const scheduledEmployeeIds = new Set(employeesWithSchedule.map(e => e.employeeId));
  
  // 지점별 직원 조회
  const employeeBranchesQuery = query(
    collection(db, 'employeeBranches'),
    where('branchId', '==', branchId),
    where('isActive', '==', true)
  );
  
  const employeeBranchesSnapshot = await getDocs(employeeBranchesQuery);
  
  // 직원 정보 조회
  const employeeIds = employeeBranchesSnapshot.docs
    .map(doc => doc.data().employeeId)
    .filter(id => !scheduledEmployeeIds.has(id));
  
  if (employeeIds.length === 0) {
    return [];
  }
  
  const employeesQuery = query(
    collection(db, 'employees'),
    where('__name__', 'in', employeeIds.slice(0, 30)) // Firestore 'in' 쿼리는 최대 30개
  );
  
  const employeesSnapshot = await getDocs(employeesQuery);
  
  return employeesSnapshot.docs.map(doc => ({
    employeeId: doc.id,
    employeeName: doc.data().name || '',
    hasSchedule: false
  }));
}

