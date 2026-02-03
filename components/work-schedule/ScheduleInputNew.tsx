'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isRedDay } from '@/lib/work-schedule/holidays';
import { toLocalDate, toLocalDateString } from '@/utils/work-schedule/dateUtils';
// import { format } from 'date-fns';

interface Schedule {
  id: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  date: Date;
  startTime: string;
  endTime: string;
  breakTime: string;
  totalHours: number;
  timeSlots?: Array<{startTime: string; endTime: string; breakTime: number}>;
  originalInput?: string; // 원본 입력 형식 저장 (예: "10-13, 19-23(0.5)")
  createdAt: Date;
  updatedAt: Date;
}

interface WeeklyNote {
  id: string;
  branchId: string;
  branchName: string;
  weekStart: Date;
  weekEnd: Date;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Employee {
  id: string;
  name: string;
  status?: 'active' | 'inactive';
  type?: string; // 고용형태
  hireDate?: Date;
  resignationDate?: Date;
  branchNames?: string[]; // 소속 지점명들
  weeklyWorkHours?: number; // 주간 근무시간
  hideFromSchedule?: boolean; // 스케줄 미노출 여부
}

interface EmployeeBranch {
  id: string;
  employeeId: string;
  branchId: string;
  branchName: string;
  isActive: boolean;
}

interface Branch {
  id: string;
  name: string;
  closureDate?: Date;
}

interface PayrollLock {
  id: string;
  year: number;
  month: number;
  branchId: string;
  branchName: string;
  isLocked: boolean;
  lockedAt: Date;
  lockedBy: string;
}

interface ScheduleInputNewProps {
  selectedBranchId?: string;
  onWeekChange?: (weekStart: Date) => void;
}


export default function ScheduleInputNew({ selectedBranchId, onWeekChange }: ScheduleInputNewProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [weeklyNote, setWeeklyNote] = useState<string>('');
  const [currentWeeklyNote, setCurrentWeeklyNote] = useState<WeeklyNote | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    // 현재 날짜가 속한 주의 월요일을 기준으로 설정
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 일요일이면 -6, 아니면 1-dayOfWeek
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    return monday;
  });
  const [loading, setLoading] = useState(true);
  
  // 새로운 입력 형식 상태
  const [scheduleInputs, setScheduleInputs] = useState<{[key: string]: string}>({});
  const [editingCell, setEditingCell] = useState<{employeeId: string, date: string} | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{employeeId: string, date: Date} | null>(null);
  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showInputGuide, setShowInputGuide] = useState(false);
  const [otherBranchSchedules, setOtherBranchSchedules] = useState<{[key: string]: {branchName: string, schedule: string}[]}>({});
  
  // 드래그 상태
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    sourceCell: {employeeId: string, date: Date} | null;
    targetCell: {employeeId: string, date: Date} | null;
    isCopyMode: boolean;
  }>({
    isDragging: false,
    sourceCell: null,
    targetCell: null,
    isCopyMode: false
  });


  // 지점명을 약칭으로 변환하는 함수
  const getBranchShortName = (branchName: string): string => {
    const shortNames: {[key: string]: string} = {
      '청담장어마켓 송파점': '장어송파',
      '청담장어마켓 동탄점': '장어동탄',
      '청담장어마켓 분당점': '장어분당',
      '카페드로잉 석촌호수점': '카페송파',
      '카페드로잉 분당점': '카페분당',
      '카페드로잉 동탄점': '카페동탄'
    };
    return shortNames[branchName] || branchName;
  };

  // 권장 휴게시간 계산 함수
  const calculateRecommendedBreak = (input: string): number | null => {
    // 입력 형식 파싱 (예: "10-22", "10-22(1)", "10-13,19-23" 등)
    const timePattern = /(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/g;
    let totalWorkHours = 0;
    let match;
    
    while ((match = timePattern.exec(input)) !== null) {
      const startTime = parseFloat(match[1]);
      const endTime = parseFloat(match[2]);
      const workHours = endTime - startTime;
      totalWorkHours += workHours;
    }
    
    // 4시간 이상 근로 시 권장 휴게시간 계산
    if (totalWorkHours >= 8) return 1; // 8시간 이상 → 1시간
    if (totalWorkHours >= 4) return 0.5; // 4시간 이상 → 30분
    return null; // 4시간 미만 → 표시하지 않음
  };

  // 권장 휴게시간 클릭 핸들러
  const handleRecommendedBreakClick = (inputKey: string, recommendedBreak: number) => {
    const currentInput = scheduleInputs[inputKey] || '';
    
    // 이미 휴게시간이 있는지 확인
    if (currentInput.includes('(')) {
      // 기존 휴게시간을 권장 휴게시간으로 교체
      const newInput = currentInput.replace(/\(\d+(?:\.\d+)?\)/, `(${recommendedBreak})`);
      setScheduleInputs(prev => ({
        ...prev,
        [inputKey]: newInput
      }));
    } else {
      // 휴게시간이 없으면 추가
      setScheduleInputs(prev => ({
        ...prev,
        [inputKey]: `${currentInput}(${recommendedBreak})`
      }));
    }
  };

  // 1주 기간의 날짜들 생성
  const getWeekDates = useCallback(() => {
    const dates = [];
    // currentWeekStart는 이미 월요일이므로 그대로 사용
    const mondayDate = new Date(currentWeekStart);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(mondayDate);
      date.setDate(mondayDate.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  }, [currentWeekStart]);

  // 다른 지점 스케줄 조회 함수
  const loadOtherBranchSchedules = useCallback(async () => {
    try {
      if (!selectedBranchId) return;
      
      const weekDates = getWeekDates();
      
      // 모든 스케줄 조회
      const schedulesSnapshot = await getDocs(collection(db, 'schedules'));
      const allSchedules = schedulesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: toLocalDate(doc.data().createdAt),
        updatedAt: toLocalDate(doc.data().updatedAt),
        date: toLocalDate(doc.data().date)
      })) as Schedule[];
      
      // 현재 주간의 다른 지점 스케줄 필터링 (날짜별로 그룹화)
      const otherBranchSchedulesMap: {[key: string]: {branchName: string, schedule: string}[]} = {};
      
      allSchedules.forEach(schedule => {
        // 현재 지점이 아니고, 현재 주간에 해당하는 스케줄
        const scheduleDate = toLocalDateString(schedule.date);
        const weekStartStr = toLocalDateString(weekDates[0]);
        const weekEndStr = toLocalDateString(weekDates[6]);
        
        // 🔥 끄엉 월요일 디버깅
        if (schedule.employeeName === '끄엉' && scheduleDate === weekStartStr) {
          console.log('🔥 끄엉 월요일 스케줄 발견:', {
            id: schedule.id,
            branchName: schedule.branchName,
            branchId: schedule.branchId,
            date: scheduleDate,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            breakTime: schedule.breakTime,
            originalInput: schedule.originalInput,
            createdAt: schedule.createdAt.toISOString()
          });
        }
        
        if (schedule.branchId !== selectedBranchId && 
            scheduleDate >= weekStartStr && 
            scheduleDate <= weekEndStr) {
          
          const dateString = toLocalDateString(schedule.date);
          const key = `${schedule.employeeId}-${dateString}`;
          
          // 🔥 현재 지점에 해당 직원이 있는지 확인
          const currentBranchEmployee = employees.find(emp => emp.id === schedule.employeeId);
          if (!currentBranchEmployee) {
            return; // 현재 지점에 없는 직원은 타지점 스케줄에 표시하지 않음
          }
          
          if (!otherBranchSchedulesMap[key]) {
            otherBranchSchedulesMap[key] = [];
          }
          
          // 스케줄 포맷팅 (시간 형식을 간단하게)
          const formatTime = (timeStr: string) => {
            const [hours, minutes] = timeStr.split(':');
            if (minutes === '00') {
              return hours;
            } else if (minutes === '30') {
              return `${hours}.5`;
            } else {
              return timeStr;
            }
          };
          
          const scheduleText = schedule.originalInput || 
            `${formatTime(schedule.startTime)}-${formatTime(schedule.endTime)}${schedule.breakTime !== '0' ? `(${schedule.breakTime})` : ''}`;
          
          
          // 🔥 끄엉 월요일 타지점 스케줄 디버깅
          if (schedule.employeeName === '끄엉' && scheduleDate === weekStartStr) {
            console.log('🔥 끄엉 월요일 타지점 스케줄 처리:', {
              key,
              branchName: getBranchShortName(schedule.branchName),
              scheduleText,
              existingSchedules: otherBranchSchedulesMap[key] || []
            });
          }
          
          // 🔥 같은 지점의 스케줄이 이미 있는지 확인
          const existingBranchSchedule = otherBranchSchedulesMap[key].find(item => 
            item.branchName === getBranchShortName(schedule.branchName)
          );
          
          if (existingBranchSchedule) {
            // 같은 지점에 이미 스케줄이 있으면 중복 체크 후 합치기
            const existingSchedules = existingBranchSchedule.schedule.split(', ').map(s => s.trim());
            if (!existingSchedules.includes(scheduleText.trim())) {
              existingBranchSchedule.schedule = `${existingBranchSchedule.schedule}, ${scheduleText}`;
              console.log('🔥 스케줄 추가됨:', existingBranchSchedule.schedule);
            } else {
              console.log('🔥 중복 스케줄 무시됨:', scheduleText);
            }
          } else {
            // 새로운 지점 스케줄 추가
            otherBranchSchedulesMap[key].push({
              branchName: getBranchShortName(schedule.branchName),
              schedule: scheduleText
            });
            console.log('🔥 새 지점 스케줄 추가됨:', {
              branchName: getBranchShortName(schedule.branchName),
              schedule: scheduleText
            });
          }
        }
      });
      
      setOtherBranchSchedules(otherBranchSchedulesMap);
    } catch (error) {
      console.error('다른 지점 스케줄 조회 중 오류:', error);
    }
  }, [selectedBranchId, getWeekDates]);

  const [allBranches, setAllBranches] = useState<Branch[]>([]);

  const loadBranches = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'branches'));
      const branchesData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          closureDate: data.closureDate?.toDate ? data.closureDate.toDate() : undefined
        };
      }) as Branch[];
      setAllBranches(branchesData);
    } catch (error) {
      console.error('지점 목록을 불러올 수 없습니다:', error);
    }
  }, []);

  // currentWeekStart가 변경될 때마다 폐업일 이후 지점 필터링
  useEffect(() => {
    if (!currentWeekStart || allBranches.length === 0) {
      setBranches(allBranches);
      return;
    }

    // 현재 주의 마지막 날(일요일) 계산
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6); // 일요일
    weekEnd.setHours(23, 59, 59, 999);

    // 폐업일 이후인 지점 필터링
    const filteredBranches = allBranches.filter(branch => {
      if (!branch.closureDate) return true; // 폐업일이 없으면 포함
      return weekEnd <= branch.closureDate; // 현재 주의 마지막 날이 폐업일 이전이면 포함
    });

    setBranches(filteredBranches);
  }, [currentWeekStart, allBranches]);

  const loadSchedules = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'schedules'));
      const schedulesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: toLocalDate(doc.data().createdAt),
        updatedAt: toLocalDate(doc.data().updatedAt),
        date: toLocalDate(doc.data().date)
      })) as Schedule[];
      
      // 🔥 디버깅: 박일심의 중복 스케줄 확인
      const parkSchedules = schedulesData.filter(schedule => 
        schedule.employeeName === '박일심'
      );
      
      if (parkSchedules.length > 0) {
        console.log('🔥 박일심 전체 스케줄:', parkSchedules.map(s => ({
          id: s.id,
          branchName: s.branchName,
          branchId: s.branchId,
          date: toLocalDateString(s.date),
          startTime: s.startTime,
          endTime: s.endTime,
          originalInput: s.originalInput,
          createdAt: s.createdAt.toISOString()
        })));
        
        // 같은 날짜에 중복 스케줄 찾기
        const dateGroups = parkSchedules.reduce((acc, schedule) => {
          const dateKey = toLocalDateString(schedule.date);
          if (!acc[dateKey]) acc[dateKey] = [];
          acc[dateKey].push(schedule);
          return acc;
        }, {} as {[key: string]: typeof parkSchedules});
        
        Object.entries(dateGroups).forEach(([date, schedules]) => {
          if (schedules.length > 1) {
            console.log(`🔥 박일심 ${date} 중복 스케줄:`, schedules.map(s => ({
              id: s.id,
              branchName: s.branchName,
              startTime: s.startTime,
              endTime: s.endTime,
              createdAt: s.createdAt.toISOString()
            })));
          }
        });

        // 10/31 특별 확인
        const oct31Schedules = parkSchedules.filter(schedule => {
          const dateStr = toLocalDateString(schedule.date);
          return dateStr === '2025-10-31';
        });

        console.log(`🔥 박일심 10/31 스케줄 (${oct31Schedules.length}개):`, oct31Schedules.map(s => ({
          id: s.id,
          branchName: s.branchName,
          branchId: s.branchId,
          startTime: s.startTime,
          endTime: s.endTime,
          breakTime: s.breakTime,
          originalInput: s.originalInput,
          createdAt: s.createdAt.toISOString()
        })));

      }
      
      setSchedules(schedulesData);
    } catch (error) {
      console.error('스케줄 목록을 불러올 수 없습니다:', error);
    }
  }, []);

  const loadPayrollLocks = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'payrollLocks'));
      querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lockedAt: toLocalDate(doc.data().lockedAt)
      })) as PayrollLock[];
      // setPayrollLocks(locksData); // 사용하지 않음
    } catch (error) {
      console.error('급여 잠금 상태를 불러올 수 없습니다:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadBranches(),
        loadSchedules(),
        loadPayrollLocks()
      ]);
    } catch (error) {
      console.error('데이터 로드 중 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [loadBranches, loadSchedules, loadPayrollLocks]);

  const checkPayrollLock = useCallback(async () => {
    if (!selectedBranchId || !currentWeekStart) return;
    
    try {
      const weekDates = getWeekDates();
      
      const lockQuery = query(
        collection(db, 'payrollLocks'),
        where('branchId', '==', selectedBranchId),
        where('month', '==', new Date(currentWeekStart).toISOString().slice(0, 7))
      );
      
      const lockSnapshot = await getDocs(lockQuery);
      const isLocked = lockSnapshot.docs.length > 0;
      
      setIsLocked(isLocked);
    } catch (error) {
      console.error('급여 잠금 상태 확인 중 오류:', error);
    }
  }, [selectedBranchId, currentWeekStart, getWeekDates]);

  const loadWeeklyNote = useCallback(async () => {
    if (!selectedBranchId) return;
    
    try {
      const weekDates = getWeekDates();
      
      // 🔥 모든 주간비고를 가져온 후 정확히 일치하는 것만 찾기
      const querySnapshot = await getDocs(collection(db, 'weeklyNotes'));
      const existingNote = querySnapshot.docs.find(docSnapshot => {
        const data = docSnapshot.data();
        const noteWeekStart = toLocalDate(data.weekStart);
        const noteWeekEnd = toLocalDate(data.weekEnd);
        
        return data.branchId === selectedBranchId &&
               noteWeekStart.toDateString() === weekDates[0].toDateString() &&
               noteWeekEnd.toDateString() === weekDates[6].toDateString();
      });
      
      if (existingNote) {
        const noteData = existingNote.data();
        setWeeklyNote(noteData.note || '');
        setCurrentWeeklyNote({
          id: existingNote.id,
          branchId: selectedBranchId,
          branchName: noteData.branchName || '',
          weekStart: toLocalDate(noteData.weekStart),
          weekEnd: toLocalDate(noteData.weekEnd),
          note: noteData.note || '',
          createdAt: toLocalDate(noteData.createdAt),
          updatedAt: toLocalDate(noteData.updatedAt)
        });
      } else {
        setWeeklyNote('');
        setCurrentWeeklyNote(null);
      }
    } catch (error) {
      console.error('주간 비고 로드 중 오류:', error);
    }
  }, [selectedBranchId, getWeekDates]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (currentWeekStart) {
      loadSchedules();
      checkPayrollLock();
      loadWeeklyNote();
      loadOtherBranchSchedules();
    }
  }, [currentWeekStart, selectedBranchId, loadOtherBranchSchedules, checkPayrollLock, loadWeeklyNote, loadSchedules]);


  // 전역 마우스 이벤트 리스너 추가
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragState.isDragging) {
        setDragState({
          isDragging: false,
          sourceCell: null,
          targetCell: null,
          isCopyMode: false
        });
      }
    };

    const handleGlobalMouseMove = () => {
      if (dragState.isDragging) {
        // 드래그 중일 때 커서 변경
        document.body.style.cursor = dragState.isCopyMode ? 'copy' : 'move';
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mousemove', handleGlobalMouseMove);
    
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.body.style.cursor = 'default';
    };
  }, [dragState.isDragging, dragState.isCopyMode]);

  // 컴포넌트 언마운트 시 타임아웃 정리
  useEffect(() => {
    return () => {
      if (clickTimeout) {
        clearTimeout(clickTimeout);
      }
    };
  }, [clickTimeout]);

  // 시간 보정 함수
  const checkAndFixTotalHours = async () => {
    try {
      console.log('=== 시간 보정 시작 ===');
      
      // 현재 로드된 스케줄에서 문제 있는 데이터 확인
      const problems = schedules.filter(s => {
        // timeSlots가 있으면 여러 시간대로 계산, 없으면 단일 시간대로 계산
        const correctHours = s.timeSlots && s.timeSlots.length > 0
          ? calculateTotalHours(s.startTime, s.endTime, s.breakTime, s.timeSlots)
          : calculateTotalHours(s.startTime, s.endTime, s.breakTime);
        
        return Math.abs(s.totalHours - correctHours) > 0.01;
      });
      
      console.log('보정 필요한 스케줄:', problems.map(s => {
        const correctHours = s.timeSlots && s.timeSlots.length > 0
          ? calculateTotalHours(s.startTime, s.endTime, s.breakTime, s.timeSlots)
          : calculateTotalHours(s.startTime, s.endTime, s.breakTime);
        
        const scheduleDisplay = s.timeSlots && s.timeSlots.length > 0
          ? s.timeSlots.map(slot => `${slot.startTime}-${slot.endTime}${slot.breakTime > 0 ? `(${slot.breakTime})` : ''}`).join(', ')
          : `${s.startTime}-${s.endTime}(${s.breakTime})`;
        
        return {
          employee: s.employeeName,
          date: s.date.toDateString(),
          schedule: scheduleDisplay,
          현재값: s.totalHours,
          정확한값: parseFloat(correctHours.toFixed(1))
        };
      }));
      
      if (problems.length === 0) {
        alert('보정이 필요한 스케줄이 없습니다.');
        return;
      }
      
      const confirmMessage = `${problems.length}개의 스케줄에서 시간 계산 오류가 발견되었습니다.\n\n보정하시겠습니까?`;
      if (!confirm(confirmMessage)) {
        return;
      }
      
      // 데이터베이스 업데이트
      let updatedCount = 0;
      for (const schedule of problems) {
        // timeSlots가 있으면 여러 시간대로 계산, 없으면 단일 시간대로 계산
        const correctHours = schedule.timeSlots && schedule.timeSlots.length > 0
          ? calculateTotalHours(schedule.startTime, schedule.endTime, schedule.breakTime, schedule.timeSlots)
          : calculateTotalHours(schedule.startTime, schedule.endTime, schedule.breakTime);
        
        await updateDoc(doc(db, 'schedules', schedule.id), {
          totalHours: correctHours,
          updatedAt: new Date()
        });
        
        console.log(`보정 완료: ${schedule.employeeName} ${schedule.date.toDateString()} ${schedule.totalHours} -> ${correctHours}`);
        updatedCount++;
      }
      
      // 스케줄 다시 로드
      await loadSchedules();
      
      alert(`시간 보정이 완료되었습니다.\n${updatedCount}개 스케줄이 업데이트되었습니다.`);
      console.log('=== 시간 보정 완료 ===');
      
    } catch (error) {
      console.error('시간 보정 중 오류:', error);
      alert('시간 보정 중 오류가 발생했습니다.');
    }
  };

  // 공유 URL 복사 기능
  const handleCopyShareUrl = async () => {
    try {
      const weekDates = getWeekDates();
      const branch = branches.find(b => b.id === selectedBranchId);
      
      if (!branch) {
        alert('지점 정보를 찾을 수 없습니다.');
        return;
      }

      // 날짜 포맷팅 (10월 6일-10월 12일 형식)
      const formatDate = (date: Date) => {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${month}월 ${day}일`;
      };

      const weekStart = weekDates[0];
      const weekEnd = weekDates[6];
      const dateRange = `${formatDate(weekStart)}-${formatDate(weekEnd)}`;

      // 공유 URL 생성
      const weekString = toLocalDateString(currentWeekStart);
      const shareUrl = `${window.location.origin}/work-schedule/public/schedule/${selectedBranchId || 'all'}/${weekString}`;

      // 포맷된 텍스트 생성
      const shareText = `${branch.name}, ${dateRange} 스케쥴\n${shareUrl}`;

      // 클립보드에 URL 복사
      try {
        await navigator.clipboard.writeText(shareText);
        alert('공유 URL이 클립보드에 복사되었습니다!');
      } catch {
        // 클립보드 복사 실패 시 대체 방법
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('공유 URL이 클립보드에 복사되었습니다!');
      }
      
    } catch (error) {
      console.error('URL 복사 중 오류:', error);
      alert('URL 복사 중 오류가 발생했습니다.');
    }
  };

  // 공유 기능
  const handleShare = async () => {
    try {
      const weekDates = getWeekDates();
      const branch = branches.find(b => b.id === selectedBranchId);
      
      if (!branch) {
        alert('지점 정보를 찾을 수 없습니다.');
        return;
      }

      // 날짜 포맷팅 (10월 6일-10월 12일 형식)
      const formatDate = (date: Date) => {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${month}월 ${day}일`;
      };

      const weekStart = weekDates[0];
      const weekEnd = weekDates[6];
      const dateRange = `${formatDate(weekStart)}-${formatDate(weekEnd)}`;

      // 공유 URL 생성
      const weekString = toLocalDateString(currentWeekStart);
      const shareUrl = `${window.location.origin}/work-schedule/public/schedule/${selectedBranchId || 'all'}/${weekString}`;

      // 포맷된 텍스트 생성
      const shareText = `${branch.name}, ${dateRange} 스케쥴\n${shareUrl}`;

      // Web Share API 지원 확인
      if (navigator.share) {
        try {
          await navigator.share({
            title: `${branch.name} 주간 스케줄`,
            text: shareText,
            url: shareUrl
          });
          return; // Web Share API 성공 시 여기서 종료
        } catch (error) {
          // 사용자가 공유를 취소한 경우는 에러로 처리하지 않음
          if (error instanceof Error && error.name !== 'AbortError') {
            console.log('Web Share API 실패, 클립보드 복사로 대체');
          } else {
            return; // 사용자가 취소한 경우
          }
        }
      }

      // Web Share API를 지원하지 않거나 실패한 경우 클립보드 복사
      try {
        await navigator.clipboard.writeText(shareText);
        alert('스케줄이 클립보드에 복사되었습니다!');
      } catch {
        // 클립보드 복사 실패 시 대체 방법
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('스케줄이 클립보드에 복사되었습니다!');
      }
      
    } catch (error) {
      console.error('공유 중 오류:', error);
      alert('공유 중 오류가 발생했습니다.');
    }
  };


  const loadEmployees = useCallback(async () => {
    try {
      // 모든 직원 로드
      const employeesSnapshot = await getDocs(collection(db, 'employees'));
      
      // 직원-지점 관계 로드
      const employeeBranchesSnapshot = await getDocs(collection(db, 'employeeBranches'));
      
      // 지점 목록 로드
      const branchesSnapshot = await getDocs(collection(db, 'branches'));
      const branchesMap = new Map();
      branchesSnapshot.docs.forEach(doc => {
        branchesMap.set(doc.id, doc.data().name);
      });
      
      // 직원-지점 관계를 Map으로 변환
      const employeeBranchesMap = new Map<string, EmployeeBranch[]>();
      employeeBranchesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const employeeBranch: EmployeeBranch = {
          id: doc.id,
          employeeId: data.employeeId,
          branchId: data.branchId,
          branchName: data.branchName,
          isActive: data.isActive !== false
        };
        
        if (!employeeBranchesMap.has(employeeBranch.employeeId)) {
          employeeBranchesMap.set(employeeBranch.employeeId, []);
        }
        employeeBranchesMap.get(employeeBranch.employeeId)!.push(employeeBranch);
      });
      
      const employeesData = employeesSnapshot.docs.map(doc => {
        const data = doc.data();
        const hireDate = data.hireDate ? toLocalDate(data.hireDate) : undefined;
        const resignationDate = data.resignationDate ? toLocalDate(data.resignationDate) : undefined;
        
        // 직원의 지점명들 가져오기
        const employeeBranchList = employeeBranchesMap.get(doc.id) || [];
        let branchNames: string[] = [];
        
        if (employeeBranchList.length > 0) {
          // 새로운 EmployeeBranch 관계가 있는 경우
          branchNames = employeeBranchList
            .filter(eb => eb.isActive)
            .map(eb => eb.branchName);
        } else {
          // 기존 데이터 호환성 (branchId, branchName 사용)
          if (data.branchId) {
            const branchName = branchesMap.get(data.branchId);
            if (branchName) {
              branchNames = [branchName];
            }
          } else if (data.branchName) {
            branchNames = [data.branchName];
          }
        }
        
        return {
          id: doc.id,
          name: data.name || '',
          status: resignationDate ? 'inactive' : 'active',
          type: data.type || '',
          hireDate: hireDate,
          resignationDate: resignationDate,
          branchNames: branchNames,
          weeklyWorkHours: data.weeklyWorkHours || 40,
          hideFromSchedule: data.hideFromSchedule || false
        };
      }) as Employee[];
      
      // 현재 주간 날짜 범위 계산
      const weekDates = getWeekDates();
      const weekStart = weekDates[0]; // 월요일
      const weekEnd = weekDates[6]; // 일요일
      
      // 해당 주간에 근무 중인 직원만 필터링 (입사일/퇴사일 기준) + 스케줄미노출 직원 제외
      const workingEmployees = employeesData.filter(emp => {
        // 스케줄 미노출 직원 제외
        if (emp.hideFromSchedule) {
          console.log(`🔥 직원 제외 (스케줄 미노출): ${emp.name}`);
          return false;
        }
        
        // 입사일 체크 (입사일이 없으면 제한 없음)
        if (emp.hireDate && emp.hireDate > weekEnd) {
          console.log(`🔥 직원 제외 (입사일 이후): ${emp.name}, 입사일: ${emp.hireDate.toISOString().split('T')[0]}, 주간 종료: ${weekEnd.toISOString().split('T')[0]}`);
          return false; // 주간 종료일 이후 입사 -> 제외
        }
        
        // 퇴사일 체크 (퇴사일이 없으면 제한 없음)
        if (emp.resignationDate && emp.resignationDate < weekStart) {
          console.log(`🔥 직원 제외 (퇴사일 이전): ${emp.name}, 퇴사일: ${emp.resignationDate.toISOString().split('T')[0]}, 주간 시작: ${weekStart.toISOString().split('T')[0]}`);
          return false; // 주간 시작일 이전 퇴사 -> 제외
        }
        
        return true; // 해당 주간에 근무 중
      });
      
      console.log('🔥 해당 주간 근무 직원:', {
        전체직원: employeesData.length,
        근무중: workingEmployees.length,
        근무중직원명단: workingEmployees.map(e => ({
          name: e.name,
          branchNames: e.branchNames,
          hireDate: e.hireDate?.toISOString().split('T')[0],
          resignationDate: e.resignationDate?.toISOString().split('T')[0],
          hideFromSchedule: e.hideFromSchedule
        }))
      });
      
      // 지점별 필터링
      const filteredEmployees = selectedBranchId 
        ? workingEmployees.filter(emp => {
            const selectedBranch = branches.find(b => b.id === selectedBranchId);
            const isIncluded = selectedBranch && emp.branchNames?.includes(selectedBranch.name);
            if (!isIncluded) {
              console.log(`🔥 직원 제외 (지점 불일치): ${emp.name}, 선택된 지점: ${selectedBranch?.name}, 직원 지점: ${emp.branchNames}`);
            }
            return isIncluded;
          })
        : workingEmployees;
      
      console.log('🔥 최종 필터링된 직원:', {
        선택된지점: selectedBranchId ? branches.find(b => b.id === selectedBranchId)?.name : '전체',
        필터링후: filteredEmployees.length,
        필터링된직원명단: filteredEmployees.map(e => e.name)
      });
      
      setEmployees(filteredEmployees);
    } catch (error) {
      console.error('직원 목록을 불러올 수 없습니다:', error);
    }
  }, [selectedBranchId, branches, getWeekDates]);

  // 지점이 변경될 때 직원 목록 다시 로드
  useEffect(() => {
    if (selectedBranchId) {
      loadEmployees();
    }
  }, [selectedBranchId, loadEmployees]);

  // 주간 비고 로드

  // 주간 비고 저장
  const saveWeeklyNote = async () => {
    if (!selectedBranchId) return;
    
    try {
      const weekDates = getWeekDates();
      const weekStart = weekDates[0];
      const weekEnd = weekDates[6];
      const branch = branches.find(b => b.id === selectedBranchId);
      
      if (!branch) return;
      
      // 🔥 항상 DB에서 다시 조회하여 문서가 실제로 존재하는지 확인
      const querySnapshot = await getDocs(collection(db, 'weeklyNotes'));
      const existingNote = querySnapshot.docs.find(docSnapshot => {
        const data = docSnapshot.data();
        const noteWeekStart = toLocalDate(data.weekStart);
        const noteWeekEnd = toLocalDate(data.weekEnd);
        
        return data.branchId === selectedBranchId &&
               noteWeekStart.toDateString() === weekDates[0].toDateString() &&
               noteWeekEnd.toDateString() === weekDates[6].toDateString();
      });
      
      if (existingNote) {
        // 기존 비고 수정
        await updateDoc(doc(db, 'weeklyNotes', existingNote.id), {
          note: weeklyNote,
          updatedAt: new Date()
        });
        
        setCurrentWeeklyNote({
          id: existingNote.id,
          branchId: selectedBranchId,
          branchName: branch.name,
          weekStart: weekStart,
          weekEnd: weekEnd,
          note: weeklyNote,
          createdAt: toLocalDate(existingNote.data().createdAt),
          updatedAt: new Date()
        });
      } else {
        // 새 비고 생성
        const docRef = await addDoc(collection(db, 'weeklyNotes'), {
          branchId: selectedBranchId,
          branchName: branch.name,
          weekStart: weekStart,
          weekEnd: weekEnd,
          note: weeklyNote,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        const newNote: WeeklyNote = {
          id: docRef.id,
          branchId: selectedBranchId,
          branchName: branch.name,
          weekStart: weekStart,
          weekEnd: weekEnd,
          note: weeklyNote,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        setCurrentWeeklyNote(newNote);
      }
      
      alert('주간 비고가 저장되었습니다.');
    } catch (error) {
      console.error('주간 비고 저장 오류:', error);
      alert('주간 비고 저장 중 오류가 발생했습니다.');
    }
  };


  // 주간 네비게이션 핸들러
  const goToPreviousWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() - 7); // 1주 전
    setCurrentWeekStart(newWeekStart);
    onWeekChange?.(newWeekStart);
  };

  const goToNextWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() + 7); // 1주 후
    setCurrentWeekStart(newWeekStart);
    onWeekChange?.(newWeekStart);
  };


  // 해당 날짜의 스케줄 가져오기 (지점별 필터링 포함)
  const getScheduleForDate = (employeeId: string, date: Date) => {
    const dateString = toLocalDateString(date);
    
    return schedules.find(schedule => 
      schedule.employeeId === employeeId &&
      toLocalDateString(schedule.date) === dateString &&
      schedule.branchId === selectedBranchId // 지점별 필터링 추가
    );
  };

  // 시간을 소수점 형태로 변환하는 함수 (18:30 -> 18.5)
  const timeToDecimal = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (minutes === 0) {
      return hours.toString();
    } else {
      const decimalMinutes = minutes / 60;
      if (decimalMinutes === 0.5) {
        return `${hours}.5`;
      } else if (decimalMinutes === 0.25) {
        return `${hours}.25`;
      } else if (decimalMinutes === 0.75) {
        return `${hours}.75`;
      } else {
        return (hours + decimalMinutes).toString();
      }
    }
  };

  // 스케줄을 표시용 문자열로 변환하는 함수
  const formatScheduleForDisplay = (schedule: Schedule) => {
    // originalInput이 있으면 원본 입력 형식 사용
    if (schedule.originalInput) {
      return schedule.originalInput;
    }
    
    // timeSlots가 있으면 여러 시간대로 표시
    if (schedule.timeSlots && schedule.timeSlots.length > 0) {
      return schedule.timeSlots.map(slot => 
        `${timeToDecimal(slot.startTime)}-${timeToDecimal(slot.endTime)}${slot.breakTime > 0 ? `(${slot.breakTime})` : ''}`
      ).join(', ');
    } else {
      // 단일 시간대로 표시
      return `${timeToDecimal(schedule.startTime)}-${timeToDecimal(schedule.endTime)}(${schedule.breakTime})`;
    }
  };

  // 타지점 스케줄과 시간대 중복 확인 함수
  const checkOtherBranchTimeOverlap = (employeeId: string, date: Date, schedule: Schedule | null) => {
    if (!schedule) return false;
    
    const dateString = toLocalDateString(date);
    const otherBranches = otherBranchSchedules[`${employeeId}-${dateString}`];
    if (!otherBranches || otherBranches.length === 0) return false;
    
    // 현재 스케줄의 시간대 추출
    const getCurrentTimeSlots = () => {
      if (schedule.timeSlots && schedule.timeSlots.length > 0) {
        return schedule.timeSlots;
      } else {
        return [{
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          breakTime: parseFloat(schedule.breakTime) || 0
        }];
      }
    };
    
    const currentSlots = getCurrentTimeSlots();
    
    // 시간을 분 단위로 변환
    const timeToMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + (minutes || 0);
    };
    
    // 타지점 스케줄 문자열을 시간대 배열로 파싱
    const parseOtherBranchSchedule = (scheduleStr: string) => {
      const timeParts = scheduleStr.split(',').map(part => part.trim());
      const slots: {start: number, end: number}[] = [];
      
      for (const part of timeParts) {
        // "10-22(2)" 또는 "18.5-23" 형태 파싱
        const match = part.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(?:\([\d.]+\))?$/);
        if (match) {
          const [, startStr, endStr] = match;
          const startDecimal = parseFloat(startStr);
          const endDecimal = parseFloat(endStr);
          const startMinutes = Math.floor(startDecimal) * 60 + Math.round((startDecimal - Math.floor(startDecimal)) * 60);
          const endMinutes = Math.floor(endDecimal) * 60 + Math.round((endDecimal - Math.floor(endDecimal)) * 60);
          slots.push({ start: startMinutes, end: endMinutes });
        }
      }
      
      return slots;
    };
    
    // 타지점 스케줄들과 시간대 겹침 확인
    for (const otherBranch of otherBranches) {
      const otherSlots = parseOtherBranchSchedule(otherBranch.schedule);
      
      for (const currentSlot of currentSlots) {
        const currentStart = timeToMinutes(currentSlot.startTime);
        const currentEnd = timeToMinutes(currentSlot.endTime);
        
        for (const otherSlot of otherSlots) {
          // 시간 겹침 확인
          if (currentStart < otherSlot.end && currentEnd > otherSlot.start) {
            return true;
          }
        }
      }
    }
    
    return false;
  };

  // 시간 겹침 검증 함수
  const checkTimeOverlap = (employeeId: string, date: Date, startTime: string, endTime: string, excludeScheduleId?: string) => {
    const dateString = toLocalDateString(date);
    
    // 해당 직원의 같은 날짜 모든 스케줄 확인 (모든 지점 포함)
    const employeeSchedules = schedules.filter(schedule => 
      schedule.employeeId === employeeId &&
      toLocalDateString(schedule.date) === dateString &&
      (excludeScheduleId ? schedule.id !== excludeScheduleId : true)
    );

    // 시간을 분 단위로 변환 (정확한 비교를 위해)
    const timeToMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);

    for (const schedule of employeeSchedules) {
      const existingStart = timeToMinutes(schedule.startTime);
      const existingEnd = timeToMinutes(schedule.endTime);
      
      // 시간 겹침 확인
      if ((newStart < existingEnd && newEnd > existingStart)) {
        const branchName = branches.find(b => b.id === schedule.branchId)?.name || '알 수 없는 지점';
        return {
          hasOverlap: true,
          conflictSchedule: schedule,
          branchName,
          message: `${timeToDecimal(schedule.startTime)}-${timeToDecimal(schedule.endTime)} (${branchName})와 시간이 겹칩니다.`
        };
      }
    }

    return { hasOverlap: false };
  };

  // 시간 계산 함수 (여러 시간대 지원)
  const calculateTotalHours = (startTime: string, endTime: string, breakTime: string, timeSlots?: Array<{startTime: string; endTime: string; breakTime: number}>) => {
    if (!startTime || !endTime) return 0;
    
    // 시간을 분 단위로 변환
    const timeToMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    let totalHours = 0;
    
    if (timeSlots && timeSlots.length > 0) {
      // 여러 시간대가 있는 경우
      console.log('여러 시간대 계산:', timeSlots);
      
      for (const slot of timeSlots) {
        const slotStartMinutes = timeToMinutes(slot.startTime);
        const slotEndMinutes = timeToMinutes(slot.endTime);
        const slotBreakMinutes = (slot.breakTime || 0) * 60;
        
        const slotTotalMinutes = slotEndMinutes - slotStartMinutes - slotBreakMinutes;
        const slotHours = slotTotalMinutes / 60;
        
        console.log(`시간대 ${slot.startTime}-${slot.endTime}(${slot.breakTime}):`, {
          slotStartMinutes,
          slotEndMinutes,
          slotBreakMinutes,
          slotTotalMinutes,
          slotHours
        });
        
        totalHours += Math.max(0, slotHours);
      }
    } else {
      // 단일 시간대인 경우 (기존 로직)
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);
      const breakMinutes = (parseFloat(breakTime) || 0) * 60;
      
      const totalMinutes = endMinutes - startMinutes - breakMinutes;
      totalHours = totalMinutes / 60;
      
      console.log('단일 시간대 계산:', {
        startTime,
        endTime,
        breakTime,
        startMinutes,
        endMinutes,
        breakMinutes,
        totalMinutes,
        totalHours
      });
    }
    
    console.log('최종 총 근무시간:', totalHours);
    return Math.max(0, totalHours);
  };

  // 스케줄 입력 파싱 함수 (여러 시간대 지원)
  const parseScheduleInput = (input: string) => {
    console.log('=== 스케줄 파싱 시작 ===');
    console.log('입력값:', input);
    
    // 쉼표로 여러 시간대 분리
    const timeParts = input.split(',').map(part => part.trim());
    console.log('분리된 시간대들:', timeParts);
    
    const schedules = [];
    let totalBreakTime = 0;
    
    for (let i = 0; i < timeParts.length; i++) {
      const part = timeParts[i];
      // 입력 형식: "10-22(2)" 또는 "18.5-23" -> 시작시간: 10 또는 18.5, 종료시간: 22 또는 23, 휴식시간: 2
      const match = part.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(?:\((\d+(?:\.\d+)?)\))?$/);
      if (!match) {
        console.log(`파싱 실패: ${part} 정규식 매치 안됨`);
        return null;
      }
      
      const [, startTimeStr, endTimeStr, breakTime = '0'] = match;
      console.log(`시간대 ${i + 1} 파싱:`, { startTimeStr, endTimeStr, breakTime });
      
      schedules.push({
        startTimeStr,
        endTimeStr,
        breakTime: parseFloat(breakTime)
      });
      
      totalBreakTime += parseFloat(breakTime);
    }
    
    // 소수점 시간을 시:분 형태로 변환
    const parseTime = (timeStr: string) => {
      const time = parseFloat(timeStr);
      const hours = Math.floor(time);
      const minutes = Math.round((time - hours) * 60);
      const result = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      console.log(`시간 변환: ${timeStr} -> ${time} -> ${hours}시 ${minutes}분 -> ${result}`);
      return result;
    };
    
    // 첫 번째 시간대의 시작시간과 마지막 시간대의 종료시간을 사용
    const firstSchedule = schedules[0];
    const lastSchedule = schedules[schedules.length - 1];
    
    const result = {
      startTime: parseTime(firstSchedule.startTimeStr),
      endTime: parseTime(lastSchedule.endTimeStr),
      breakTime: totalBreakTime.toString(),
      timeSlots: schedules.map(s => ({
        startTime: parseTime(s.startTimeStr),
        endTime: parseTime(s.endTimeStr),
        breakTime: s.breakTime
      }))
    };
    
    console.log('최종 파싱 결과:', result);
    console.log('=== 스케줄 파싱 완료 ===');
    
    return result;
  };

  // 다음 셀 찾기 함수
  const getNextCell = (currentEmployeeId: string, currentDate: Date) => {
    const weekDates = getWeekDates();
    const currentEmployeeIndex = employees.findIndex(emp => emp.id === currentEmployeeId);
    const currentDateIndex = weekDates.findIndex(d => d.toDateString() === currentDate.toDateString());
    
    // 같은 직원의 다음 날짜
    if (currentDateIndex < weekDates.length - 1) {
      return {
        employeeId: currentEmployeeId,
        date: weekDates[currentDateIndex + 1]
      };
    }
    
    // 다음 직원의 첫 번째 날짜
    if (currentEmployeeIndex < employees.length - 1) {
      return {
        employeeId: employees[currentEmployeeIndex + 1].id,
        date: weekDates[0]
      };
    }
    
    // 마지막 셀이면 첫 번째 셀로
    return {
      employeeId: employees[0].id,
      date: weekDates[0]
    };
  };

  // 셀 클릭 핸들러 (더블클릭과 구분)
  const handleCellClick = (employeeId: string, date: Date) => {
    if (isLocked) {
      alert('급여 작업이 완료된 월은 수정할 수 없습니다.');
      return;
    }

    // 기존 타임아웃이 있으면 클리어
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      setClickTimeout(null);
      return; // 더블클릭으로 처리
    }

    // 더블클릭을 기다리는 타임아웃 설정
    const timeout = setTimeout(() => {
      handleCellEdit(employeeId, date);
      setClickTimeout(null);
    }, 300); // 300ms 대기

    setClickTimeout(timeout);
  };

  // 셀 편집 시작
  const handleCellEdit = (employeeId: string, date: Date) => {
    if (isLocked) {
      alert('급여 작업이 완료된 월은 수정할 수 없습니다.');
      return;
    }
    
    const dateString = toLocalDateString(date);
    setEditingCell({ employeeId, date: dateString });
    
    // 기존 스케줄이 있으면 입력 필드에 표시
    const existingSchedule = getScheduleForDate(employeeId, date);
    if (existingSchedule) {
      const inputValue = formatScheduleForDisplay(existingSchedule);
      setScheduleInputs(prev => ({
        ...prev,
        [`${employeeId}-${dateString}`]: inputValue
      }));
    }
  };

  // 스케줄 삭제 (더블클릭)
  const handleScheduleDelete = async (employeeId: string, date: Date) => {
    if (isLocked) {
      alert('급여 작업이 완료된 월은 수정할 수 없습니다.');
      return;
    }

    // 클릭 타임아웃 클리어
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      setClickTimeout(null);
    }

    const existingSchedule = getScheduleForDate(employeeId, date);
    if (!existingSchedule) {
      alert('삭제할 스케줄이 없습니다.');
      return;
    }

    try {
      await deleteDoc(doc(db, 'schedules', existingSchedule.id));
      await loadSchedules();
    } catch (error) {
      console.error('스케줄 삭제 오류:', error);
      alert('스케줄 삭제 중 오류가 발생했습니다.');
    }
  };

  // 셀 편집 완료
  const handleCellSave = async (employeeId: string, date: Date) => {
    const dateString = toLocalDateString(date);
    const inputKey = `${employeeId}-${dateString}`;
    const inputValue = scheduleInputs[inputKey] || '';
    
    if (!inputValue.trim()) {
      // 입력이 비어있으면 기존 스케줄 삭제
      const existingSchedule = getScheduleForDate(employeeId, date);
      if (existingSchedule) {
        try {
          await deleteDoc(doc(db, 'schedules', existingSchedule.id));
          await loadSchedules();
        } catch (error) {
          console.error('스케줄 삭제 오류:', error);
        }
      }
    } else {
      // 입력이 있으면 파싱하여 저장
      const parsed = parseScheduleInput(inputValue);
      if (parsed) {
        const employee = employees.find(emp => emp.id === employeeId);
        const branch = branches.find(branch => branch.id === selectedBranchId);
        
        if (employee && branch) {
          const totalHours = calculateTotalHours(parsed.startTime, parsed.endTime, parsed.breakTime, parsed.timeSlots);
          const existingSchedule = getScheduleForDate(employeeId, date);
          
          // 시간 겹침 검증
          const overlapCheck = checkTimeOverlap(
            employeeId, 
            date, 
            parsed.startTime, 
            parsed.endTime, 
            existingSchedule?.id // 기존 스케줄은 제외
          );
          
          if (overlapCheck.hasOverlap) {
            const confirmMessage = `⚠️ 시간 겹침 경고\n\n${employee.name}님의 ${overlapCheck.message}\n\n그래도 저장하시겠습니까?`;
            if (!confirm(confirmMessage)) {
              return; // 사용자가 취소한 경우
            }
          }
          
          try {
            // 🔥 Firestore에서 직접 쿼리하여 같은 직원의 같은 날짜에 있는 모든 기존 스케줄 찾기 (중복 방지)
            const dateString = toLocalDateString(date);
            const dateStart = new Date(date);
            dateStart.setHours(0, 0, 0, 0);
            const dateEnd = new Date(date);
            dateEnd.setHours(23, 59, 59, 999);
            
            // 모든 스케줄을 가져온 후 클라이언트에서 필터링 (날짜 비교 정확성)
            const allSchedulesSnapshot = await getDocs(collection(db, 'schedules'));
            const existingSchedules = allSchedulesSnapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: toLocalDate(doc.data().date)
              }))
              .filter((schedule: any) => {
                const scheduleDateStr = toLocalDateString(schedule.date);
                return schedule.employeeId === employeeId &&
                       schedule.branchId === selectedBranchId &&
                       scheduleDateStr === dateString;
              });
            
            // 배치로 기존 스케줄 삭제
            const batch = writeBatch(db);
            existingSchedules.forEach((schedule: any) => {
              batch.delete(doc(db, 'schedules', schedule.id));
            });
            
            // 새 스케줄 추가
            const newScheduleRef = doc(collection(db, 'schedules'));
            batch.set(newScheduleRef, {
              employeeId: employeeId,
              employeeName: employee.name,
              branchId: selectedBranchId,
              branchName: branch.name,
              date: date,
              startTime: parsed.startTime,
              endTime: parsed.endTime,
              breakTime: parsed.breakTime,
              totalHours: totalHours,
              timeSlots: parsed.timeSlots, // 여러 시간대 정보 저장
              originalInput: inputValue, // 원본 입력 형식 저장
              month: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`, // YYYY-MM 형식
              createdAt: new Date(),
              updatedAt: new Date()
            });
            
            // 배치 실행 (삭제와 추가를 원자적으로 처리)
            await batch.commit();
            
            console.log(`✅ 스케줄 저장 완료: ${employee.name}, ${dateString}, 기존 ${existingSchedules.length}개 삭제`);
            console.log(`✅ 저장된 스케줄 정보:`, {
              employeeName: employee.name,
              date: dateString,
              startTime: parsed.startTime,
              endTime: parsed.endTime,
              timeSlots: parsed.timeSlots,
              originalInput: inputValue
            });
            await loadSchedules();
          } catch (error) {
            console.error('스케줄 저장 오류:', error);
            alert('스케줄 저장 중 오류가 발생했습니다.');
          }
        }
      } else {
        alert('올바른 형식으로 입력해주세요. 예: 10-22(2)');
      }
    }
    
    setEditingCell(null);
    setScheduleInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[inputKey];
      return newInputs;
    });
  };

  // 셀 편집 취소
  const handleCellCancel = (employeeId: string, date: Date) => {
    const dateString = toLocalDateString(date);
    const inputKey = `${employeeId}-${dateString}`;
    
    setEditingCell(null);
    setScheduleInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[inputKey];
      return newInputs;
    });
  };

  // 키보드 이벤트 핸들러
  const handleKeyDown = (e: React.KeyboardEvent, employeeId: string, date: Date) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      
      
      // 현재 셀 저장
      handleCellSave(employeeId, date);
      
      // 다음 셀로 이동
      const nextCell = getNextCell(employeeId, date);
      setTimeout(() => {
        handleCellEdit(nextCell.employeeId, nextCell.date);
      }, 100);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      
      
      // 현재 셀 저장
      handleCellSave(employeeId, date);
    }
  };

  // 1주 집계 계산
  const calculateWeeklySummary = () => {
    console.log('=== 주간 집계 계산 시작 ===');
    const weekDates = getWeekDates();
    console.log('주간 날짜들:', weekDates.map(d => d.toDateString()));
    
    const summary = employees.map(employee => {
      console.log(`\n--- ${employee.name} 집계 계산 ---`);
      const dailyHours = weekDates.map((date, index) => {
        const schedule = getScheduleForDate(employee.id, date);
        const hours = schedule ? schedule.totalHours : 0;
        console.log(`${['월','화','수','목','금','토','일'][index]}요일 (${date.toDateString()}): ${hours}시간`, 
          schedule ? `(${schedule.startTime}-${schedule.endTime}, 휴게${schedule.breakTime})` : '(스케줄 없음)');
        return hours;
      });
      
      const totalHours = dailyHours.reduce((sum, hours) => sum + hours, 0);
      console.log(`${employee.name} 총 근무시간: ${totalHours}시간`);
      
      return {
        employeeName: employee.name,
        dailyHours,
        totalHours,
        weeklyWorkHours: employee.weeklyWorkHours,
        employmentType: employee.type || ''
      };
    }).filter(emp => emp.totalHours > 0); // 총 근무시간이 0보다 큰 직원만 필터링
    
    console.log('=== 주간 집계 계산 완료 ===');
    return summary;
  };

  // 이전 주 데이터가 있는지 확인하는 함수 (해당 지점만)
  const hasPreviousWeekData = (employeeId: string) => {
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    
    const previousWeekSchedules = schedules.filter(schedule => {
      const scheduleDateStr = toLocalDateString(schedule.date);
      const weekStartStr = toLocalDateString(previousWeekStart);
      const weekEndDate = new Date(previousWeekStart);
      weekEndDate.setDate(weekEndDate.getDate() + 6);
      const weekEndStr = toLocalDateString(weekEndDate);
      
      return schedule.employeeId === employeeId && 
             schedule.branchId === selectedBranchId && // 해당 지점만 확인
             scheduleDateStr >= weekStartStr && 
             scheduleDateStr <= weekEndStr;
    });
    
    return previousWeekSchedules.length > 0;
  };

  // 이전 주 데이터 복사 핸들러
  const handleCopyPreviousWeek = async (employeeId: string) => {
    if (isLocked) {
      alert('급여 작업이 완료되어 수정할 수 없습니다.');
      return;
    }

    const confirmMessage = `이전 주 데이터를 복사하시겠습니까?\n\n주의: 현재 입력된 데이터는 삭제됩니다.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      // 이전 주 날짜 계산
      const previousWeekStart = new Date(currentWeekStart);
      previousWeekStart.setDate(previousWeekStart.getDate() - 7);
      
      console.log('복사 디버깅:', {
        currentWeekStart: currentWeekStart.toDateString(),
        previousWeekStart: previousWeekStart.toDateString(),
        employeeId,
        selectedBranchId
      });
      
      // 해당 직원의 모든 스케줄 확인 (날짜 무관)
      const allEmployeeSchedules = schedules.filter(schedule => schedule.employeeId === employeeId);
      console.log('해당 직원의 모든 스케줄:', allEmployeeSchedules.map(s => ({
        date: s.date.toDateString(),
        dayOfWeek: s.date.getDay(),
        branchId: s.branchId,
        branchName: s.branchName,
        schedule: `${s.startTime}-${s.endTime}(${s.breakTime})`
      })));
      
      // 해당 직원의 이전 주 모든 스케줄 확인 (지점 무관)
      const allPreviousWeekSchedules = schedules.filter(schedule => {
        const scheduleDateStr = toLocalDateString(schedule.date);
        const weekStartStr = toLocalDateString(previousWeekStart);
        const weekEndDate = new Date(previousWeekStart);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        const weekEndStr = toLocalDateString(weekEndDate);
        
        return schedule.employeeId === employeeId && 
               scheduleDateStr >= weekStartStr && 
               scheduleDateStr <= weekEndStr;
      });
      
      console.log('이전 주 전체 스케줄 (지점 무관):', allPreviousWeekSchedules.map(s => ({
        date: s.date.toDateString(),
        dayOfWeek: s.date.getDay(),
        branchId: s.branchId,
        schedule: `${s.startTime}-${s.endTime}(${s.breakTime})`
      })));
      
      // 이전 주의 스케줄 데이터 가져오기 (해당 지점만)
      const previousWeekSchedules = schedules.filter(schedule => {
        const scheduleDateStr = toLocalDateString(schedule.date);
        const weekStartStr = toLocalDateString(previousWeekStart);
        const weekEndDate = new Date(previousWeekStart);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        const weekEndStr = toLocalDateString(weekEndDate);
        
        const isInRange = scheduleDateStr >= weekStartStr && scheduleDateStr <= weekEndStr;
        
        console.log('날짜 범위 확인:', {
          scheduleDateStr,
          weekStartStr,
          weekEndStr,
          isInRange,
          employeeMatch: schedule.employeeId === employeeId,
          branchMatch: schedule.branchId === selectedBranchId
        });
        
        const isMatch = schedule.employeeId === employeeId && 
               schedule.branchId === selectedBranchId && // 해당 지점만
               isInRange;
               
        if (isMatch) {
          console.log('이전 주 스케줄 발견:', {
            date: scheduleDateStr,
            branchId: schedule.branchId,
            branchName: schedule.branchName,
            schedule: `${schedule.startTime}-${schedule.endTime}(${schedule.breakTime})`
          });
        }
        
        return isMatch;
      });

      // 이전주에 데이터가 없어도 현재주 데이터는 삭제하고 빈 상태로 만들기
      if (previousWeekSchedules.length === 0) {
        console.log('이전 주에 복사할 데이터가 없습니다. 현재 주 데이터만 삭제합니다.');
      }

      // 현재 주의 기존 스케줄 삭제 (해당 지점만) - 이전주 데이터 유무와 관계없이 모든 현재주 데이터 삭제
      const currentWeekSchedules = schedules.filter(schedule => {
        const scheduleDateStr = toLocalDateString(schedule.date);
        const weekStartStr = toLocalDateString(currentWeekStart);
        const weekEndDate = new Date(currentWeekStart);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        const weekEndStr = toLocalDateString(weekEndDate);
        
        return schedule.employeeId === employeeId && 
               schedule.branchId === selectedBranchId && // 해당 지점만
               scheduleDateStr >= weekStartStr && 
               scheduleDateStr <= weekEndStr;
      });

      console.log('현재 주 삭제할 스케줄:', currentWeekSchedules.map(s => ({
        date: s.date.toDateString(),
        schedule: `${s.startTime}-${s.endTime}(${s.breakTime})`
      })));

      // 기존 스케줄 삭제와 새 스케줄 추가를 동시에 처리
      const batch = writeBatch(db);
      
      // 기존 스케줄 삭제 (이전주 데이터 유무와 관계없이 모든 현재주 데이터 삭제)
      for (const schedule of currentWeekSchedules) {
        batch.delete(doc(db, 'schedules', schedule.id));
      }

      // 이전 주 데이터를 현재 주로 복사 (데이터가 있을 때만)
      if (previousWeekSchedules.length > 0) {
        const weekDates = getWeekDates();
        const branch = branches.find(b => b.id === selectedBranchId);
        
        for (const prevSchedule of previousWeekSchedules) {
        const prevDate = new Date(prevSchedule.date);
        const dayOfWeek = prevDate.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
        
        // getWeekDates()는 월요일부터 시작하는 배열 [월, 화, 수, 목, 금, 토, 일]
        // dayOfWeek를 배열 인덱스로 변환: 월요일(1)->0, 화요일(2)->1, ..., 일요일(0)->6
        const weekIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const targetDate = new Date(weekDates[weekIndex]);
        
        console.log('복사 중:', {
          prevDate: prevDate.toDateString(),
          dayOfWeek,
          weekIndex,
          targetDate: targetDate.toDateString(),
          schedule: formatScheduleForDisplay(prevSchedule)
        });
        
        // Firebase에 저장할 데이터 준비 (undefined 값 완전 제거)
        const scheduleData: Record<string, unknown> = {
          employeeId: employeeId,
          employeeName: prevSchedule.employeeName,
          branchId: selectedBranchId,
          branchName: branch?.name || '',
          date: targetDate,
          startTime: prevSchedule.startTime,
          endTime: prevSchedule.endTime,
          breakTime: prevSchedule.breakTime,
          totalHours: prevSchedule.totalHours,
          month: `${targetDate.getFullYear()}-${(targetDate.getMonth() + 1).toString().padStart(2, '0')}`, // YYYY-MM 형식
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // timeSlots가 있고 유효한 경우에만 추가
        if (prevSchedule.timeSlots && Array.isArray(prevSchedule.timeSlots) && prevSchedule.timeSlots.length > 0) {
          scheduleData.timeSlots = prevSchedule.timeSlots;
        }

        // originalInput이 있고 유효한 경우에만 추가
        if (prevSchedule.originalInput && typeof prevSchedule.originalInput === 'string' && prevSchedule.originalInput.trim() !== '') {
          scheduleData.originalInput = prevSchedule.originalInput;
        }

        const newScheduleRef = doc(collection(db, 'schedules'));
        batch.set(newScheduleRef, scheduleData);
        }
      }

      // 배치 실행 (삭제와 추가를 동시에 처리)
      await batch.commit();

      // 스케줄 다시 로드
      await loadSchedules();
      
    } catch (error) {
      console.error('이전 주 데이터 복사 중 오류:', error);
      alert('데이터 복사 중 오류가 발생했습니다.');
    }
  };

  // 마우스 호버 핸들러
  const handleMouseEnter = (employeeId: string, date: Date) => {
    const existingSchedule = getScheduleForDate(employeeId, date);
    if (existingSchedule && !isLocked) {
      setHoveredCell({ employeeId, date });
    }
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
  };

  // 드래그 시작 (마우스 다운)
  const handleMouseDown = (e: React.MouseEvent, employeeId: string, date: Date) => {
    if (isLocked) return;
    
    const existingSchedule = getScheduleForDate(employeeId, date);
    if (!existingSchedule) return; // 스케줄이 없으면 드래그 불가
    
    const isCopyMode = !e.ctrlKey; // 드래그=복사, Ctrl+드래그=이동
    
    setDragState({
      isDragging: true,
      sourceCell: { employeeId, date },
      targetCell: null,
      isCopyMode
    });
    
    e.preventDefault();
  };

  // 드래그 중 (마우스 오버)
  const handleDragOver = (e: React.MouseEvent, employeeId: string, date: Date) => {
    if (!dragState.isDragging) return;
    
    setDragState(prev => ({
      ...prev,
      targetCell: { employeeId, date }
    }));
  };

  // 드래그 종료 (마우스 업)
  const handleMouseUp = async () => {
    if (!dragState.isDragging || !dragState.sourceCell || !dragState.targetCell) {
      setDragState({
        isDragging: false,
        sourceCell: null,
        targetCell: null,
        isCopyMode: false
      });
      return;
    }

    const { sourceCell, targetCell, isCopyMode } = dragState;
    
    // 같은 셀이면 무시
    if (sourceCell.employeeId === targetCell.employeeId && 
        sourceCell.date.toDateString() === targetCell.date.toDateString()) {
      setDragState({
        isDragging: false,
        sourceCell: null,
        targetCell: null,
        isCopyMode: false
      });
      return;
    }

    const sourceSchedule = getScheduleForDate(sourceCell.employeeId, sourceCell.date);
    if (!sourceSchedule) return;

    const employee = employees.find(emp => emp.id === targetCell.employeeId);
    const branch = branches.find(branch => branch.id === selectedBranchId);
    
    if (employee && branch) {
      try {
        // 시간 겹침 검증 (드래그 대상 직원)
        const overlapCheck = checkTimeOverlap(
          targetCell.employeeId,
          targetCell.date,
          sourceSchedule.startTime,
          sourceSchedule.endTime
        );
        
        if (overlapCheck.hasOverlap) {
          const targetEmployee = employees.find(emp => emp.id === targetCell.employeeId);
          const confirmMessage = `⚠️ 시간 겹침 경고\n\n${targetEmployee?.name}님의 ${overlapCheck.message}\n\n그래도 이동/복사하시겠습니까?`;
          if (!confirm(confirmMessage)) {
            // 드래그 상태 초기화
            setDragState({
              isDragging: false,
              sourceCell: null,
              targetCell: null,
              isCopyMode: false
            });
            return;
          }
        }
        
        // 배치 작업으로 삭제와 추가를 동시에 처리
        const batch = writeBatch(db);
        
        // 대상 셀의 모든 기존 스케줄 삭제 (중복 방지)
        const existingTargetSchedules = schedules.filter(schedule => 
          schedule.employeeId === targetCell.employeeId &&
          schedule.branchId === selectedBranchId &&
          schedule.date.toDateString() === targetCell.date.toDateString()
        );
        
        for (const existingSchedule of existingTargetSchedules) {
          batch.delete(doc(db, 'schedules', existingSchedule.id));
        }
        
        // Firebase에 저장할 데이터 준비 (undefined 값 완전 제거)
        const scheduleData: Record<string, unknown> = {
          employeeId: targetCell.employeeId,
          employeeName: employee.name,
          branchId: selectedBranchId,
          branchName: branch.name,
          date: targetCell.date,
          startTime: sourceSchedule.startTime,
          endTime: sourceSchedule.endTime,
          breakTime: sourceSchedule.breakTime,
          totalHours: sourceSchedule.totalHours,
          month: `${targetCell.date.getFullYear()}-${(targetCell.date.getMonth() + 1).toString().padStart(2, '0')}`, // YYYY-MM 형식
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // timeSlots가 있고 유효한 경우에만 추가
        if (sourceSchedule.timeSlots && Array.isArray(sourceSchedule.timeSlots) && sourceSchedule.timeSlots.length > 0) {
          scheduleData.timeSlots = sourceSchedule.timeSlots;
        }

        // originalInput이 있고 유효한 경우에만 추가
        if (sourceSchedule.originalInput && typeof sourceSchedule.originalInput === 'string' && sourceSchedule.originalInput.trim() !== '') {
          scheduleData.originalInput = sourceSchedule.originalInput;
        }

        // 새 스케줄 추가
        const newScheduleRef = doc(collection(db, 'schedules'));
        batch.set(newScheduleRef, scheduleData);

        // 복사 모드가 아니면 원본 삭제
        if (!isCopyMode) {
          batch.delete(doc(db, 'schedules', sourceSchedule.id));
        }
        
        // 배치 실행 (삭제와 추가를 동시에 처리)
        await batch.commit();

        await loadSchedules();
      } catch (error) {
        console.error('드래그 작업 오류:', error);
        console.error('드래그 상태:', dragState);
        console.error('소스 스케줄:', sourceSchedule);
        console.error('대상 직원:', employee);
        console.error('대상 지점:', branch);
        alert(`드래그 작업 중 오류가 발생했습니다.\n\n오류: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    setDragState({
      isDragging: false,
      sourceCell: null,
      targetCell: null,
      isCopyMode: false
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">로딩중...</div>
      </div>
    );
  }

  const weekDates = getWeekDates();
  const weeklySummary = calculateWeeklySummary();

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          스케줄 입력
        </h3>
        <div className="flex items-center space-x-3">
          <button
            onClick={checkAndFixTotalHours}
            className="flex items-center space-x-2 px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 font-medium text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>시간 보정</span>
          </button>
          <button
            onClick={() => window.open('/duplicate-schedules', '_blank')}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>중복스케줄 오류</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            <span>공유</span>
          </button>
          <button
            onClick={handleCopyShareUrl}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>공유URL복사</span>
          </button>
          {isLocked && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
              ⚠️ 급여 작업 완료로 인해 수정이 제한됩니다
            </div>
          )}
        </div>
      </div>

      {/* 주간 네비게이션 */}
      <div className="bg-white p-4 rounded-lg shadow border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={goToPreviousWeek}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              ← 이전 주
            </button>
            <span className="text-lg font-medium">
              {weekDates[0].toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ~ {weekDates[6].toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
            </span>
            <button
              onClick={goToNextWeek}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              다음 주 →
            </button>
          </div>
        </div>
      </div>

      {/* 입력 형식 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <button
          onClick={() => setShowInputGuide(!showInputGuide)}
          className="flex items-center justify-between w-full text-left"
        >
          <h4 className="text-sm font-medium text-blue-800">입력방법안내</h4>
          <svg 
            className={`w-4 h-4 text-blue-800 transition-transform ${showInputGuide ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showInputGuide && (
          <div className="mt-3 space-y-3">
            <div>
              <h5 className="text-sm font-medium text-blue-800 mb-2">입력 형식 안내</h5>
              <p className="text-sm text-blue-700">
                단일 시간대: 시작시간-종료시간(휴식시간) &nbsp;&nbsp; ex) 10-22(2), 18.5-23(1)
              </p>
              <p className="text-sm text-blue-700">
                여러 시간대: 쉼표로 구분 &nbsp;&nbsp; ex) 10-13, 19-23(0.5)
              </p>
              <p className="text-sm text-blue-700">
                휴게시간 없는 경우: 시작시간-종료시간 &nbsp;&nbsp; ex) 18-23, 18.5-23
              </p>
            </div>
            
            <div>
              <h5 className="text-sm font-medium text-blue-800 mb-2">입력 방법 안내</h5>
              <div className="flex flex-wrap gap-2 text-sm text-blue-700">
                <span className="inline-flex items-center px-2 py-1 bg-white border border-blue-300 rounded-md">
                  <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Enter</kbd>
                  <span className="ml-1">저장</span>
                </span>
                <span className="inline-flex items-center px-2 py-1 bg-white border border-blue-300 rounded-md">
                  <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Tab</kbd>
                  <span className="ml-1">다음 입력칸 이동</span>
                </span>
                <span className="inline-flex items-center px-2 py-1 bg-white border border-blue-300 rounded-md">
                  <span className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">드래그</span>
                  <span className="ml-1">스케줄 복사</span>
                </span>
                <span className="inline-flex items-center px-2 py-1 bg-white border border-blue-300 rounded-md">
                  <span className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Ctrl+드래그</span>
                  <span className="ml-1">스케줄 이동</span>
                </span>
                <span className="inline-flex items-center px-2 py-1 bg-white border border-blue-300 rounded-md">
                  <span className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">더블클릭</span>
                  <span className="ml-1">스케줄 삭제</span>
                </span>
                <span className="inline-flex items-center px-2 py-1 bg-white border border-blue-300 rounded-md">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                    <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                  </svg>
                  <span>이전 주 데이터 복사</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 현재 편집 지점 표시 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">현재 편집 지점:</span>
          <span className="text-sm font-semibold text-blue-600">
            {branches.find(b => b.id === selectedBranchId)?.name || '지점 정보 없음'}
          </span>
        </div>
      </div>

      {/* 스케줄 입력 테이블 */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-24 px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  지점직원
                </th>
                {weekDates.map((date, index) => {
                  const redDayInfo = isRedDay(date);
                  return (
                    <th 
                      key={index} 
                      className={`w-24 px-1 py-3 text-center text-xs font-medium uppercase tracking-wider ${
                        redDayInfo.isRed ? 'text-red-600' : 'text-gray-500'
                      }`}
                      title={redDayInfo.isRed ? redDayInfo.reason : ''}
                    >
                      <div>
                        {date.getDate()}({['일', '월', '화', '수', '목', '금', '토'][date.getDay()]})
                      </div>
                      {redDayInfo.holiday && (
                        <div className="text-xs text-red-500 mt-1">🎌</div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="w-24 px-2 py-3 text-center text-sm font-medium text-gray-900">
                    <div className="space-y-1">
                      <div className="flex items-center justify-center space-x-1">
                        <span className="truncate">{employee.name}</span>
                        {hasPreviousWeekData(employee.id) && (
                          <button
                            onClick={() => handleCopyPreviousWeek(employee.id)}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                            title="이전 주 데이터 복사"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                              <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                  {weekDates.map((date, index) => {
                    const dateString = toLocalDateString(date);
                    const inputKey = `${employee.id}-${dateString}`;
                    const isEditing = editingCell?.employeeId === employee.id && editingCell?.date === dateString;
                    const existingSchedule = getScheduleForDate(employee.id, date);
                    
                    return (
                      <td key={index} className="w-24 px-1 py-2 text-center align-top">
                        {isEditing ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={scheduleInputs[inputKey] || ''}
                              onChange={(e) => setScheduleInputs(prev => ({
                                ...prev,
                                [inputKey]: e.target.value
                              }))}
                              onKeyDown={(e) => handleKeyDown(e, employee.id, date)}
                              className="w-full max-w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="10-22(2)"
                              autoFocus
                            />
                            
                            {/* 권장 휴게시간 표시 */}
                            {(() => {
                              const currentInput = scheduleInputs[inputKey] || '';
                              const recommendedBreak = calculateRecommendedBreak(currentInput);
                              return recommendedBreak !== null ? (
                                <div 
                                  className="text-xs text-blue-600 cursor-pointer hover:text-blue-800 hover:underline"
                                  onClick={() => handleRecommendedBreakClick(inputKey, recommendedBreak)}
                                  title="클릭하여 권장 휴게시간 추가"
                                >
                                  권장휴게시간 {recommendedBreak}
                                </div>
                              ) : null;
                            })()}
                            
                            {/* 다른 지점 스케줄 정보 (입력 중에도 표시) */}
                            {otherBranchSchedules[`${employee.id}-${dateString}`] && otherBranchSchedules[`${employee.id}-${dateString}`].length > 0 && (
                              <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                                {otherBranchSchedules[`${employee.id}-${dateString}`].map((item, idx) => (
                                  <div key={idx} className="truncate" title={`${item.branchName}: ${item.schedule}`}>
                                    <span className="font-medium">{item.branchName}:</span> {item.schedule}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            <div className="flex space-x-1 justify-center">
                              <button
                                onClick={() => handleCellSave(employee.id, date)}
                                className="px-1 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => handleCellCancel(employee.id, date)}
                                className="px-1 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <div
                              className={`relative px-1 py-1 text-xs rounded cursor-pointer hover:bg-gray-100 min-h-[24px] flex items-center w-full ${
                                checkOtherBranchTimeOverlap(employee.id, date, existingSchedule || null) 
                                  ? 'bg-red-200 text-red-900 border-2 border-red-400' 
                                  : existingSchedule 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-gray-50 text-gray-500'
                              } ${isLocked ? 'cursor-not-allowed opacity-50' : ''} ${
                                dragState.isDragging && dragState.targetCell?.employeeId === employee.id && 
                                dragState.targetCell?.date.toDateString() === date.toDateString() 
                                  ? 'bg-yellow-200 border-2 border-yellow-400' : ''
                              }`}
                              onClick={() => handleCellClick(employee.id, date)}
                              onDoubleClick={() => handleScheduleDelete(employee.id, date)}
                              onMouseDown={(e) => handleMouseDown(e, employee.id, date)}
                              onMouseEnter={() => handleMouseEnter(employee.id, date)}
                              onMouseLeave={handleMouseLeave}
                              onMouseOver={(e) => handleDragOver(e, employee.id, date)}
                              onMouseUp={handleMouseUp}
                              title={existingSchedule ? 
                                `${formatScheduleForDisplay(existingSchedule)} - 더블클릭: 삭제` : 
                                '클릭하여 입력'
                              }
                            >
                              <div className="truncate w-full">
                                {existingSchedule 
                                  ? formatScheduleForDisplay(existingSchedule)
                                  : '클릭하여 입력'
                                }
                              </div>
                            
                              {/* 드래그 아이콘 및 툴팁 */}
                              {hoveredCell?.employeeId === employee.id && 
                               hoveredCell?.date.toDateString() === date.toDateString() && 
                               existingSchedule && 
                               !isLocked && (
                                <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                                  <div className="flex items-center space-x-1">
                                    <span>↕️</span>
                                    <span>드래그: 복사</span>
                                    <span>|</span>
                                    <span>Ctrl+드래그: 이동</span>
                                    <span>|</span>
                                    <span>🗑️ 더블클릭: 삭제</span>
                                  </div>
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                                </div>
                              )}
                              
                              {/* 드래그 아이콘 */}
                              {hoveredCell?.employeeId === employee.id && 
                               hoveredCell?.date.toDateString() === date.toDateString() && 
                               existingSchedule && 
                               !isLocked && (
                                <div className="absolute top-0 right-0 transform translate-x-0.5 -translate-y-0.5 text-gray-600 text-xs">
                                  ↕️
                                </div>
                              )}
                            </div>
                            
                            {/* 다른 지점 스케줄 정보 (공유화면과 동일한 구조) */}
                            {otherBranchSchedules[`${employee.id}-${dateString}`] && otherBranchSchedules[`${employee.id}-${dateString}`].length > 0 && (
                              <div className="text-xs text-gray-600 space-y-0.5 mt-1 w-full">
                                {otherBranchSchedules[`${employee.id}-${dateString}`].map((item, idx) => (
                                  <div key={idx} className="truncate" title={`${item.branchName}: ${item.schedule}`}>
                                    <span className="font-medium">{item.branchName}:</span> {item.schedule}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 주간 비고 */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">주간 비고</h3>
          <p className="text-sm text-gray-600 mt-1">이번 주 특별사항을 자유롭게 입력하세요</p>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <textarea
              value={weeklyNote}
              onChange={(e) => setWeeklyNote(e.target.value)}
              placeholder="이번 주 특별사항, 공지사항, 변경사항 등을 입력하세요..."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex justify-end">
              <button
                onClick={saveWeeklyNote}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                비고 저장
              </button>
            </div>
            {currentWeeklyNote && (
              <div className="text-sm text-gray-500">
                마지막 수정: {currentWeeklyNote.updatedAt.toLocaleString('ko-KR')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 주간 집계 */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            사람별 주간 집계
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이름
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  월
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  화
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  수
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  목
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  금
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  토
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  일
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  총합
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {weeklySummary.length > 0 ? (
                <>
                  {weeklySummary.map((summary, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">
                        {summary.employeeName}
                        {summary.employmentType === '근로소득' && summary.weeklyWorkHours && (
                          <span className="text-xs text-gray-500 ml-1">
                            ({summary.weeklyWorkHours})
                          </span>
                        )}
                      </td>
                      {summary.dailyHours.map((hours, dayIndex) => (
                        <td key={dayIndex} className="px-2 py-3 text-center text-sm text-gray-900">
                          {hours > 0 ? hours.toFixed(1) : '-'}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">
                        {summary.totalHours.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                  {/* 합계 행 */}
                  <tr className="bg-gray-50 border-t-2 border-gray-300">
                    <td className="px-4 py-3 text-center text-sm font-bold text-gray-900">
                      합계
                    </td>
                    {Array.from({ length: 7 }, (_, dayIndex) => {
                      const dayTotal = weeklySummary.reduce((sum, summary) => sum + summary.dailyHours[dayIndex], 0);
                      return (
                        <td key={dayIndex} className="px-2 py-3 text-center text-sm font-bold text-gray-900">
                          {dayTotal > 0 ? dayTotal.toFixed(1) : '-'}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center text-sm font-bold text-gray-900">
                      {weeklySummary.reduce((sum, summary) => sum + summary.totalHours, 0).toFixed(1)}
                    </td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                    이번 주에 등록된 스케줄이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 시간대별 근무 인원 히트맵 */}
      {weeklySummary.length > 0 && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">시간대별 근무 인원 현황</h3>
            <p className="text-sm text-gray-600 mt-1">특정 시간대에 몇 명이 근무하는지 확인할 수 있습니다</p>
          </div>
          <div className="p-6">
            {/* 시간대별 근무 인원 계산 */}
            {(() => {
              const weekDates = getWeekDates();
              const timeSlots = [];
              
              // 9시부터 23시까지 1시간 단위로 시간대 생성
              for (let hour = 9; hour <= 23; hour++) {
                timeSlots.push(hour);
              }
              
              // 각 시간대별로 근무 인원 계산
              const hourlyData = timeSlots.map(hour => {
                const dayData = weekDates.map(date => {
                  // 해당 날짜의 모든 스케줄 필터링
                  const daySchedules = schedules.filter(schedule => {
                    const scheduleDateStr = toLocalDateString(schedule.date);
                    const targetDateStr = toLocalDateString(date);
                    return scheduleDateStr === targetDateStr && schedule.branchId === selectedBranchId;
                  });
                  
                  // 해당 시간에 근무하는 직원들 찾기
                  const workingEmployeeIds = new Set();
                  
                  daySchedules.forEach(schedule => {
                    let isWorkingAtHour = false;
                    
                    if (schedule.originalInput) {
                      // originalInput 파싱 (예: "10-13.5(0.5),19-22(0.5)")
                      const timeRanges = schedule.originalInput.split(',').map(range => range.trim());
                      isWorkingAtHour = timeRanges.some(range => {
                        const match = range.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(?:\(([\d.]+)\))?$/);
                        if (match) {
                          const startHour = parseFloat(match[1]);
                          const endHour = parseFloat(match[2]);
                          return startHour <= hour && endHour > hour;
                        }
                        return false;
                      });
                    } else if (schedule.timeSlots && schedule.timeSlots.length > 0) {
                      // timeSlots 처리
                      isWorkingAtHour = schedule.timeSlots.some(slot => {
                        const startHour = parseFloat(slot.startTime.split(':')[0]) + 
                                        (parseFloat(slot.startTime.split(':')[1]) / 60);
                        const endHour = parseFloat(slot.endTime.split(':')[0]) + 
                                      (parseFloat(slot.endTime.split(':')[1]) / 60);
                        return startHour <= hour && endHour > hour;
                      });
                    } else {
                      // 단일 시간대 처리
                      const startHour = parseFloat(schedule.startTime.split(':')[0]) + 
                                      (parseFloat(schedule.startTime.split(':')[1]) / 60);
                      const endHour = parseFloat(schedule.endTime.split(':')[0]) + 
                                    (parseFloat(schedule.endTime.split(':')[1]) / 60);
                      isWorkingAtHour = startHour <= hour && endHour > hour;
                    }
                    
                    if (isWorkingAtHour) {
                      workingEmployeeIds.add(schedule.employeeId);
                    }
                  });
                  
                  return workingEmployeeIds.size;
                });
                
                return { hour, dayData };
              });
              
              Math.max(...hourlyData.flatMap(d => d.dayData));
              
              return (
                <div className="space-y-4">
                  {/* 요일 헤더 */}
                  <div className="flex">
                    <div className="w-16 text-sm font-medium text-gray-700 text-center">시간</div>
                    {weekDates.map((date, index) => (
                      <div key={index} className="flex-1 text-center">
                        <div className="text-sm font-medium text-gray-700">
                          {date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {['월', '화', '수', '목', '금', '토', '일'][index]}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* 시간대별 히트맵 */}
                  <div className="space-y-1">
                    {hourlyData.map(({ hour, dayData }) => (
                      <div key={hour} className="flex items-center">
                        <div className="w-16 text-sm font-medium text-gray-700 text-center">
                          {hour}:00
                        </div>
                        {dayData.map((count, dayIndex) => {
                          const bgColor = count === 0 ? 'bg-gray-100' :
                                        count === 1 ? 'bg-green-200' :
                                        count === 2 ? 'bg-green-400' :
                                        count === 3 ? 'bg-yellow-400' :
                                        count >= 4 ? 'bg-red-400' : 'bg-gray-200';
                          
                          return (
                            <div 
                              key={dayIndex} 
                              className={`flex-1 h-8 border border-gray-200 flex items-center justify-center text-xs font-medium transition-all duration-200 hover:scale-105 ${bgColor}`}
                              title={`${weekDates[dayIndex].toLocaleDateString('ko-KR')} ${hour}:00 - ${count}명 근무`}
                            >
                              {count > 0 && (
                                <span className={`${count >= 4 ? 'text-white' : 'text-gray-800'}`}>
                                  {count}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  
                  {/* 범례 */}
                  <div className="mt-6 flex justify-center space-x-6 text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded"></div>
                      <span className="text-gray-600">0명</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-green-200 rounded"></div>
                      <span className="text-gray-600">1명</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-green-400 rounded"></div>
                      <span className="text-gray-600">2명</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-yellow-400 rounded"></div>
                      <span className="text-gray-600">3명</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-red-400 rounded"></div>
                      <span className="text-gray-600">4명 이상</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
}
