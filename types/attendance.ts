// 출퇴근 기록 관련 타입 정의

export interface AttendanceRecord {
  id?: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  date: Date; // 날짜 (YYYY-MM-DD 형식으로 저장)
  type: 'checkin' | 'checkout';
  
  // 스케줄 정보
  scheduledStartTime?: string; // "09:00" 형식
  scheduledEndTime?: string; // "13:00" 형식
  scheduledBreakTime?: number; // 분 단위
  
  // 실제 기록 시간
  actualTime: Date; // 실제 출근/퇴근 시간
  actualTimeManual?: Date; // 수동 입력한 시간 (있는 경우)
  
  // 상태 및 차이
  status: 'on_time' | 'late' | 'early';
  lateMinutes?: number; // 지각한 분수
  earlyMinutes?: number; // 일찍 온/간 분수
  
  // 사유 및 메모
  reason?: string; // 선택한 사유
  reasonOther?: string; // 기타 사유 (직접 입력)
  note?: string; // 전달사항
  
  createdAt: Date;
  updatedAt?: Date;
}

export interface EmployeeScheduleInfo {
  employeeId: string;
  employeeName: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  scheduledBreakTime?: number;
  hasSchedule: boolean;
}

export interface AttendanceCheckResult {
  status: 'on_time' | 'late' | 'early';
  minutesDiff: number; // 정시 대비 차이 (분)
  message: string;
}

