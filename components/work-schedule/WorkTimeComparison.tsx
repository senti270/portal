'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { collection, getDocs, query, where, addDoc, updateDoc, doc, deleteDoc, orderBy, limit, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toLocalDate, toLocalDateString } from '@/utils/work-schedule/dateUtils';

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
  createdAt: Date;
  updatedAt: Date;
}

interface ActualWorkRecord {
  date: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  employeeName?: string; // 파싱 후 매칭을 위해 추가
  isNewFormat?: boolean; // 새로운 형식인지 여부 (휴게시간 이미 차감됨)
  posTimeRange?: string; // POS 원본 시간 범위 (예: "10:02-22:32")
  calculatedBreakTime?: number; // POS 데이터가 여러 건일 때 계산된 휴게시간 (시간 단위)
  isMultipleRecords?: boolean; // 같은 날 여러 건이 합쳐졌는지 여부
}

interface WorkTimeComparison {
  employeeName: string;
  date: string;
  scheduledHours: number;
  actualHours: number;
  difference: number;
  status: 'time_match' | 'review_required' | 'review_completed';
  scheduledTimeRange?: string; // "19:00-22:00" 형태
  actualTimeRange?: string; // "19:00-22:11" 형태 (편집 가능)
  isModified?: boolean; // 수정 여부
  // 휴게시간 및 실근무시간
  breakTime?: number; // 휴게시간 (시간) - 기존 필드
  actualBreakTime?: number; // 실휴게시간 (시간) - 신규 필드 (편집 가능)
  actualWorkHours?: number; // 실근무시간 (actualTimeRange시간 - actualBreakTime)
  posTimeRange?: string; // POS 원본 시간 범위
  isNew?: boolean; // 수동 추가된 행 여부
  branchId?: string;
  branchName?: string;
  isManual?: boolean;
  docId?: string;
}

interface WorkTimeComparisonProps {
  userBranch?: {
    id: string;
    name: string;
    managerEmail?: string;
  } | null;
  isManager?: boolean;
  selectedEmployeeId?: string;
  selectedMonth?: string;
  selectedBranchId?: string;
  hideEmployeeSelection?: boolean;
  hideBranchSelection?: boolean;
  selectedEmployeeBranches?: string[]; // 선택된 직원의 지점 목록
  onStatusChange?: () => void; // 상태 변경 시 호출되는 콜백
}

export default function WorkTimeComparison({ 
  userBranch, 
  isManager, 
  selectedEmployeeId: propSelectedEmployeeId,
  selectedMonth: propSelectedMonth,
  selectedBranchId: propSelectedBranchId,
  hideEmployeeSelection = false,
  hideBranchSelection = false,
  selectedEmployeeBranches: propSelectedEmployeeBranches = [],
}: WorkTimeComparisonProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [actualWorkData, setActualWorkData] = useState<string>('');
  const [comparisonResults, setComparisonResults] = useState<WorkTimeComparison[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(propSelectedMonth || '');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(propSelectedBranchId || '');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(propSelectedEmployeeId || '');
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<{
    id: string; 
    name: string; 
    branchId: string; 
    type?: string;
    employmentType?: string;
    salaryType?: string;
  }[]>([]);
  const [branches, setBranches] = useState<{id: string; name: string}[]>([]);
  const [employeeReviewStatus, setEmployeeReviewStatus] = useState<{employeeId: string, branchId: string, status: '검토전' | '검토중' | '근무시간검토완료' | '급여확정완료'}[]>([]);
  const [payrollConfirmedEmployees, setPayrollConfirmedEmployees] = useState<string[]>([]);
  const [employeeMemos, setEmployeeMemos] = useState<{[employeeId: string]: {admin: string, employee: string}}>({});
  
  // 전월 이월 연장근무시간 입력 팝업 상태
  const [showOvertimePopup, setShowOvertimePopup] = useState(false);
  const [overtimeInput, setOvertimeInput] = useState('');
  const [pendingOvertimeCalculation, setPendingOvertimeCalculation] = useState<{
    employeeId: string;
    currentWeekStart: Date;
    actualWorkHours: number;
  } | null>(null);
  const [hasShownOvertimePopup, setHasShownOvertimePopup] = useState(false); // 팝업 표시 여부 추적
  const [showMenuDescription, setShowMenuDescription] = useState(false); // 메뉴 설명 펼침 여부
  const [showDataCopyMethod, setShowDataCopyMethod] = useState(false); // 데이터 복사 방법 펼침 여부
  const [employeeBranches, setEmployeeBranches] = useState<string[]>([]); // 선택된 직원의 지점 목록
  const [editingBreakTimeIndex, setEditingBreakTimeIndex] = useState<number | null>(null); // 실휴게시간 편집 중인 인덱스
  const [editingBreakTimeValue, setEditingBreakTimeValue] = useState<string>(''); // 실휴게시간 편집 중인 원시 값
  const [editingActualTimeRangeIndex, setEditingActualTimeRangeIndex] = useState<number | null>(null); // 실근무시각 편집 인덱스
  const [editingActualTimeRangeValue, setEditingActualTimeRangeValue] = useState<string>(''); // 실근무시각 편집 값

  // 🔥 최적화: 컴포넌트 마운트 시 초기 설정
  useEffect(() => {
    loadBranches();
    // 현재 월을 기본값으로 설정 (props가 없을 때만)
    if (!propSelectedMonth) {
      const now = new Date();
      setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    }
    
    // 매니저인 경우 해당 지점을 기본값으로 설정 (props가 없을 때만)
    if (isManager && userBranch && !propSelectedBranchId) {
      setSelectedBranchId(userBranch.id);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 🔒 급여확정된 직원 목록 로드 (선택된 월 기준)
  useEffect(() => {
    async function loadPayrollConfirmed() {
      try {
        if (!selectedMonth) return;
        const snapshot = await getDocs(
          query(
            collection(db, 'confirmedPayrolls'),
            where('month', '==', selectedMonth)
          )
        );
        const ids = Array.from(new Set(snapshot.docs.map(d => d.data().employeeId).filter(Boolean)));
        setPayrollConfirmedEmployees(ids as string[]);
        console.log('🔒 급여확정 직원 목록 로드:', ids);
      } catch (e) {
        console.warn('급여확정 목록 로드 실패(무시 가능):', e);
      }
    }
    loadPayrollConfirmed();
  }, [selectedMonth]);
  
  // 🔥 최적화: 월 변경 시에만 직원 로드 (지점 무관)
  useEffect(() => {
    if (selectedMonth) {
      loadEmployees();
    }
  }, [selectedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEmployees = useCallback(async () => {
    console.log('loadEmployees 호출됨:', { selectedBranchId, selectedMonth });
    if (!selectedMonth) {
      console.log('loadEmployees 조건 불만족:', { selectedMonth });
      return;
    }
    
    try {
      setLoading(true);
      console.log('직원 로드 시작...');
      
      // 모든 직원을 로드한 후 클라이언트에서 필터링 (인덱스 문제 완전 해결)
      console.log('Firestore 직원 컬렉션 조회 시작...');
      const employeeSnapshot = await getDocs(collection(db, 'employees'));
      console.log('Firestore 직원 컬렉션 조회 완료, 문서 수:', employeeSnapshot.docs.length);
      
      const allEmployees = employeeSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        branchId: doc.data().branchId || '',
        type: doc.data().type,
        employmentType: doc.data().employmentType,
        salaryType: doc.data().salaryType,
        branchIds: doc.data().branchIds || [],
        ...doc.data()
      }));
      
      console.log('모든 직원 데이터 매핑 완료:', allEmployees.length);
      console.log('선택된 지점 ID:', selectedBranchId);
      
      // 지점 선택 후 직원 필터링: branchIds 포함 또는 단일 branchId 일치
      const employeesData = allEmployees.filter(emp => {
        if (!selectedBranchId) return true;
        const list = Array.isArray(emp.branchIds) ? emp.branchIds : [];
        return emp.branchId === selectedBranchId || list.includes(selectedBranchId);
      });
      
      console.log('필터링된 직원 수:', employeesData.length);
      
      // 이름순으로 정렬
      employeesData.sort((a, b) => a.name.localeCompare(b.name));

      console.log('로드된 직원 수:', employeesData.length);
      setEmployees(employeesData);
      
    } catch (error) {
      console.error('직원 로드 중 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedBranchId]);

  // Props 변경 시 상태 업데이트
  useEffect(() => {
    if (propSelectedEmployeeId !== undefined) {
      setSelectedEmployeeId(propSelectedEmployeeId);
    }
  }, [propSelectedEmployeeId]);

  useEffect(() => {
    if (propSelectedMonth !== undefined) {
      setSelectedMonth(propSelectedMonth);
    }
  }, [propSelectedMonth]);

  useEffect(() => {
    if (propSelectedBranchId !== undefined) {
      setSelectedBranchId(propSelectedBranchId);
    }
  }, [propSelectedBranchId]);

  // 선택된 직원의 지점 정보 가져오기
  const getEmployeeBranches = useCallback(async (employeeId: string) => {
    try {
      // console.log('직원 지점 정보 조회 시작:', employeeId);
      
      // doc() 함수를 사용하여 특정 문서 ID로 직접 조회
      const employeeRef = doc(db, 'employees', employeeId);
      const employeeSnap = await getDoc(employeeRef);
      
      if (employeeSnap.exists()) {
        const employeeData = employeeSnap.data();
        // console.log('직원 데이터:', employeeData);
        const branches = employeeData.branches || [];
        // console.log('직원 지점:', branches);
        return branches;
      } else {
        console.log('직원 문서가 존재하지 않음:', employeeId);
        return [];
      }
    } catch (error) {
      console.error('직원 지점 정보 로드 실패:', error);
      return [];
    }
  }, []);

  // 선택된 직원이 변경될 때 해당 직원의 지점 정보 로드
  useEffect(() => {
    if (selectedEmployeeId && hideEmployeeSelection) {
      console.log('직원 지점 정보 로드 시작:', selectedEmployeeId);
      console.log('Props로 받은 직원 지점:', propSelectedEmployeeBranches);
      console.log('propSelectedEmployeeBranches 타입:', typeof propSelectedEmployeeBranches);
      console.log('propSelectedEmployeeBranches 길이:', propSelectedEmployeeBranches?.length);
      
      // Props로 받은 지점 정보가 있으면 사용, 없으면 DB에서 조회
      if (propSelectedEmployeeBranches && propSelectedEmployeeBranches.length > 0) {
        console.log('Props 지점 정보 사용:', propSelectedEmployeeBranches);
        setEmployeeBranches(propSelectedEmployeeBranches);
        // 지점이 1개인 경우 자동 선택, 여러 개인 경우 기존 선택 유지
        if (propSelectedEmployeeBranches.length === 1) {
          setSelectedBranchId(propSelectedEmployeeBranches[0]);
        } else if (!selectedBranchId) {
          setSelectedBranchId(propSelectedEmployeeBranches[0]);
        }
      } else {
        console.log('DB에서 지점 정보 조회');
        getEmployeeBranches(selectedEmployeeId).then(branchIds => {
          console.log('직원 지점 정보 로드 결과:', branchIds);
          setEmployeeBranches(branchIds);
          // 지점이 1개인 경우 자동 선택, 여러 개인 경우 기존 선택 유지
          if (branchIds.length === 1) {
            setSelectedBranchId(branchIds[0]);
          } else if (branchIds.length > 0 && !selectedBranchId) {
            setSelectedBranchId(branchIds[0]);
          }
        });
      }
    }
  }, [selectedEmployeeId, hideEmployeeSelection, getEmployeeBranches, selectedBranchId, propSelectedEmployeeBranches]);

  // 지점 선택이 숨겨진 경우 첫 번째 지점 자동 선택 및 비교결과 자동 로드
  useEffect(() => {
    if (hideBranchSelection && branches.length > 0 && !selectedBranchId) {
      const firstBranch = branches[0];
      setSelectedBranchId(firstBranch.id);
    }
  }, [hideBranchSelection, branches, selectedBranchId]);

  // 지점과 직원이 선택되고 비교결과가 있으면 자동으로 로드 (정의 이후로 이동)

  // 지점 필터링 최적화 (현재 사용하지 않음)
  // const filteredBranches = useMemo(() => {
  //   return branches.filter(branch => hideEmployeeSelection ? employeeBranches.includes(branch.id) : true);
  // }, [branches, hideEmployeeSelection, employeeBranches]);

  // 월이나 지점이 변경될 때 직원 목록 다시 로드
  useEffect(() => {
    if (selectedMonth && (selectedBranchId || (isManager && userBranch))) {
      loadEmployees();
    }
  }, [selectedMonth, selectedBranchId, isManager, userBranch, loadEmployees]);


  // 지점이나 직원이 변경될 때 스케줄 다시 로드
  useEffect(() => {
    if (selectedMonth) {
      loadSchedules(selectedMonth);
    }
  }, [selectedBranchId, selectedEmployeeId, selectedMonth, loadEmployees]);


  // 직원 메모 로드
  const loadEmployeeMemos = useCallback(async () => {
    if (!selectedMonth || !selectedEmployeeId) return;
    
    try {
      // 관리자용 메모와 해당직원공지용 메모를 모두 로드
      const memosQuery = query(
        collection(db, 'employeeMemos'),
        where('month', '==', selectedMonth),
        where('employeeId', '==', selectedEmployeeId)
      );
      
      const memosSnapshot = await getDocs(memosQuery);
      const memosData: {admin: string, employee: string} = { admin: '', employee: '' };
      
      memosSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.type === 'admin') {
          memosData.admin = data.memo || '';
        } else if (data.type === 'employee') {
          memosData.employee = data.memo || '';
        }
      });
      
      // 로컬 상태 업데이트
      setEmployeeMemos(prev => ({
        ...prev,
        [selectedEmployeeId]: memosData
      }));
      
      console.log('🔥 직원 메모 로드 완료:', selectedEmployeeId, memosData);
    } catch (error) {
      console.error('직원 메모 로드 실패:', error);
    }
  }, [selectedMonth, selectedEmployeeId]);

  // 메모 로드
  useEffect(() => {
    loadEmployeeMemos();
  }, [loadEmployeeMemos]);

  // 직원이 변경될 때 실제근무데이터 초기화 및 기존 데이터 로드
  useEffect(() => {
      // console.log('직원 변경 useEffect 실행:', selectedEmployeeId, selectedMonth);
    if (selectedEmployeeId) {
      // 직원이 변경되면 실제근무데이터 초기화
      setActualWorkData('');
      
      // 먼저 비교 결과 초기화 (다른 직원 데이터가 보이지 않도록)
      setComparisonResults([]);
      
      // 팝업 표시 상태 초기화 (새 직원 선택 시 팝업 다시 표시 가능)
      setHasShownOvertimePopup(false);
      
      // 기존 비교 데이터가 있는지 확인하고 로드 (현재 비활성화)
      // console.log('loadExistingComparisonData 호출 예정');
      // loadExistingComparisonData();
    } else {
      // 직원이 선택되지 않았으면 비교 결과 초기화
      setComparisonResults([]);
    }
  }, [selectedEmployeeId, selectedMonth]);

  // 수동 행 추가
  const addManualComparisonRow = useCallback(() => {
    if (!selectedEmployeeId || !selectedMonth) return;
    const employee = employees.find(emp => emp.id === selectedEmployeeId);
    const branchName = branches.find(b => b.id === selectedBranchId)?.name || '';
    const defaultDate = `${selectedMonth}-01`;
    const newRow: WorkTimeComparison = {
      employeeName: formatEmployeeNameWithBranch(employee?.name || '알 수 없음', branchName),
      date: defaultDate,
      scheduledHours: 0,
      actualHours: 0,
      difference: 0,
      status: 'review_required',
      scheduledTimeRange: '-',
      actualTimeRange: '',
      isModified: true,
      breakTime: 0,
      actualBreakTime: 0,
      actualWorkHours: 0,
      posTimeRange: '',
      branchId: selectedBranchId || '',
      branchName: branchName,
      isNew: true,
      isManual: true,
      docId: undefined
    };
    const updated = [...comparisonResults, newRow];
    setComparisonResults(updated);
    // 비동기 저장 후 docId를 상태에 반영
    saveComparisonResults(updated).then(savedResults => {
      // 🔥 저장 후 docId가 설정된 결과를 상태에 반영
      if (savedResults) {
        setComparisonResults(savedResults);
        console.log('✅ 수동 행 저장 완료, 상태 업데이트됨:', savedResults.filter(r => r.isManual && r.docId));
      }
    }).catch(err => console.error('수동 행 저장 실패:', err));
  }, [selectedEmployeeId, selectedMonth, employees, branches, selectedBranchId, comparisonResults]);

  // 선택 월의 시작/끝 날짜 반환
  const getSelectedMonthRange = useCallback(() => {
    if (!selectedMonth) return { start: null as Date | null, end: null as Date | null };
    const [y, m] = selectedMonth.split('-').map(Number);
    const start = new Date(y, (m || 1) - 1, 1);
    const end = new Date(y, (m || 1), 0, 23, 59, 59, 999);
    return { start, end };
  }, [selectedMonth]);

  const loadBranches = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'branches'));
      const branchesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || ''
      }));
      setBranches(branchesData);
    } catch (error) {
      console.error('지점 목록을 불러올 수 없습니다:', error);
    }
  };

  // 급여확정된 직원 목록 로드 (현재 사용하지 않음)
  // const loadPayrollConfirmedEmployees = useCallback(async () => {
  //   try {
  //     if (!selectedMonth) return;
  //     
  //     // 매니저의 경우 userBranch.id 사용, 일반 사용자의 경우 selectedBranchId 사용
  //     const branchId = isManager && userBranch ? userBranch.id : selectedBranchId;
  //     
  //     const payrollQuery = query(
  //       collection(db, 'payrollRecords'),
  //       where('month', '==', selectedMonth),
  //       where('branchId', '==', branchId)
  //     );
  //     const payrollSnapshot = await getDocs(payrollQuery);
  //     
  //     const confirmedEmployeeIds = payrollSnapshot.docs.map(doc => doc.data().employeeId);
  //     setPayrollConfirmedEmployees(confirmedEmployeeIds);
  //     console.log('급여확정된 직원 목록:', confirmedEmployeeIds);
  //   } catch (error) {
  //     console.error('급여확정 직원 목록 로드 실패:', error);
  //   }
  // }, [selectedMonth, selectedBranchId, isManager, userBranch]);


  // 직원별 급여메모 저장
  const saveEmployeeMemo = async (employeeId: string, memo: string, type: 'admin' | 'employee') => {
    try {
      const memoRecord = {
        employeeId,
        type,
        memo,
        month: selectedMonth,
        updatedAt: new Date()
      };

      // 기존 메모가 있는지 확인 (타입별로)
      const existingQuery = query(
        collection(db, 'employeeMemos'),
        where('employeeId', '==', employeeId),
        where('month', '==', selectedMonth),
        where('type', '==', type)
      );
      const existingDocs = await getDocs(existingQuery);
      
      if (existingDocs.empty) {
        // 새로 추가
        await addDoc(collection(db, 'employeeMemos'), memoRecord);
        console.log(`새로운 직원 메모 저장됨 (${type}):`, memoRecord);
      } else {
        // 기존 데이터 업데이트
        const docId = existingDocs.docs[0].id;
        await updateDoc(doc(db, 'employeeMemos', docId), memoRecord);
        console.log(`기존 직원 메모 업데이트됨 (${type}):`, memoRecord);
      }
      
      // 로컬 상태 업데이트
      setEmployeeMemos(prev => ({
        ...prev,
        [employeeId]: {
          ...prev[employeeId],
          [type]: memo
        }
      }));
      
    } catch (error) {
      console.error('직원 메모 저장 실패:', error);
    }
  };

  // 급여확정 여부 확인
  const isPayrollConfirmed = (employeeId: string) => {
    // employeeReviewStatus에서 급여확정완료 상태인지 확인
    return employeeReviewStatus.some(status => 
      status.employeeId === employeeId && status.status === '급여확정완료'
    );
  };

  // 중복 데이터 정리 함수 (현재 사용하지 않음 - 전체 함수 제거)

  // 검토 상태를 DB에 저장 (지점별로 분리)
  const saveReviewStatus = async (employeeId: string, status: '검토전' | '검토중' | '근무시간검토완료' | '급여확정완료', branchIdParam?: string) => {
    try {
      // branchId 파라미터가 있으면 사용, 없으면 selectedBranchId 사용
      const targetBranchId = branchIdParam || selectedBranchId;
      
      if (!targetBranchId) {
        console.error('❌ branchId가 없습니다. 상태 저장을 취소합니다.');
        alert('지점이 선택되지 않았습니다. 지점을 먼저 선택해주세요.');
        return;
      }
      
      // 🔒 급여확정완료 상태인지 확인 (해당 지점의 상태 확인)
      const existingStatus = employeeReviewStatus.find(s => 
        s.employeeId === employeeId && s.branchId === targetBranchId
      );
      
      // 급여확정완료 상태에서는 변경 불가 (급여확정취소 전까지)
      if (existingStatus?.status === '급여확정완료' && status !== '급여확정완료') {
        alert('급여확정완료 상태에서는 검토상태를 변경할 수 없습니다. 급여확정취소 후 다시 시도해주세요.');
        return;
      }
      
      // 🔒 급여확정 시 상태 변경 차단 (확정완료만 허용)
      if (status !== '급여확정완료' && payrollConfirmedEmployees.includes(employeeId)) {
        alert('급여확정완료 상태에서는 검토상태를 변경할 수 없습니다.');
        return;
      }
      
      console.log('🔵 검토 상태 저장 시작:', { employeeId, status, selectedMonth, targetBranchId, branchIdParam, selectedBranchId });
      
      // 현재 선택된 지점에 대한 상태 저장
      const reviewStatusRecord = {
        employeeId,
        status,
        month: selectedMonth,
        branchId: targetBranchId,
        updatedAt: new Date()
      };

      // 고정 키로 업서트 (멱등): employeeId_branchId_month
      const selectedEmployee = employees.find(emp => emp.id === employeeId);
      const selectedBranch = branches.find(br => br.id === targetBranchId);
      const optimizedReviewStatusRecord = {
        ...reviewStatusRecord,
        employeeName: selectedEmployee?.name || '알 수 없음',
        branchName: selectedBranch?.name || '알 수 없음',
      };
      const fixedId = `${employeeId}_${targetBranchId}_${selectedMonth}`;
      await setDoc(doc(db, 'employeeReviewStatus', fixedId), optimizedReviewStatusRecord, { merge: true });
      console.log('✅ 검토 상태 업서트 완료 (setDoc):', fixedId, optimizedReviewStatusRecord);
      
      console.log('🔵 검토 상태 저장 완료, loadReviewStatus 호출 예정');
      
      // 해당 직원만 상태 새로고침
      if ((window as unknown as { refreshEmployeeStatus?: (id: string) => void }).refreshEmployeeStatus && selectedEmployeeId) {
        (window as unknown as { refreshEmployeeStatus: (id: string) => void }).refreshEmployeeStatus(selectedEmployeeId);
      }
    } catch (error) {
      console.error('❌ 검토 상태 저장 실패:', error);
      alert('검토 상태 저장에 실패했습니다: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // 검토 상태를 DB에서 로드하고, 없으면 "검토전"으로 insert
  const loadReviewStatus = useCallback(async (employeesList: typeof employees) => {
    try {
      if (!selectedMonth) return;
      
      console.log('🔥🔥🔥 ============================================');
      console.log('🔥🔥🔥 loadReviewStatus 시작 - 선택된 월:', selectedMonth);
      console.log('🔥🔥🔥 직원 목록 길이:', employeesList.length);
      
      // 해당 월의 모든 검토 상태 조회
      const reviewStatusQuery = query(
        collection(db, 'employeeReviewStatus'),
        where('month', '==', selectedMonth)
      );
      const reviewStatusSnapshot = await getDocs(reviewStatusQuery);
      
      console.log('검토 상태 쿼리 결과 문서 수:', reviewStatusSnapshot.docs.length);
      
      const savedReviewStatuses = reviewStatusSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('🔥🔥🔥 저장된 검토 상태 데이터:', data);
        return {
          employeeId: data.employeeId,
          branchId: data.branchId,
          status: data.status as '검토전' | '검토중' | '근무시간검토완료' | '급여확정완료'
        };
      });
      
      console.log('🔥🔥🔥 DB에서 로드된 검토 상태 총', savedReviewStatuses.length, '건:', savedReviewStatuses);
      
      // 직원 목록이 비어있으면 저장된 상태만 사용
      if (employeesList.length === 0) {
        console.log('직원 목록이 비어있음, 저장된 상태만 사용');
        setEmployeeReviewStatus(savedReviewStatuses);
        return;
      }
      
      // 🔥 선택된 직원이 있으면 해당 직원의 지점별로 상태 확인 및 생성
      // 단, 이미 DB에 상태가 있으면 추가로 생성하지 않음 (급여확정 취소 후 상태가 덮어쓰이지 않도록)
      // selectedEmployeeId가 없어도 DB에서 로드한 상태는 그대로 사용
      if (selectedEmployeeId) {
        // 해당 직원의 모든 지점에 대해 DB에 상태가 있는지 확인
        const employeeBranchesQuery = query(
          collection(db, 'employeeBranches'),
          where('employeeId', '==', selectedEmployeeId)
        );
        const employeeBranchesSnapshot = await getDocs(employeeBranchesQuery);
        const employeeBranchIds = employeeBranchesSnapshot.docs.map(doc => doc.data().branchId).filter(Boolean);
        
        // 해당 직원의 모든 지점에 대해 DB에 상태가 있는지 확인
        const allStatusesExist = employeeBranchIds.every(branchId => {
          return savedReviewStatuses.some(s => 
            s.employeeId === selectedEmployeeId && s.branchId === branchId
          );
        });
        
        // 모든 지점의 상태가 DB에 있으면 추가 생성하지 않음
        if (allStatusesExist) {
          console.log('✅ 해당 직원의 모든 지점 상태가 DB에 존재, 추가 생성하지 않음');
        } else if (employeeBranchIds.length > 0) {
          // 일부 지점의 상태가 없으면 없는 지점만 생성
          const branchesSnapshot = await getDocs(collection(db, 'branches'));
          const branchesMap = new Map(branchesSnapshot.docs.map(d => [d.id, d.data()]));
          const selectedEmployee = employeesList.find(emp => emp.id === selectedEmployeeId);
          
          for (const branchId of employeeBranchIds) {
            const fixedId = `${selectedEmployeeId}_${branchId}_${selectedMonth}`;
            const existingStatus = savedReviewStatuses.find(s => 
              s.employeeId === selectedEmployeeId && s.branchId === branchId
            );
            
            // 상태가 없으면 "검토전"으로 insert
            if (!existingStatus) {
              const branchData = branchesMap.get(branchId);
              const branchName = branchData?.name || '';
              
              await setDoc(doc(db, 'employeeReviewStatus', fixedId), {
                employeeId: selectedEmployeeId,
                employeeName: selectedEmployee?.name || '알 수 없음',
                month: selectedMonth,
                branchId: branchId,
                branchName: branchName,
                status: '검토전',
                createdAt: new Date(),
                updatedAt: new Date()
              });
              
              console.log('✅ 검토전 상태 생성:', fixedId);
              
              // savedReviewStatuses에 추가
              savedReviewStatuses.push({
                employeeId: selectedEmployeeId,
                branchId: branchId,
                status: '검토전'
              });
            }
          }
        }
      }
      
      // 저장된 상태 반영
      setEmployeeReviewStatus(savedReviewStatuses);
      console.log('최종 검토 상태 설정됨:', savedReviewStatuses);
    } catch (error) {
      console.error('검토 상태 로드 실패:', error);
    }
  }, [selectedMonth, selectedEmployeeId]);

  // 직원 목록이 로드되면 검토 상태 로드 (직원 변경 시에만, 지점 변경 시에는 호출하지 않음)
  // 🔥 selectedEmployeeId가 없어도 월별 상태를 먼저 로드해야 함
  // 🔥 selectedEmployeeId가 변경될 때마다 상태 다시 로드 (새로고침 시 상태 유지)
  useEffect(() => {
    if (employees.length > 0 && selectedMonth) {
      loadReviewStatus(employees);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, selectedMonth, selectedEmployeeId]);
  
  // 🔥 월이 변경될 때도 상태 다시 로드
  useEffect(() => {
    if (selectedMonth && employees.length > 0) {
      loadReviewStatus(employees);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const loadSchedules = async (month: string) => {
    console.log('🔥🔥🔥 loadSchedules 함수 호출됨, 월:', month);
    try {
      setLoading(true);
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

      const querySnapshot = await getDocs(collection(db, 'schedules'));
      const schedulesData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const totalHours = computeScheduleHours(data);
        if (totalHours === 0 && data.startTime && data.endTime) {
          console.warn('⚠️ 스케줄 totalHours가 0:', {
            id: doc.id,
            date: data.date,
            startTime: data.startTime,
            endTime: data.endTime,
            breakTime: data.breakTime,
            totalHours: data.totalHours
          });
        }
        return {
          id: doc.id,
          employeeId: data.employeeId,
          employeeName: data.employeeName,
          branchId: data.branchId,
          branchName: data.branchName,
          date: toLocalDate(data.date),
          startTime: data.startTime,
          endTime: data.endTime,
          breakTime: data.breakTime,
          totalHours,
          createdAt: toLocalDate(data.createdAt),
          updatedAt: toLocalDate(data.updatedAt)
        };
      });

      // 선택된 월의 스케줄만 필터링 (날짜만 비교)
      let filteredSchedules = schedulesData.filter(schedule => {
        const d = new Date(schedule.date.getFullYear(), schedule.date.getMonth(), schedule.date.getDate());
        return d >= new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()) &&
               d <= new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      });

      // 선택된 지점으로 필터링
      if (selectedBranchId) {
        filteredSchedules = filteredSchedules.filter(schedule => schedule.branchId === selectedBranchId);
      } else if (isManager && userBranch) {
        // 매니저 권한이 있으면 해당 지점만 필터링
        filteredSchedules = filteredSchedules.filter(schedule => schedule.branchId === userBranch.id);
      }

      // 선택된 직원으로 필터링
      if (selectedEmployeeId) {
        filteredSchedules = filteredSchedules.filter(schedule => schedule.employeeId === selectedEmployeeId);
      }

      console.log('🔥 스케줄 로딩 완료:', {
        전체스케줄: schedulesData.length,
        월필터링후: schedulesData.filter(schedule => {
          const d = new Date(schedule.date.getFullYear(), schedule.date.getMonth(), schedule.date.getDate());
          return d >= new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()) &&
                 d <= new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        }).length,
        지점필터링후: filteredSchedules.length,
        선택된직원: selectedEmployeeId,
        선택된지점: selectedBranchId
      });
      
      // 필터링된 스케줄 데이터 상세 로그
      console.log('🔥 필터링된 스케줄 상세:', filteredSchedules.map(s => ({
        employeeId: s.employeeId,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        breakTime: s.breakTime,
        totalHours: s.totalHours
      })));
      
      setSchedules(filteredSchedules);
    } catch (error) {
      console.error('스케줄 로드 중 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseActualWorkData = (data: string): ActualWorkRecord[] => {
    const lines = data.trim().split('\n');
    const records: ActualWorkRecord[] = [];

    console.log('🔥🔥🔥 실제근무 데이터 파싱 시작, 총 라인 수:', lines.length);

    lines.forEach((line, index) => {
      if (line.trim()) {
        // 🔥 탭 또는 여러 개의 공백으로 분리
        let columns = line.split('\t');
        
        // 탭으로 분리되지 않으면 (columns.length === 1) 공백으로 시도
        if (columns.length === 1) {
          // 3개 이상의 연속된 공백을 구분자로 사용
          columns = line.split(/\s{3,}/).filter(col => col.trim());
        }
        
        console.log(`🔥 라인 ${index + 1}:`, columns);
        console.log(`🔥 컬럼 개수: ${columns.length}`);
        
        if (columns.length >= 8) {
          // 🔥 두 가지 POS 데이터 형식 지원:
          // 1. 기존: 첫 번째 날짜는 무시, 두 번째가 시작일시, 세 번째가 종료일시
          // 2. 새로운: 근무일, 무시, 무시, 출근시간, 퇴근시간, 무시, 무시, 실근무시간
          
          let date = '';
          let startTime = '';
          let endTime = '';
          let totalTimeStr = '';
          let totalHours = 0;
          
          // 🔥 새로운 형식 감지: 
          // - 첫 번째 컬럼이 날짜 형식 (YYYY-MM-DD)이고
          // - 두 번째 컬럼이 날짜+시간이 아닌 경우 (새로운 형식)
          const firstCol = columns[0].trim();
          const secondCol = columns[1]?.trim() || '';
          const isNewFormat = /^\d{4}-\d{2}-\d{2}$/.test(firstCol) && 
                              !secondCol.includes(':'); // 두 번째 컬럼에 시간 포함 안 되면 새 형식
          console.log(`🔥 형식 감지: firstCol="${firstCol}", secondCol="${secondCol}", isNewFormat=${isNewFormat}`);
          
          if (isNewFormat) {
            // 🔥 새로운 형식: 근무일, 무시, 무시, 출근시간, 퇴근시간, 무시, 무시, 실근무시간
            date = firstCol; // "2025-09-01"
            const startTimeRaw = columns[3]?.trim() || ''; // 출근시간 "11:00"
            const endTimeRaw = columns[4]?.trim() || ''; // 퇴근시간 "15:00"
            const actualWorkTimeRaw = columns[7]?.trim() || ''; // 실근무시간 "4"
            
            // 🔥 출근/퇴근 시간이 없으면 이 라인은 건너뛰기
            if (!startTimeRaw || !endTimeRaw) {
              return; // 이 라인 무시
            }
            
            // 날짜에 시간 추가하여 전체 일시 형식으로 변환
            startTime = `${date} ${startTimeRaw}:00`;
            endTime = `${date} ${endTimeRaw}:00`;
            
            // 🔥 실근무시간을 그대로 사용 (휴게시간 차감 X)
            if (actualWorkTimeRaw) {
              const numericValue = parseFloat(actualWorkTimeRaw);
              if (!isNaN(numericValue)) {
                totalHours = numericValue;
              }
            }
          } else {
            // 🔥 기존 POS 형식: 무시, 근무시작일시, 근무종료일시, ..., 실제근무시간(7번째)
            startTime = columns[1]?.trim() || ''; // "2025-09-30 15:17:27"
            endTime = columns[2]?.trim() || ''; // "2025-09-30 22:59:24"
            
            // 시작일시에서 날짜 추출 (YYYY-MM-DD 형식)
            if (startTime) {
              date = startTime.split(' ')[0]; // "2025-09-30"
            }
            
            // 🔥 7번째 컬럼(인덱스 6)에서 실제근무시간 가져오기 "7:42" 형식 (최우선)
            if (columns.length > 6) {
              const col7 = columns[6]?.trim() || '';
              console.log(`🔥 7번째 컬럼(인덱스 6): "${col7}"`);
              // HH:MM 형식 체크 (0:00이 아닌 경우만)
              if (col7.includes(':') && col7.match(/^\d+:\d+$/) && col7 !== '0:00') {
                totalTimeStr = col7;
                console.log(`🔥 7번째 컬럼에서 시간 찾음: ${totalTimeStr}`);
              }
            }
            
            // 7번째 컬럼에서 못 찾으면 다른 컬럼에서 시간 형식 찾기
            if (!totalTimeStr) {
              // 먼저 4-5번째 컬럼 체크 (일부 POS는 여기에 시간이 있을 수 있음)
              for (let i = 4; i <= 5; i++) {
                const colValue = columns[i]?.trim() || '';
                if (colValue.includes(':') && colValue.match(/^\d+:\d+$/) && colValue !== '0:00') {
                  totalTimeStr = colValue;
                  console.log(`🔥 ${i+1}번째 컬럼에서 시간 찾음: ${totalTimeStr}`);
                  break;
                }
              }
            }
            
            // 그래도 못 찾으면 8-12번째 컬럼에서 찾기
            if (!totalTimeStr) {
              for (let i = 7; i < Math.min(columns.length, 12); i++) {
                const colValue = columns[i]?.trim() || '';
                if (colValue.includes(':') && colValue.match(/^\d+:\d+$/) && colValue !== '0:00') {
                  totalTimeStr = colValue;
                  console.log(`🔥 ${i+1}번째 컬럼에서 시간 찾음: ${totalTimeStr}`);
                  break;
                }
              }
            }
          }
          
          // 🔥 새로운 형식이 아닐 때만 기존 시간 파싱 로직 실행
          if (!isNewFormat) {
            // 시간을 찾지 못한 경우 시작/종료 시간으로 계산
            if (!totalTimeStr) {
              try {
                const start = new Date(startTime);
                const end = new Date(endTime);
                const diffMs = end.getTime() - start.getTime();
                totalHours = diffMs / (1000 * 60 * 60); // 시간 단위로 변환
                // console.log(`시간 계산: ${startTime} ~ ${endTime} = ${totalHours}시간`);
              } catch (error) {
                console.error('시간 계산 오류:', error);
              }
            }
          }

          // console.log(`전체 컬럼 정보:`, columns.map((col, idx) => `${idx}: "${col}"`));
          // console.log(`파싱된 데이터: 날짜=${date}, 시작=${startTime}, 종료=${endTime}, 총시간=${totalTimeStr}`);

          // 🔥 기존 형식일 때만 시간 문자열을 파싱
          if (!isNewFormat && totalTimeStr) {
            try {
              console.log(`🔥 시간 문자열 파싱: "${totalTimeStr}"`);
              
              // 여러 가지 시간 형식 시도
              if (totalTimeStr.includes(':')) {
                const timeParts = totalTimeStr.split(':');
                console.log(`🔥 시간 파싱: ${totalTimeStr} -> parts:`, timeParts);
                
                if (timeParts.length === 2) {
                  const hours = parseInt(timeParts[0], 10);
                  const minutes = parseInt(timeParts[1], 10);
                  console.log(`🔥 시간 변환: hours=${hours}, minutes=${minutes}`);
                  
                  if (!isNaN(hours) && !isNaN(minutes)) {
                    totalHours = hours + (minutes / 60);
                    console.log(`🔥 최종 계산: ${hours} + (${minutes}/60) = ${totalHours}`);
                  } else {
                    console.error('시간 파싱 실패: hours 또는 minutes가 NaN', { hours, minutes });
                  }
                } else {
                  console.error('시간 형식 오류: 콜론이 1개가 아님', timeParts);
                }
              } else {
                // 콜론이 없는 경우 숫자로만 파싱 시도
                const numericValue = parseFloat(totalTimeStr);
                if (!isNaN(numericValue)) {
                  totalHours = numericValue;
                  // console.log(`숫자로 파싱: ${totalTimeStr} -> ${totalHours}`);
                } else {
                  console.error('시간 파싱 실패: 숫자도 아니고 시간 형식도 아님', totalTimeStr);
                }
              }
            } catch (error) {
              console.error('시간 파싱 오류:', error, '원본 데이터:', totalTimeStr);
            }
          }

          // posTimeRange 생성 (시간만 추출: "10:02-22:32" 형태)
          let posTimeRange = '';
          if (startTime && endTime) {
            try {
              const startTimeOnly = startTime.split(' ')[1]?.split(':').slice(0, 2).join(':') || '';
              const endTimeOnly = endTime.split(' ')[1]?.split(':').slice(0, 2).join(':') || '';
              if (startTimeOnly && endTimeOnly) {
                posTimeRange = `${startTimeOnly}-${endTimeOnly}`;
              }
            } catch (error) {
              console.error('posTimeRange 생성 오류:', error);
            }
          }

          records.push({
            date,
            startTime,
            endTime,
            totalHours,
            isNewFormat: isNewFormat, // 새로운 형식 여부 저장
            posTimeRange: posTimeRange // POS 원본 시간 범위
          });
        } else {
          // console.log(`라인 ${index + 1} 컬럼 수 부족:`, columns.length);
        }
      }
    });

    // 🔥 같은 날짜의 레코드들을 합치기
    const recordsByDate = new Map<string, ActualWorkRecord[]>();
    
    records.forEach(record => {
      if (!recordsByDate.has(record.date)) {
        recordsByDate.set(record.date, []);
      }
      recordsByDate.get(record.date)!.push(record);
    });
    
    // 각 날짜별로 레코드 합치기
    const mergedRecords: ActualWorkRecord[] = [];
    
    recordsByDate.forEach((dayRecords, date) => {
      if (dayRecords.length === 1) {
        // 레코드가 1개면 그대로 사용
        mergedRecords.push(dayRecords[0]);
      } else {
        // 레코드가 여러 개면 시간순으로 정렬
        dayRecords.sort((a, b) => {
          const timeA = new Date(a.startTime).getTime();
          const timeB = new Date(b.startTime).getTime();
          return timeA - timeB;
        });
        
        // 첫 시작 시간과 마지막 종료 시간
        const firstStart = dayRecords[0].startTime;
        const lastEnd = dayRecords[dayRecords.length - 1].endTime;
        
        // 각 레코드 사이의 간격을 계산하여 휴게시간으로 사용
        let breakTimeMinutes = 0;
        for (let i = 0; i < dayRecords.length - 1; i++) {
          const currentEnd = new Date(dayRecords[i].endTime);
          const nextStart = new Date(dayRecords[i + 1].startTime);
          const breakMs = nextStart.getTime() - currentEnd.getTime();
          breakTimeMinutes += breakMs / (1000 * 60); // 분 단위로 변환
        }
        
        // 전체 시간 범위 계산
        const totalStart = new Date(firstStart);
        const totalEnd = new Date(lastEnd);
        const totalMs = totalEnd.getTime() - totalStart.getTime();
        // 🔥 부동소수점 오차 방지: 계산 후 반올림 (소수점 4자리까지)
        const totalHoursFromRange = Math.round((totalMs / (1000 * 60 * 60)) * 10000) / 10000;
        
        // posTimeRange 생성 (첫 시작 ~ 마지막 종료)
        let posTimeRange = '';
        try {
          const startTimeOnly = firstStart.split(' ')[1]?.split(':').slice(0, 2).join(':') || '';
          const endTimeOnly = lastEnd.split(' ')[1]?.split(':').slice(0, 2).join(':') || '';
          if (startTimeOnly && endTimeOnly) {
            posTimeRange = `${startTimeOnly}-${endTimeOnly}`;
          }
        } catch (error) {
          console.error('posTimeRange 생성 오류:', error);
        }
        
        // 합쳐진 레코드 생성
        mergedRecords.push({
          date,
          startTime: firstStart,
          endTime: lastEnd,
          totalHours: totalHoursFromRange, // 합쳐진 범위에서 계산
          isNewFormat: dayRecords[0].isNewFormat,
          posTimeRange: posTimeRange,
          // 🔥 여러 건이 있어서 휴게시간이 계산된 경우를 표시
          calculatedBreakTime: breakTimeMinutes / 60, // 시간 단위로 변환
          isMultipleRecords: true
        });
      }
    });
    
    console.log('🔥 같은 날짜 레코드 합치기 완료:', {
      원본레코드수: records.length,
      합쳐진레코드수: mergedRecords.length
    });
    
    return mergedRecords;
  };

  async function compareWorkTimes() {
    console.log('🔥🔥🔥 compareWorkTimes 함수 호출됨');
    console.log('🔥🔥🔥 선택된 지점:', selectedBranchId);
    console.log('🔥🔥🔥 선택된 월:', selectedMonth);
    console.log('🔥🔥🔥 선택된 직원:', selectedEmployeeId);
    console.log('🔥🔥🔥 실제근무 데이터 길이:', actualWorkData.length);
    console.log('🔥🔥🔥 스케줄 개수:', schedules.length);

    // 필수 항목 검증
    if (!selectedBranchId) {
      alert('지점을 선택해주세요.');
      return;
    }

    if (!selectedMonth) {
      alert('월을 선택해주세요.');
      return;
    }

    if (!selectedEmployeeId) {
      alert('직원을 선택해주세요.');
      return;
    }

    // 기존 비교 데이터가 있는 경우 확인 메시지 표시
    if (comparisonResults.length > 0) {
      const confirmed = confirm('기존 근무시간비교 데이터가 삭제됩니다.\n계속하시겠습니까?');
      if (!confirmed) {
        return;
      }
    }

    // 스케줄 데이터가 없으면 먼저 로드
    if (schedules.length === 0) {
      console.log('🔥🔥🔥 스케줄 데이터가 없어서 로드 시작');
      await loadSchedules(selectedMonth);
    }

    // 근무시간 비교 시작 시 자동으로 검토중 상태로 변경
    try {
      console.log('🔄 근무시간 비교 시작 - 검토중 상태로 변경');
      await saveReviewStatus(selectedEmployeeId, '검토중', selectedBranchId);
      await loadReviewStatus(employees);
    } catch (error) {
      console.error('❌ 검토중 상태 변경 실패:', error);
    }

    if (!actualWorkData.trim()) {
      // 실제근무 데이터가 없어도 스케줄 데이터만으로 리스트 표시
      console.log('🔥 실제근무 데이터 없음, 스케줄 데이터만으로 리스트 생성');
      console.log('🔥 전체 스케줄 수:', schedules.length);
      console.log('🔥 선택된 직원 ID:', selectedEmployeeId);
      console.log('🔥 필터링된 스케줄:', schedules.filter(schedule => schedule.employeeId === selectedEmployeeId));
      
      const scheduleOnlyComparisons: WorkTimeComparison[] = [];
      
      const branchGroups = schedules
        .filter(schedule => schedule.employeeId === selectedEmployeeId)
        .reduce((acc, schedule) => {
          const branchId = schedule.branchId || 'N/A';
          const branchName = schedule.branchName || '합산';
          if (!acc[branchId]) {
            acc[branchId] = {
              branchId,
              branchName,
              schedules: []
            };
          }
          acc[branchId].schedules.push(schedule);
          return acc;
        }, {} as Record<string, { branchId: string; branchName: string; schedules: any[] }>);

      console.log('🔥 지점별 그룹화 결과:', Object.keys(branchGroups).map(branchId => ({
        branchId,
        branchName: branchGroups[branchId].branchName,
        scheduleCount: branchGroups[branchId].schedules.length
      })));
      
      // 각 지점별로 비교 결과 생성 (자동 행)
      Object.values(branchGroups).forEach(({ branchId, branchName, schedules: branchSchedules }) => {
        branchSchedules.forEach(schedule => {
          const scheduleDate = toLocalDateString(schedule.date);
          const breakTime = parseFloat(schedule.breakTime) || 0;
          const actualBreakTime = breakTime; // 최초 스케줄 휴게시간으로 설정
          
          // 🔥 스케줄 시간 계산: totalHours가 0이거나 없으면 computeScheduleHours로 재계산
          let scheduledHours = Number(schedule.totalHours) || 0;
          if (scheduledHours === 0) {
            scheduledHours = computeScheduleHours(schedule);
            console.log(`✅ 스케줄 시간 재계산: ${scheduleDate}, ${scheduledHours}시간 (원본: ${schedule.totalHours})`);
          }
          
          // scheduledTimeRange 생성
          let scheduledTimeRange = '-';
          if (schedule.startTime && schedule.endTime) {
            let startTimeOnly = schedule.startTime;
            let endTimeOnly = schedule.endTime;
            // 날짜+시간 형식이면 시간만 추출
            if (startTimeOnly.includes(' ')) {
              startTimeOnly = startTimeOnly.split(' ')[1]?.split(':').slice(0, 2).join(':') || startTimeOnly;
            }
            if (endTimeOnly.includes(' ')) {
              endTimeOnly = endTimeOnly.split(' ')[1]?.split(':').slice(0, 2).join(':') || endTimeOnly;
            }
            // "14" 같은 형식이면 "14:00"으로 변환
            if (!startTimeOnly.includes(':')) {
              startTimeOnly = `${startTimeOnly.padStart(2, '0')}:00`;
            }
            if (!endTimeOnly.includes(':')) {
              endTimeOnly = `${endTimeOnly.padStart(2, '0')}:00`;
            }
            scheduledTimeRange = `${startTimeOnly}-${endTimeOnly}`;
          }
          
          scheduleOnlyComparisons.push({
            employeeName: formatEmployeeNameWithBranch(schedule.employeeName, branchName),
            date: scheduleDate,
            scheduledHours: scheduledHours,
            actualHours: 0, // 실제근무 데이터 없음
            difference: -scheduledHours, // 스케줄 시간만큼 마이너스
            status: 'review_required',
            scheduledTimeRange: scheduledTimeRange,
            actualTimeRange: '데이터 없음',
            isModified: false,
            breakTime: breakTime,
            actualBreakTime: actualBreakTime, // 스케줄 휴게시간으로 설정
            actualWorkHours: 0,
            branchId: schedule.branchId,
            branchName,
            isManual: false,
            isNew: false
          });
        });
      });

      const manualRecords = await loadManualRecords(selectedEmployeeId, selectedMonth, selectedBranchId);

      const mergedResults = [...scheduleOnlyComparisons, ...manualRecords]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setComparisonResults(mergedResults);
      
      // 스케줄만으로 생성된 비교결과도 DB에 저장 (수동 행 포함)
      await saveComparisonResults(mergedResults);
      return;
    }

    // 이미 비교결과가 있고 수정된 내용이 있는 경우 경고
    if (comparisonResults.length > 0) {
      const hasModifiedResults = comparisonResults.some(result => result.isModified);
      if (hasModifiedResults) {
        const confirmed = confirm('이미 수정한 근무시간 데이터가 있습니다.\n다시 비교하면 모든 수정내용이 초기화됩니다.\n계속하시겠습니까?');
        if (!confirmed) {
          return;
        }
      }
    }

    const actualRecords = parseActualWorkData(actualWorkData);
    // console.log('파싱된 실제근무 데이터:', actualRecords);

    const comparisons: WorkTimeComparison[] = [];
    // const processedDates = new Set<string>(); // 날짜 단위 중복 체크는 아래 uniqueMap에서 처리

    // 1. 스케줄이 있는 경우: 스케줄과 실제근무 데이터 비교 (선택된 직원만, 지점별로 분리)
    const branchGroups = schedules
      .filter(schedule => schedule.employeeId === selectedEmployeeId)
      .reduce((acc, schedule) => {
        const branchId = schedule.branchId || 'N/A';
        const branchName = schedule.branchName || '합산';
        if (!acc[branchId]) {
          acc[branchId] = {
            branchId,
            branchName,
            schedules: []
          };
        }
        acc[branchId].schedules.push(schedule);
        return acc;
      }, {} as Record<string, { branchId: string; branchName: string; schedules: any[] }>);

    console.log('🔥 실제근무 데이터가 있는 경우 지점별 그룹화 결과:', Object.keys(branchGroups).map(branchId => ({
      branchId,
      branchName: branchGroups[branchId].branchName,
      scheduleCount: branchGroups[branchId].schedules.length
    })));

    // 각 지점별로 비교 결과 생성
    Object.values(branchGroups).forEach(({ branchId, branchName, schedules: branchSchedules }) => {
      // 같은 날짜에 스케줄이 여러 건이면 1건으로 합치기 (시간범위는 콤마로 연결, 총근무/휴게시간 합산)
      const schedulesByDate = branchSchedules.reduce((acc: Record<string, any>, s: any) => {
        const d = toLocalDateString(s.date);
        if (!acc[d]) {
          acc[d] = {
            date: d,
            employeeName: s.employeeName,
            totalHours: 0,
            timeRanges: [] as string[],
            breakTimeSum: 0,
            originalSchedules: [] as any[] // 원본 스케줄 저장 (시간 계산용)
          };
        }
        acc[d].totalHours += Number(s.totalHours) || 0;
        // 시간만 추출해서 "HH:MM-HH:MM" 형식으로 저장
        if (s.startTime && s.endTime) {
          let startTimeOnly = s.startTime;
          let endTimeOnly = s.endTime;
          // 날짜+시간 형식이면 시간만 추출
          if (startTimeOnly.includes(' ')) {
            startTimeOnly = startTimeOnly.split(' ')[1]?.split(':').slice(0, 2).join(':') || startTimeOnly;
          }
          if (endTimeOnly.includes(' ')) {
            endTimeOnly = endTimeOnly.split(' ')[1]?.split(':').slice(0, 2).join(':') || endTimeOnly;
          }
          // "14" 같은 형식이면 "14:00"으로 변환
          if (!startTimeOnly.includes(':')) {
            startTimeOnly = `${startTimeOnly.padStart(2, '0')}:00`;
          }
          if (!endTimeOnly.includes(':')) {
            endTimeOnly = `${endTimeOnly.padStart(2, '0')}:00`;
          }
          acc[d].timeRanges.push(`${startTimeOnly}-${endTimeOnly}`);
        }
        acc[d].breakTimeSum += parseFloat(s.breakTime) || 0;
        acc[d].originalSchedules.push(s); // 원본 스케줄 저장
        return acc;
      }, {} as Record<string, any>);

      Object.values(schedulesByDate).forEach((day: any) => {
        const scheduleDate = day.date;
        const actualRecord = actualRecords.find(record => record.date === scheduleDate);

        console.log(`스케줄(합침): ${day.employeeName} ${scheduleDate} (${branchName})`, day);
        console.log(`실제근무 데이터 찾기:`, actualRecord);

        // 스케줄 총시간 계산: 원본 스케줄로 직접 계산 (POS 데이터 있든 없든 동일하게)
        let scheduledTotalHours = 0;
        console.log(`🔥🔥🔥 스케줄 시간 계산 시작: ${scheduleDate}, originalSchedules 개수: ${day.originalSchedules?.length || 0}`);
        if (day.originalSchedules && day.originalSchedules.length > 0) {
          try {
            // 원본 스케줄들의 시간을 합산
            for (const origSchedule of day.originalSchedules) {
              console.log(`🔥 원본 스케줄 데이터:`, {
                startTime: origSchedule.startTime,
                endTime: origSchedule.endTime,
                breakTime: origSchedule.breakTime,
                totalHours: origSchedule.totalHours,
                timeRanges: origSchedule.timeRanges
              });
              const hours = computeScheduleHours(origSchedule);
              console.log(`🔥 계산된 시간: ${hours}시간`);
              if (hours === 0) {
                console.error('❌❌❌ 스케줄 시간 계산 결과가 0입니다!', {
                  scheduleDate,
                  startTime: origSchedule.startTime,
                  endTime: origSchedule.endTime,
                  breakTime: origSchedule.breakTime,
                  totalHours: origSchedule.totalHours
                });
              }
              scheduledTotalHours += hours;
            }
            console.log(`🔥🔥🔥 스케줄 총시간 계산 완료: ${scheduleDate}, ${scheduledTotalHours}시간 (원본 스케줄 ${day.originalSchedules.length}개)`);
            
            // 계산 결과가 0이면 timeRanges로 재시도
            if (scheduledTotalHours === 0 && day.timeRanges && day.timeRanges.length > 0) {
              console.warn('⚠️ scheduledTotalHours가 0이어서 timeRanges로 재시도:', day.timeRanges);
              try {
                const timeRangesHours = computeScheduleHours({ timeRanges: day.timeRanges.join(',') });
                if (timeRangesHours > 0) {
                  scheduledTotalHours = timeRangesHours;
                  console.log(`✅ timeRanges 기준 계산 성공: ${scheduleDate}, ${scheduledTotalHours}시간`);
                }
              } catch (e2) {
                console.error('❌ timeRanges 기준 계산도 실패:', e2);
              }
            }
          } catch (e) {
            console.error('❌ 스케줄 총시간 계산 실패:', e, day);
            // 재계산 실패 시 기존 합산값 사용
            scheduledTotalHours = Number(day.totalHours) || 0;
            console.log(`🔥 day.totalHours 사용: ${scheduledTotalHours}시간`);
            // 그래도 안 되면 timeRanges로 시도
            if (!scheduledTotalHours && day.timeRanges && day.timeRanges.length > 0) {
              try {
                scheduledTotalHours = computeScheduleHours({ timeRanges: day.timeRanges.join(',') });
                console.log(`🔥 timeRanges 기준 계산: ${scheduleDate}, ${scheduledTotalHours}시간`);
              } catch (e2) {
                console.error('❌ timeRanges 기준 계산도 실패:', e2);
              }
            }
          }
        } else {
          // 원본 스케줄이 없으면 기존 합산값 사용
          scheduledTotalHours = Number(day.totalHours) || 0;
          console.log(`🔥 원본 스케줄 없음, day.totalHours 사용: ${scheduledTotalHours}시간`);
        }
        console.log(`🔥🔥🔥 최종 scheduledTotalHours: ${scheduleDate} = ${scheduledTotalHours}시간`);

        // 🔥 scheduledTimeRange 생성: timeRanges가 비어있으면 원본 스케줄에서 다시 생성
        let finalScheduledTimeRange = day.timeRanges.length > 0 ? day.timeRanges.join(',') : '-';
        if (finalScheduledTimeRange === '-' && day.originalSchedules && day.originalSchedules.length > 0) {
          const timeRangesFromOriginal: string[] = [];
          for (const origSchedule of day.originalSchedules) {
            if (origSchedule.startTime && origSchedule.endTime) {
              let startTimeOnly = origSchedule.startTime;
              let endTimeOnly = origSchedule.endTime;
              // 날짜+시간 형식이면 시간만 추출
              if (startTimeOnly.includes(' ')) {
                startTimeOnly = startTimeOnly.split(' ')[1]?.split(':').slice(0, 2).join(':') || startTimeOnly;
              }
              if (endTimeOnly.includes(' ')) {
                endTimeOnly = endTimeOnly.split(' ')[1]?.split(':').slice(0, 2).join(':') || endTimeOnly;
              }
              // "14" 같은 형식이면 "14:00"으로 변환
              if (!startTimeOnly.includes(':')) {
                startTimeOnly = `${startTimeOnly.padStart(2, '0')}:00`;
              }
              if (!endTimeOnly.includes(':')) {
                endTimeOnly = `${endTimeOnly.padStart(2, '0')}:00`;
              }
              const breakTimeStr = origSchedule.breakTime ? `(${origSchedule.breakTime})` : '';
              timeRangesFromOriginal.push(`${startTimeOnly}-${endTimeOnly}${breakTimeStr}`);
            }
          }
          if (timeRangesFromOriginal.length > 0) {
            finalScheduledTimeRange = timeRangesFromOriginal.join(',');
            console.log(`✅ scheduledTimeRange 복구: ${scheduleDate}, ${finalScheduledTimeRange}`);
          }
        }

        if (actualRecord) {
          // 휴게시간과 실근무시간 계산
          const breakTime = day.breakTimeSum || 0; // 합쳐진 스케줄 휴게시간 합
          // 🔥 POS 데이터가 여러 건이어서 휴게시간이 계산된 경우, 그것을 사용
          // 그렇지 않으면 스케줄 휴게시간 사용
          const actualBreakTime = actualRecord.calculatedBreakTime !== undefined 
            ? actualRecord.calculatedBreakTime 
            : breakTime;
          console.log(`🔥 스케줄과 실제근무 매칭: ${scheduleDate}, breakTime: ${breakTime}, actualBreakTime: ${actualBreakTime}, isMultipleRecords: ${actualRecord.isMultipleRecords}`);
          
          // 🔥 새로운 계산 방식: actualWorkHours = actualTimeRange시간 - actualBreakTime
          const actualTimeRange = actualRecord.posTimeRange || formatTimeRange(actualRecord.startTime, actualRecord.endTime);
          const actualTimeRangeHours = parseTimeRangeToHours(actualTimeRange);
          // 🔥 부동소수점 오차 방지: 계산 후 반올림 (소수점 4자리까지)
          const actualWorkHours = Math.round((Math.max(0, actualTimeRangeHours - actualBreakTime)) * 10000) / 10000;
          
          // 🔥 scheduledTotalHours가 0이면 재계산 시도
          if (scheduledTotalHours === 0 && day.originalSchedules && day.originalSchedules.length > 0) {
            console.warn(`⚠️ scheduledTotalHours가 0입니다. 재계산 시도: ${scheduleDate}`);
            let recalculatedHours = 0;
            for (const origSchedule of day.originalSchedules) {
              const hours = computeScheduleHours(origSchedule);
              recalculatedHours += hours;
            }
            if (recalculatedHours > 0) {
              scheduledTotalHours = recalculatedHours;
              console.log(`✅ scheduledTotalHours 재계산 성공: ${scheduleDate}, ${scheduledTotalHours}시간`);
            }
          }
          
          // 차이 계산: 실제순근무시간 - 스케줄시간 (많이 하면 +, 적게 하면 -)
          const difference = actualWorkHours - scheduledTotalHours;
          let status: 'time_match' | 'review_required' | 'review_completed' = 'time_match';
          
          // 10분(0.17시간) 이상 차이나면 확인필요, 이내면 시간일치
          if (Math.abs(difference) >= 0.17) {
            status = 'review_required';
          } else {
            status = 'time_match';
          }
          
          comparisons.push({
            employeeName: formatEmployeeNameWithBranch(day.employeeName, branchName),
            date: scheduleDate,
            scheduledHours: scheduledTotalHours,
            actualHours: actualRecord.totalHours,
            difference,
            status,
            scheduledTimeRange: finalScheduledTimeRange,
            actualTimeRange: actualRecord.posTimeRange || formatTimeRange(actualRecord.startTime, actualRecord.endTime),
            // POS 근무시각 컬럼 표시용 (파싱된 원본 시간 유지)
            posTimeRange: actualRecord.posTimeRange || '',
            isModified: false,
            breakTime: breakTime,
            actualBreakTime: actualBreakTime, // 계산된 actualBreakTime 사용
            actualWorkHours: actualWorkHours,
            branchId: day.branchId,
            branchName,
            isManual: false
          });
        // 동일 날짜 중복 처리는 아래 uniqueMap 단계에서 수행하므로,
        // 여기서는 날짜를 별도 Set에 기록하지 않는다.
      } else {
        // 스케줄은 있지만 실제근무 데이터가 없는 경우
        // 🔥 scheduledTotalHours가 0이면 재계산 시도
        if (scheduledTotalHours === 0 && day.originalSchedules && day.originalSchedules.length > 0) {
          console.warn(`⚠️ scheduledTotalHours가 0입니다. 재계산 시도: ${scheduleDate}`);
          let recalculatedHours = 0;
          for (const origSchedule of day.originalSchedules) {
            const hours = computeScheduleHours(origSchedule);
            recalculatedHours += hours;
          }
          if (recalculatedHours > 0) {
            scheduledTotalHours = recalculatedHours;
            console.log(`✅ scheduledTotalHours 재계산 성공: ${scheduleDate}, ${scheduledTotalHours}시간`);
          }
        }
        
        // 휴게시간과 실근무시간 계산 (실제근무 데이터가 없는 경우)
        const breakTime = day.breakTimeSum || 0;
        const actualBreakTime = breakTime; // 최초 스케줄 휴게시간 가져오기
        console.log(`🔥 스케줄만 있음: ${scheduleDate} (${branchName}), breakTime: ${breakTime}, actualBreakTime: ${actualBreakTime}`);
        const actualWorkHours = 0; // 실제근무 데이터가 없으므로 0
        
        comparisons.push({
          employeeName: formatEmployeeNameWithBranch(day.employeeName, branchName),
          date: scheduleDate,
          scheduledHours: scheduledTotalHours,
          actualHours: 0,
          difference: -scheduledTotalHours, // 계산된 scheduledTotalHours 사용
          status: 'review_required',
          scheduledTimeRange: finalScheduledTimeRange,
          actualTimeRange: '-',
          isModified: false,
          breakTime: breakTime,
          actualBreakTime: actualBreakTime, // 계산된 actualBreakTime 사용
          actualWorkHours: actualWorkHours,
          posTimeRange: '' // 실제근무 데이터가 없으므로 빈 값
        });
      }
      });
    });

    // 2. 실제근무 데이터는 있지만 스케줄이 없는 경우
    actualRecords.forEach(actualRecord => {
      // 선택된 직원의 이름을 사용 (실제근무 데이터에는 직원명이 없으므로)
      const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);
      const employeeName = selectedEmployee ? selectedEmployee.name : '알 수 없음';

      // 스케줄이 없는 경우 휴게시간은 0으로 가정하되, POS 데이터가 여러 건이면 계산된 휴게시간 사용
      const breakTime = 0; // 스케줄이 없으므로 휴게시간 정보 없음
      const actualBreakTime = actualRecord.calculatedBreakTime !== undefined 
        ? actualRecord.calculatedBreakTime 
        : 0; // POS 데이터가 여러 건이면 계산된 휴게시간, 아니면 0
      console.log(`🔥 실제근무만 있음: ${actualRecord.date}, breakTime: ${breakTime}, actualBreakTime: ${actualBreakTime}, isMultipleRecords: ${actualRecord.isMultipleRecords}`);
      // 🔥 새로운 계산 방식: actualWorkHours = actualTimeRange시간 - actualBreakTime
      const actualTimeRange = actualRecord.posTimeRange || formatTimeRange(actualRecord.startTime, actualRecord.endTime);
      const actualTimeRangeHours = parseTimeRangeToHours(actualTimeRange);
      // 🔥 부동소수점 오차 방지: 계산 후 반올림 (소수점 4자리까지)
      const actualWorkHours = Math.round((Math.max(0, actualTimeRangeHours - actualBreakTime)) * 10000) / 10000;
      
      comparisons.push({
        employeeName: formatEmployeeNameWithBranch(employeeName, branches.find(b => b.id === selectedBranchId)?.name),
        date: actualRecord.date,
        scheduledHours: 0,
        actualHours: actualRecord.totalHours,
        difference: actualRecord.totalHours,
        status: 'review_required', // 스케줄 없이 근무한 경우 검토필요
        scheduledTimeRange: '-',
        actualTimeRange: actualRecord.posTimeRange || formatTimeRange(actualRecord.startTime, actualRecord.endTime),
        isModified: false,
        breakTime: breakTime,
        actualBreakTime: actualBreakTime, // 계산된 actualBreakTime 사용
        actualWorkHours: actualWorkHours,
        posTimeRange: actualRecord.posTimeRange || '' // POS 원본 시간 범위
      });
    });

    // 중복 제거: 같은 직원/같은 지점/같은 날짜 키로 유일화
    const uniqueMap = new Map<string, WorkTimeComparison>();
    for (const comp of comparisons) {
      const branchSuffix = comp.employeeName.includes('(')
        ? comp.employeeName.substring(comp.employeeName.indexOf('('))
        : '';
      const key = `${comp.date}|${branchSuffix}`; // 날짜+지점 기준
      if (!uniqueMap.has(key)) uniqueMap.set(key, comp);
      else {
        // 만약 중복이 있다면, 실제근무시간/posTimeRange가 있는 항목을 우선
        const prev = uniqueMap.get(key)!;
        const pick = (comp.actualTimeRange && comp.actualTimeRange !== '-') ? comp : prev;
        uniqueMap.set(key, pick);
      }
    }
    const uniqueComparisons = Array.from(uniqueMap.values());
    
    // 날짜순으로 정렬
    uniqueComparisons.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    console.log('🔥 최종 비교 결과 (지점별 분리, 중복제거):', uniqueComparisons);
    setComparisonResults(uniqueComparisons);
    
    // 비교결과를 DB에 저장
    await saveComparisonResults(uniqueComparisons);
    
    // 연장근무시간 계산 (정직원인 경우만)
    if (selectedEmployeeId) {
      try {
        // 직원 정보 확인
        const employeeQuery = query(
          collection(db, 'employees'),
          where('__name__', '==', selectedEmployeeId)
        );
        const employeeSnapshot = await getDocs(employeeQuery);
        
        if (!employeeSnapshot.empty) {
          const employeeData = employeeSnapshot.docs[0].data();
          
          // 근로소득자인 경우에만 연장근무시간 계산
          if (employeeData.type === '근로소득자' || employeeData.employmentType === '근로소득') {
            // 이번주 총 실제 근무시간 계산 (지점별 분리된 결과에서)
            const totalActualHours = uniqueComparisons.reduce((sum, comp) => sum + comp.actualHours, 0);
            
            // 이번주 시작일 계산 (월요일)
            const currentDate = new Date(selectedMonth);
            const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const firstMonday = new Date(firstDay);
            const dayOfWeek = firstDay.getDay();
            const daysToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
            firstMonday.setDate(firstDay.getDate() + daysToMonday);
            
            // 연장근무시간 계산
            const accumulatedOvertime = await calculateOvertimeHours(selectedEmployeeId, firstMonday, totalActualHours);
            console.log('계산된 누적 연장근무시간:', accumulatedOvertime);
          }
        }
      } catch (error) {
        console.error('연장근무시간 계산 중 오류:', error);
      }
    }
    
    // 모든 비교 결과를 DB에 저장
    await saveAllComparisonResults(uniqueComparisons);
    
    // 🔥 근무시간비교 버튼 클릭 시 "검토중" 상태로 변경 (이미 버튼 클릭 시점에 변경됨)
    // 비교 완료 후에는 상태 변경하지 않음 - 사용자가 명시적으로 버튼을 클릭했을 때만 변경
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'time_match': return 'text-green-600 bg-green-50';
      case 'review_required': return 'text-orange-600 bg-orange-50';
      case 'review_completed': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // 비교 결과를 날짜순으로 정렬하는 함수
  const sortComparisonResults = (results: WorkTimeComparison[]) => {
    return [...results].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'time_match': return '시간일치';
      case 'review_required': return '확인필요';
      case 'review_completed': return '확인완료';
      default: return '알 수 없음';
    }
  };

  // 시간 범위 포맷 함수
  const formatTimeRange = (startTime: string, endTime: string) => {
    // "2025-09-11 19:00:10" -> "19:00"
    const start = startTime.split(' ')[1]?.substring(0, 5) || startTime.substring(0, 5);
    const end = endTime.split(' ')[1]?.substring(0, 5) || endTime.substring(0, 5);
    return `${start}-${end}`;
  };

  // 시간 범위 문자열을 시간으로 변환하는 함수 (예: "10:02-22:32" -> 12.5시간)
  const parseTimeRangeToHours = (timeRange: string): number => {
    if (!timeRange || timeRange === '-' || !timeRange.includes('-')) {
      return 0;
    }
    
    try {
      const [startTime, endTime] = timeRange.split('-');
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      
      // 다음날로 넘어가는 경우 처리 (예: 22:00-06:00)
      let diffMinutes = endMinutes - startMinutes;
      if (diffMinutes < 0) {
        diffMinutes += 24 * 60; // 24시간 추가
      }
      
      // 🔥 부동소수점 오차 방지: 분 단위로 계산 후 시간으로 변환 시 반올림
      // 예: 301분 = 5.016666... → 5.0167 (소수점 4자리 반올림)
      const hours = diffMinutes / 60;
      return Math.round(hours * 10000) / 10000; // 소수점 4자리까지 정확도 유지
    } catch (error) {
      console.error('시간 범위 파싱 오류:', error, 'timeRange:', timeRange);
      return 0;
    }
  };

  // 연장근무시간 계산 함수
  const calculateOvertimeHours = async (employeeId: string, currentWeekStart: Date, actualWorkHours: number) => {
    try {
      // 직원 정보에서 주간 근무시간 가져오기
      const employeeQuery = query(
        collection(db, 'employees'),
        where('__name__', '==', employeeId)
      );
      const employeeSnapshot = await getDocs(employeeQuery);
      
      if (employeeSnapshot.empty) {
        console.log('직원 정보를 찾을 수 없습니다:', employeeId);
        return 0;
      }
      
      const employeeData = employeeSnapshot.docs[0].data();
      const weeklyWorkHours = employeeData.weeklyWorkHours || 40; // 기본값 40시간
      
      // 직원의 고용형태 확인 (최신 근로계약서에서)
      const contractsQuery = query(
        collection(db, 'employmentContracts'),
        where('employeeId', '==', employeeId),
        orderBy('startDate', 'desc'),
        limit(1)
      );
      const contractsSnapshot = await getDocs(contractsQuery);
      
      let employmentType = '';
      if (!contractsSnapshot.empty) {
        const contractData = contractsSnapshot.docs[0].data();
        employmentType = contractData.employmentType || '';
      }
      
      console.log('직원 주간 근무시간:', weeklyWorkHours, '실제 근무시간:', actualWorkHours, '고용형태:', employmentType);
      
      // 전주 누적 연장근무시간 가져오기
      const previousWeekStart = new Date(currentWeekStart);
      previousWeekStart.setDate(previousWeekStart.getDate() - 7);
      
      const overtimeQuery = query(
        collection(db, 'overtimeRecords'),
        where('employeeId', '==', employeeId),
        where('weekStart', '==', previousWeekStart)
      );
      
      const overtimeSnapshot = await getDocs(overtimeQuery);
      let previousOvertime = 0;
      
      if (!overtimeSnapshot.empty) {
        previousOvertime = overtimeSnapshot.docs[0].data().accumulatedOvertime || 0;
      } else {
        // 전주 누적 연장근무시간이 없고, 아직 팝업을 보여주지 않았다면 팝업 표시
        // 단, 근로소득, 사업소득만 해당
        if (!hasShownOvertimePopup && (employmentType === '근로소득' || employmentType === '사업소득')) {
          setPendingOvertimeCalculation({
            employeeId: employeeId,
            currentWeekStart: currentWeekStart,
            actualWorkHours: actualWorkHours
          });
          setShowOvertimePopup(true);
          setHasShownOvertimePopup(true);
          return 0; // 팝업에서 입력받을 때까지 대기
        }
      }
      
      // 연장근무시간 계산: 전주 누적 + max(0, 실근무시간 - 주간근무시간)
      const currentWeekOvertime = Math.max(0, actualWorkHours - weeklyWorkHours);
      const newAccumulatedOvertime = previousOvertime + currentWeekOvertime;
      
      console.log('전주 누적 연장근무:', previousOvertime, '이번주 연장근무:', currentWeekOvertime, '새 누적:', newAccumulatedOvertime);
      
      // 이번주 연장근무시간 기록 저장
      const overtimeRecord = {
        employeeId: employeeId,
        weekStart: currentWeekStart,
        actualWorkHours: actualWorkHours,
        weeklyWorkHours: weeklyWorkHours,
        currentWeekOvertime: currentWeekOvertime,
        accumulatedOvertime: newAccumulatedOvertime,
        createdAt: new Date()
      };
      
      // 기존 기록이 있으면 업데이트, 없으면 새로 생성
      if (!overtimeSnapshot.empty) {
        await updateDoc(overtimeSnapshot.docs[0].ref, overtimeRecord);
      } else {
        await addDoc(collection(db, 'overtimeRecords'), overtimeRecord);
      }
      
      return newAccumulatedOvertime;
    } catch (error) {
      console.error('연장근무시간 계산 실패:', error);
      return 0;
    }
  };

  // 팝업에서 전월 이월 연장근무시간을 입력받은 후 계산을 완료하는 함수
  const completeOvertimeCalculation = async (inputOvertime: number) => {
    if (!pendingOvertimeCalculation) return;
    
    try {
      const { employeeId, currentWeekStart, actualWorkHours } = pendingOvertimeCalculation;
      
      // 직원 정보에서 주간 근무시간 가져오기
      const employeeQuery = query(
        collection(db, 'employees'),
        where('__name__', '==', employeeId)
      );
      const employeeSnapshot = await getDocs(employeeQuery);
      
      if (employeeSnapshot.empty) {
        console.log('직원 정보를 찾을 수 없습니다:', employeeId);
        return;
      }
      
      const employeeData = employeeSnapshot.docs[0].data();
      const weeklyWorkHours = employeeData.weeklyWorkHours || 40;
      
      // 연장근무시간 계산: 입력받은 전월 이월 + max(0, 실근무시간 - 주간근무시간)
      const currentWeekOvertime = Math.max(0, actualWorkHours - weeklyWorkHours);
      const newAccumulatedOvertime = inputOvertime + currentWeekOvertime;
      
      // 이번주 연장근무시간 기록 저장
      const overtimeRecord = {
        employeeId: employeeId,
        weekStart: currentWeekStart,
        actualWorkHours: actualWorkHours,
        weeklyWorkHours: weeklyWorkHours,
        currentWeekOvertime: currentWeekOvertime,
        accumulatedOvertime: newAccumulatedOvertime,
        createdAt: new Date()
      };
      
      await addDoc(collection(db, 'overtimeRecords'), overtimeRecord);
      
      console.log('전월 이월 연장근무시간 입력 완료:', inputOvertime, '새 누적:', newAccumulatedOvertime);
      
      // 팝업 상태 초기화
      setShowOvertimePopup(false);
      setOvertimeInput('');
      setPendingOvertimeCalculation(null);
      
    } catch (error) {
      console.error('연장근무시간 계산 완료 실패:', error);
    }
  };

  // 기존 비교 데이터를 불러오는 함수
  // 비교결과를 DB에 저장하는 함수 (저장된 결과 반환)
  const saveComparisonResults = async (results: WorkTimeComparison[]): Promise<WorkTimeComparison[]> => {
    if (!selectedEmployeeId || !selectedMonth) {
      console.log('저장 실패: 필수 정보 없음', { selectedEmployeeId, selectedMonth });
      return results;
    }
    // 🔒 급여확정 시 저장 차단
    if (payrollConfirmedEmployees.includes(selectedEmployeeId)) {
      console.warn('급여확정된 직원은 비교결과 저장이 차단됩니다.');
      return results;
    }
    
    try {
      console.log('비교결과 저장 시작:', results.length, '건');
      
      // 매니저의 경우 userBranch.id 사용, 일반 사용자의 경우 selectedBranchId 사용
      const branchId = isManager && userBranch ? userBranch.id : selectedBranchId;
      
      if (!branchId) {
        console.warn('branchId가 없어서 저장할 수 없음:', { isManager, userBranch, selectedBranchId });
        // branchId가 없어도 저장은 계속 진행 (기존 데이터와 일치하도록)
      }
      
      // 🔥 삭제 로직 제거: 화면에 보이는 상태 그대로 저장하도록 변경
      // 삭제는 사용자가 명시적으로 삭제 버튼을 눌렀을 때만 수행
      
      // 새 데이터 저장
      // 직원명 조회 (result.employeeName이 "직원"이면 DB에서 다시 조회)
      let employeeNameSnapshot: string | null = null;
      if (selectedEmployeeId) {
        try {
          const empDoc = await getDoc(doc(db, 'employees', selectedEmployeeId));
          if (empDoc.exists()) {
            employeeNameSnapshot = empDoc.data().name || '';
          }
        } catch {}
      }
      
      // 지점명 조회
      let branchNameSnapshot: string | null = null;
      if (branchId) {
        try {
          const bSnap = await getDocs(query(collection(db, 'branches'), where('__name__', '==', branchId)));
          branchNameSnapshot = bSnap.docs[0]?.data()?.name || '';
        } catch {}
      }
      
      for (const result of results) {
        // employeeName이 "직원"이면 DB에서 조회한 이름 사용, 아니면 result.employeeName 사용
        const fallbackEmployeeName = result.employeeName && result.employeeName !== '직원'
          ? result.employeeName
          : employeeNameSnapshot || employees.find(emp => emp.id === selectedEmployeeId)?.name || '알 수 없음';
        const fallbackBranchName = result.branchName || branchNameSnapshot || (result as any).branchName || branches.find(b => b.id === selectedBranchId)?.name || '';
        // 🔥 항상 현재 선택된 branchId를 사용 (다른 지점 데이터 덮어쓰기 방지)
        const effectiveBranchId = branchId || selectedBranchId || '';
        if (!effectiveBranchId) {
          console.warn('branchId가 없어서 저장을 건너뜁니다:', result);
          continue;
        }
        const finalEmployeeName = formatEmployeeNameWithBranch(fallbackEmployeeName, fallbackBranchName);
        const isManual = result.isManual === true || result.isNew === true;
        
        const comparisonPayload = {
          employeeId: selectedEmployeeId,
          employeeName: finalEmployeeName,
          month: selectedMonth,
          branchId: effectiveBranchId,
          branchName: fallbackBranchName,
          date: result.date,
          scheduledHours: result.scheduledHours,
          actualHours: result.actualHours,
          difference: result.difference,
          status: result.status,
          scheduledTimeRange: result.scheduledTimeRange,
          actualTimeRange: result.actualTimeRange,
          isModified: result.isModified || false,
          breakTime: result.breakTime || 0,
          actualBreakTime: result.actualBreakTime || 0,
          actualWorkHours: result.actualWorkHours || 0,
          posTimeRange: result.posTimeRange || '',
          isManual,
          updatedAt: new Date()
        };

        // 🔥 docId가 있으면 무조건 업데이트, 없을 때만 추가 (isManual 여부와 관계없이)
        if (result.docId) {
          // createdAt은 업데이트 시 유지 (기존 값 보존)
          await updateDoc(doc(db, 'workTimeComparisonResults', result.docId), comparisonPayload);
          console.log('✅ 기존 데이터 업데이트:', result.docId, '날짜:', result.date);
        } else {
          // 🔥 중복 체크: 같은 직원, 같은 날짜, 같은 근무시간인 기존 문서가 있는지 확인
          const workHours = (result.actualWorkHours ?? 0) > 0 ? (result.actualWorkHours ?? 0) : (result.scheduledHours ?? 0);
          const duplicateQuery = query(
            collection(db, 'workTimeComparisonResults'),
            where('employeeId', '==', selectedEmployeeId),
            where('date', '==', result.date),
            where('month', '==', selectedMonth)
          );
          
          const duplicateSnapshot = await getDocs(duplicateQuery);
          let existingDocId: string | null = null;
          
          // 같은 근무시간인 문서 찾기
          for (const dupDoc of duplicateSnapshot.docs) {
            const dupData = dupDoc.data();
            const dupWorkHours = (dupData.actualWorkHours ?? 0) > 0 ? (dupData.actualWorkHours ?? 0) : (dupData.scheduledHours ?? 0);
            
            // 근무시간이 같으면 중복으로 간주
            if (Math.abs(dupWorkHours - workHours) < 0.01) { // 소수점 오차 고려
              existingDocId = dupDoc.id;
              break;
            }
          }
          
          if (existingDocId) {
            // 중복 문서가 있으면 업데이트
            await updateDoc(doc(db, 'workTimeComparisonResults', existingDocId), comparisonPayload);
            result.docId = existingDocId;
            console.log('⚠️  중복 데이터 발견, 기존 문서 업데이트:', existingDocId, '날짜:', result.date, '근무시간:', workHours);
          } else {
            // 중복이 없으면 새로 추가
            const docRef = await addDoc(collection(db, 'workTimeComparisonResults'), {
              ...comparisonPayload,
              createdAt: new Date()
            });
            result.docId = docRef.id;
            console.log('✅ 새 데이터 추가, docId 설정:', result.docId, '날짜:', result.date, 'isManual:', isManual);
          }
        }
        
        // isManual 플래그 정리
        if (isManual) {
          result.isManual = true;
          result.isNew = false;
        }
      }
      
      console.log('비교결과 저장 완료');
      // 🔥 저장된 결과 반환 (docId가 설정된 상태)
      return results;
    } catch (error) {
      console.error('비교결과 저장 실패:', error);
      return results;
    }
  };

  // 🔥 branchId를 파라미터로 받는 버전 (지점 선택 시 즉시 로드용)
  const loadExistingComparisonDataForBranch = useCallback(async (branchIdParam?: string) => {
    if (!selectedEmployeeId || !selectedMonth) {
      setComparisonResults([]);
      return;
    }
    // 🔄 지점/직원/월이 바뀔 때 이전 지점의 비교결과가 잠시라도 남지 않도록 먼저 클리어
    setComparisonResults([]);
    // 🔒 급여확정 시: DB 로드는 허용하되 편집은 상위에서 차단됨
    
    try {
      console.log('기존 비교 데이터 로드 시작:', selectedEmployeeId, selectedMonth, 'branchId:', branchIdParam);
      
      // 매니저의 경우 userBranch.id 사용, 일반 사용자의 경우 파라미터 또는 selectedBranchId 사용
      const branchId = branchIdParam || (isManager && userBranch ? userBranch.id : selectedBranchId);
      
      const querySnapshot = await getDocs(
        query(
          collection(db, 'workTimeComparisonResults'),
          where('employeeId', '==', selectedEmployeeId),
          where('month', '==', selectedMonth),
          where('branchId', '==', branchId)
        )
      );
      
      // 🔧 데이터 정리: 특정 날짜(2025-10-27)의 posTimeRange 가 null/빈값인 잘못된 문서 삭제
      try {
        const cleanupTargets = querySnapshot.docs.filter(d => {
          const data = d.data();
          return data.date === '2025-10-27' && (!data.posTimeRange || data.posTimeRange === null || data.posTimeRange === '');
        });
        if (cleanupTargets.length > 0) {
          console.log('데이터 정리 - posTimeRange 누락 문서 삭제 대상:', cleanupTargets.length);
          for (const bad of cleanupTargets) {
            await deleteDoc(bad.ref);
          }
        }
      } catch (e) {
        console.warn('데이터 정리 중 오류(무시 가능):', e);
      }

      console.log('DB 쿼리 결과:', querySnapshot.docs.length, '건');
      console.log('현재 employeeReviewStatus:', employeeReviewStatus);
      
      if (querySnapshot.empty) {
        // 기존 데이터가 없으면 비교 결과 초기화
        setComparisonResults([]);
        return;
      }

      // 🔥 스케줄 데이터를 다시 조회해서 scheduledTimeRange 채우기
      const [year, monthNum] = selectedMonth.split('-').map(Number);
      const monthStart = new Date(year, monthNum - 1, 1);
      const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);
      
      // 🔥 스케줄 데이터 조회 (날짜 범위 필터링은 클라이언트에서 처리)
      const schedulesQuery = query(
        collection(db, 'schedules'),
        where('employeeId', '==', selectedEmployeeId),
        where('branchId', '==', branchId)
      );
      const schedulesSnapshot = await getDocs(schedulesQuery);
      const schedulesMap = new Map<string, any[]>();
      
      schedulesSnapshot.docs.forEach(doc => {
        const s = doc.data();
        const sDate = toLocalDate(s.date);
        const dateStr = toLocalDateString(sDate);
        
        // 🔥 선택된 월의 스케줄만 포함 (날짜 범위 필터링)
        const scheduleDate = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate());
        if (scheduleDate >= new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate()) &&
            scheduleDate <= new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate())) {
          if (!schedulesMap.has(dateStr)) {
            schedulesMap.set(dateStr, []);
          }
          schedulesMap.get(dateStr)!.push({
            ...s,
            date: sDate,
            id: doc.id
          });
        }
      });
      
      console.log('🔥 스케줄 맵 생성 완료:', {
        총스케줄수: schedulesSnapshot.docs.length,
        월필터링후: Array.from(schedulesMap.values()).flat().length,
        날짜별스케줄: Array.from(schedulesMap.keys())
      });
      
      const existingData = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          const dateStr = data.date;
          
          // 🔥 scheduledTimeRange가 없거나 '-'이면 스케줄 데이터에서 다시 조회
          let scheduledTimeRange = data.scheduledTimeRange || '-';
          let scheduledHours = data.scheduledHours || 0;
          let breakTime = data.breakTime || 0; // 🔥 휴게시간도 복구
          
          // 🔥 POS근무시각이 있는 경우에도 스케줄 정보가 없으면 복구 (휴게시간 포함)
          // 🔥 scheduledHours가 0이거나 scheduledTimeRange가 없으면 스케줄에서 복구 시도
          if ((!scheduledTimeRange || scheduledTimeRange === '-' || scheduledHours === 0 || !breakTime || breakTime === 0) && schedulesMap.has(dateStr)) {
            console.log(`🔥 스케줄 정보 복구 시도: ${dateStr}, 현재 scheduledTimeRange: ${scheduledTimeRange}, scheduledHours: ${scheduledHours}, breakTime: ${breakTime}`);
            const daySchedules = schedulesMap.get(dateStr)!;
            const timeRanges: string[] = [];
            let totalHours = 0;
            let totalBreakTime = 0; // 🔥 휴게시간 합산
            
            daySchedules.forEach(s => {
              if (s.startTime && s.endTime) {
                let startTimeOnly = s.startTime;
                let endTimeOnly = s.endTime;
                if (startTimeOnly.includes(' ')) {
                  startTimeOnly = startTimeOnly.split(' ')[1]?.split(':').slice(0, 2).join(':') || startTimeOnly;
                }
                if (endTimeOnly.includes(' ')) {
                  endTimeOnly = endTimeOnly.split(' ')[1]?.split(':').slice(0, 2).join(':') || endTimeOnly;
                }
                if (!startTimeOnly.includes(':')) {
                  startTimeOnly = `${startTimeOnly.padStart(2, '0')}:00`;
                }
                if (!endTimeOnly.includes(':')) {
                  endTimeOnly = `${endTimeOnly.padStart(2, '0')}:00`;
                }
                timeRanges.push(`${startTimeOnly}-${endTimeOnly}`);
              }
              totalHours += computeScheduleHours(s);
              // 🔥 휴게시간 합산
              totalBreakTime += parseFloat(s.breakTime) || 0;
            });
            
            if (timeRanges.length > 0) {
              scheduledTimeRange = timeRanges.join(',');
              scheduledHours = totalHours;
              // 🔥 휴게시간이 없거나 0이면 스케줄에서 가져온 값으로 업데이트
              if (!breakTime || breakTime === 0) {
                breakTime = totalBreakTime;
              }
              console.log(`✅ 스케줄 정보 복구: ${dateStr}, scheduledTimeRange: ${scheduledTimeRange}, scheduledHours: ${scheduledHours}, breakTime: ${breakTime}`);
            }
          }
          
          return {
            employeeName: data.employeeName,
            date: dateStr,
            scheduledHours: scheduledHours,
            actualHours: data.actualHours,
            difference: data.difference,
            status: data.status,
            scheduledTimeRange: scheduledTimeRange,
            actualTimeRange: data.actualTimeRange || '-',
            isModified: data.isModified || false,
            breakTime: breakTime, // 🔥 복구된 휴게시간 사용
            // 🔥 actualBreakTime이 0인 경우도 유효값이므로, nullish 병합 연산자로 처리 (0을 덮어쓰지 않도록)
            actualBreakTime: (data.actualBreakTime ?? breakTime ?? 0),
            actualWorkHours: data.actualWorkHours || 0,
            posTimeRange: data.posTimeRange || '',
            branchId: data.branchId,
            branchName: data.branchName,
            isManual: data.isManual || false,
            isNew: data.isManual || data.isNew || false,
            docId: docSnap.id
          };
        });

      // 🔧 중복 제거 제거: 모든 데이터를 보여줘서 사용자가 직접 확인하고 삭제할 수 있도록
      // 날짜순으로 정렬
      existingData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setComparisonResults(existingData);
      console.log('기존 비교 데이터 로드됨 (중복 포함):', existingData.length, '건');
      
      // 중복 데이터가 있는지 확인
      const duplicateMap = new Map<string, number>();
      existingData.forEach(row => {
        const key = `${row.date}|${row.posTimeRange || ''}`;
        duplicateMap.set(key, (duplicateMap.get(key) || 0) + 1);
      });
      const duplicates = Array.from(duplicateMap.entries()).filter(([_, count]) => count > 1);
      if (duplicates.length > 0) {
        console.warn('⚠️ 중복 데이터 발견:', duplicates.map(([key, count]) => `${key} (${count}건)`));
      }
      
      // 🔥 상태는 DB에 저장된 실제 상태를 유지하므로, 비교 데이터 로드 시 상태를 변경하지 않음
      // 상태 변경은 사용자가 명시적으로 버튼을 클릭했을 때만 이루어져야 함
    } catch (error) {
      console.error('기존 비교 데이터 로드 실패:', error);
      setComparisonResults([]);
    }
  }, [selectedEmployeeId, selectedMonth, selectedBranchId, isManager, userBranch]);

  // 🔥 기존 함수는 useEffect에서 사용 (selectedBranchId 변경 시 자동 로드)
  const loadExistingComparisonData = useCallback(async () => {
    await loadExistingComparisonDataForBranch();
  }, [loadExistingComparisonDataForBranch]);

  // 🔥 스케줄 로드 완료 후 비교 데이터 자동 로드 (포스근무시각이 있는 날의 스케줄 시간이 0:00으로 나오는 문제 해결)
  useEffect(() => {
    // 스케줄이 로드되고, 직원과 지점이 선택되어 있을 때만 비교 데이터 로드
    if (schedules.length > 0 && selectedEmployeeId && selectedMonth && (selectedBranchId || (isManager && userBranch))) {
      console.log('🔥 스케줄 로드 완료, 비교 데이터 자동 로드 시작');
      // 약간의 지연을 두어 상태 업데이트가 완전히 반영되도록 함
      const timer = setTimeout(() => {
        loadExistingComparisonDataForBranch();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [schedules, selectedEmployeeId, selectedMonth, selectedBranchId, isManager, userBranch, loadExistingComparisonDataForBranch]);

  // 지점과 직원이 선택되고 비교결과가 있으면 자동으로 로드
  useEffect(() => {
    if (hideBranchSelection && selectedBranchId && selectedEmployeeId && selectedMonth) {
      loadExistingComparisonData();
    }
  }, [hideBranchSelection, selectedBranchId, selectedEmployeeId, selectedMonth, loadExistingComparisonData]);

  // 모든 비교 결과를 DB에 저장하는 함수
  const saveAllComparisonResults = useCallback(async (results: WorkTimeComparison[]) => {
    if (!selectedEmployeeId || !selectedMonth) {
      console.log('저장 실패: 직원ID 또는 월이 없음');
      return;
    }
    
    try {
      console.log('DB 저장 시작:', selectedEmployeeId, selectedMonth, results.length, '건');
      
      // 매니저의 경우 userBranch.id 사용, 일반 사용자의 경우 selectedBranchId 사용
      const branchId = isManager && userBranch ? userBranch.id : selectedBranchId;
      
      // actualWorkRecords 저장 로직 제거 (workTimeComparisonResults만 사용)
      console.log('비교 결과 저장 시작:', results.length, '건');
    } catch (error) {
      console.error('비교 결과 저장 실패:', error);
    }
  }, [selectedEmployeeId, selectedMonth, selectedBranchId, isManager, userBranch]);

  // 수정된 데이터를 DB에 저장
  const saveModifiedData = async (result: WorkTimeComparison) => {
    try {
      // 매니저의 경우 userBranch.id 사용, 일반 사용자의 경우 selectedBranchId 사용
      const branchId = isManager && userBranch ? userBranch.id : selectedBranchId;
      
      const actualWorkRecord = {
        employeeId: selectedEmployeeId,
        employeeName: result.employeeName,
        date: result.date,
        actualHours: result.actualHours,
        actualWorkHours: result.actualWorkHours,
        breakTime: result.breakTime,
        // 🔥 실휴게시간도 함께 저장 (0도 유효값이므로 그대로 사용)
        actualBreakTime: result.actualBreakTime ?? 0,
        scheduledHours: result.scheduledHours,
        difference: result.difference,
        status: result.status,
        isModified: true,
        modifiedAt: new Date(),
        branchId: branchId,
        month: selectedMonth,
        scheduledTimeRange: result.scheduledTimeRange,
        actualTimeRange: result.actualTimeRange
      };

      // actualWorkRecords 저장 로직 제거 (workTimeComparisonResults만 사용)
      // workTimeComparisonResults 컬렉션에 저장 (비교결과용)
      const comparisonQuery = query(
        collection(db, 'workTimeComparisonResults'),
        where('employeeId', '==', selectedEmployeeId),
        where('date', '==', result.date),
        where('month', '==', selectedMonth),
        where('branchId', '==', branchId)
      );
      
      const comparisonDocs = await getDocs(comparisonQuery);
      
      // 🔥 직원명과 지점명 조회
      let employeeNameSnapshot: string | null = null;
      if (selectedEmployeeId) {
        try {
          const empDoc = await getDoc(doc(db, 'employees', selectedEmployeeId));
          if (empDoc.exists()) {
            employeeNameSnapshot = empDoc.data().name || '';
          }
        } catch {}
      }
      
      let branchNameSnapshot: string | null = null;
      if (branchId) {
        try {
          const bSnap = await getDocs(query(collection(db, 'branches'), where('__name__', '==', branchId)));
          branchNameSnapshot = bSnap.docs[0]?.data()?.name || '';
        } catch {}
      }
      
      const fallbackEmployeeName = result.employeeName && result.employeeName !== '직원'
        ? result.employeeName
        : employeeNameSnapshot || employees.find(emp => emp.id === selectedEmployeeId)?.name || '알 수 없음';
      const fallbackBranchName = result.branchName || branchNameSnapshot || branches.find(b => b.id === branchId)?.name || '';
      const finalEmployeeName = formatEmployeeNameWithBranch(fallbackEmployeeName, fallbackBranchName);
      
      const comparisonPayload = {
        employeeId: selectedEmployeeId,
        employeeName: finalEmployeeName,
        month: selectedMonth,
        branchId: branchId || '',
        branchName: fallbackBranchName,
        date: result.date,
        scheduledHours: result.scheduledHours,
        actualHours: result.actualHours,
        difference: result.difference,
        status: result.status,
        scheduledTimeRange: result.scheduledTimeRange || '-',
        actualTimeRange: result.actualTimeRange || '-',
        isModified: result.isModified || false,
        breakTime: result.breakTime || 0,
        actualBreakTime: result.actualBreakTime ?? 0,
        actualWorkHours: result.actualWorkHours || 0,
        posTimeRange: result.posTimeRange || '',
        isManual: result.isManual || false,
        updatedAt: new Date()
      };
      
      if (comparisonDocs.empty) {
        // 새로 추가
        const docRef = await addDoc(collection(db, 'workTimeComparisonResults'), {
          ...comparisonPayload,
          createdAt: new Date()
        });
        console.log('✅ 새로운 비교결과 데이터 저장됨:', comparisonPayload, 'docId:', docRef.id);
        // 🔥 docId를 상태에 반영
        result.docId = docRef.id;
        // 🔥 상태 업데이트
        setComparisonResults(prev => prev.map(r => 
          r.date === result.date && r.posTimeRange === result.posTimeRange 
            ? { ...r, docId: docRef.id, isNew: false, isManual: true }
            : r
        ));
      } else {
        // 기존 데이터 업데이트 (첫 번째 문서만)
        const docId = comparisonDocs.docs[0].id;
        await updateDoc(doc(db, 'workTimeComparisonResults', docId), comparisonPayload);
        console.log('✅ 기존 비교결과 데이터 업데이트됨:', comparisonPayload, 'docId:', docId);
        result.docId = docId;
        
        // 중복 데이터가 있으면 삭제
        if (comparisonDocs.docs.length > 1) {
          for (let i = 1; i < comparisonDocs.docs.length; i++) {
            await deleteDoc(comparisonDocs.docs[i].ref);
            console.log('중복 비교결과 데이터 삭제됨:', comparisonDocs.docs[i].id);
          }
        }
      }
    } catch (error) {
      console.error('데이터 저장 실패:', error);
      alert('데이터 저장에 실패했습니다.');
    }
  };

  // 시간 문자열을 Date로 변환 (HH:MM 또는 HH 형태 지원)
  const toTime = (hhmm: string): { hours: number; minutes: number } => {
    const t = hhmm.trim();
    const m = t.match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (!m) return { hours: 0, minutes: 0 };
    const h = Math.min(24, Math.max(0, parseInt(m[1], 10)));
    const min = m[2] ? Math.min(59, Math.max(0, parseInt(m[2], 10))) : 0;
    return { hours: h, minutes: min };
  };

  // 한 구간(HH[:MM]-HH[:MM](breakHours?))의 시간 계산. 익일 근무 처리
  const calcSegmentHours = (segment: string): number => {
    const seg = segment.trim();
    // breakHours e.g. (0.5)
    const breakMatch = seg.match(/\(([-\d\.]+)\)\s*$/);
    const breakHours = breakMatch ? Math.max(0, parseFloat(breakMatch[1])) : 0;
    const core = seg.replace(/\(([-\d\.]+)\)\s*$/, '');
    const parts = core.split('-');
    if (parts.length !== 2) return 0;
    const start = toTime(parts[0]);
    const end = toTime(parts[1]);
    const startTotal = start.hours + start.minutes / 60;
    let endTotal = end.hours + end.minutes / 60;
    // 익일 처리
    if (endTotal < startTotal) endTotal += 24;
    let hours = endTotal - startTotal - breakHours;
    if (!isFinite(hours) || hours < 0) hours = 0;
    return hours;
  };

  // 스케줄 객체에서 totalHours 산출 (다중 구간 지원: "10-12,15-22(0.5)")
  const computeScheduleHours = (data: any): number => {
    // 1) 명시적 totalHours가 있고 0이 아닌 경우에만 우선 사용
    // totalHours가 0이면 startTime/endTime으로 재계산 시도
    if (data && data.totalHours !== undefined && data.totalHours !== null && Number(data.totalHours) > 0) {
      return Number(data.totalHours);
    }

    // 2) timeRanges 형태가 있는 경우
    const ranges: string | undefined = data?.timeRanges || data?.ranges || undefined;
    if (typeof ranges === 'string' && ranges.trim().length > 0) {
      const calculated = ranges.split(',').map(s => calcSegmentHours(s)).reduce((a, b) => a + b, 0);
      if (calculated > 0) return calculated;
    }

    // 3) startTime/endTime 에 다중 구간 문자열이 들어있는 경우 처리
    const startStr: string | undefined = typeof data?.startTime === 'string' ? data.startTime : undefined;
    const endStr: string | undefined = typeof data?.endTime === 'string' ? data.endTime : undefined;

    // 케이스 A: startTime 또는 endTime 중 하나에 콤마로 구간들이 들어있는 경우
    if (startStr && startStr.includes(',')) {
      const calculated = startStr.split(',').map(s => calcSegmentHours(s)).reduce((a, b) => a + b, 0);
      if (calculated > 0) return calculated;
    }
    if (endStr && endStr.includes(',')) {
      const calculated = endStr.split(',').map(s => calcSegmentHours(s)).reduce((a, b) => a + b, 0);
      if (calculated > 0) return calculated;
    }

    // 케이스 B: 단일 구간(startTime-endTime), breakTime(분) 고려
    if (startStr && endStr) {
      // 시간만 추출 (날짜+시간 형식이면 시간만)
      let startTimeOnly = startStr.trim();
      let endTimeOnly = endStr.trim();
      
      // 날짜+시간 형식이면 시간만 추출
      if (startTimeOnly.includes(' ')) {
        startTimeOnly = startTimeOnly.split(' ')[1]?.split(':').slice(0, 2).join(':') || startTimeOnly;
      }
      if (endTimeOnly.includes(' ')) {
        endTimeOnly = endTimeOnly.split(' ')[1]?.split(':').slice(0, 2).join(':') || endTimeOnly;
      }
      
      // "14" 같은 형식이면 "14:00"으로 변환
      if (!startTimeOnly.includes(':')) {
        const hour = parseInt(startTimeOnly, 10);
        if (!isNaN(hour)) {
          startTimeOnly = `${String(hour).padStart(2, '0')}:00`;
        }
      }
      if (!endTimeOnly.includes(':')) {
        const hour = parseInt(endTimeOnly, 10);
        if (!isNaN(hour)) {
          endTimeOnly = `${String(hour).padStart(2, '0')}:00`;
        }
      }
      
      // 최종 검증: 시간 형식이 맞는지 확인
      if (startTimeOnly.match(/^\d{1,2}:\d{2}$/) && endTimeOnly.match(/^\d{1,2}:\d{2}$/)) {
        const baseHours = calcSegmentHours(`${startTimeOnly}-${endTimeOnly}`);
        const breakMin = Number(data?.breakTime || 0);
        const breakH = isFinite(breakMin) ? breakMin / 60 : 0;
        const v = baseHours - breakH;
        if (v > 0) {
          console.log(`✅ computeScheduleHours 성공: ${startTimeOnly}-${endTimeOnly} (break: ${breakH}h) = ${v}시간`);
          return v;
        } else {
          console.warn(`⚠️ computeScheduleHours 결과가 0 이하: ${startTimeOnly}-${endTimeOnly} (break: ${breakH}h) = ${v}시간`);
        }
      } else {
        console.error(`❌ computeScheduleHours 시간 형식 오류: startTime="${startTimeOnly}", endTime="${endTimeOnly}"`);
      }
    }

    return 0;
  };

  const generateLocalDateString = (date: Date) => {
    return toLocalDateString(date);
  };

  const formatEmployeeNameWithBranch = (
    employeeName: string,
    branchName?: string
  ) => {
    const cleanBranch = branchName?.trim();
    if (!employeeName) return cleanBranch ? `알 수 없음 (${cleanBranch})` : '알 수 없음';
    if (!cleanBranch) return employeeName;
    const suffixPattern = new RegExp(`\\(${cleanBranch.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\)$`);
    if (suffixPattern.test(employeeName)) {
      return employeeName;
    }
    return `${employeeName} (${cleanBranch})`;
  };

  const loadManualRecords = useCallback(
    async (employeeId?: string, month?: string, branchId?: string | null): Promise<WorkTimeComparison[]> => {
      if (!employeeId || !month) return [];

      const constraints: any[] = [
        where('employeeId', '==', employeeId),
        where('month', '==', month),
        where('isManual', '==', true),
      ];

      if (branchId) {
        constraints.push(where('branchId', '==', branchId));
      }

      const manualQuery = query(collection(db, 'workTimeComparisonResults'), ...constraints);
      const manualSnapshot = await getDocs(manualQuery);

      return manualSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          employeeName: data.employeeName,
          date: data.date,
          scheduledHours: data.scheduledHours || 0,
          actualHours: data.actualHours,
          difference: data.difference,
          status: data.status,
          scheduledTimeRange: data.scheduledTimeRange || '-',
          actualTimeRange: data.actualTimeRange || '-',
          isModified: data.isModified || false,
          breakTime: data.breakTime || 0,
          actualBreakTime: data.actualBreakTime || 0,
          actualWorkHours: data.actualWorkHours || 0,
          posTimeRange: data.posTimeRange || '',
          branchId: data.branchId,
          branchName: data.branchName,
          isManual: true,
          isNew: false,
          docId: doc.id
        } as WorkTimeComparison;
      });
    }, []);

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">근무시간 비교</h3>
        <p className="text-sm text-gray-600 mt-1">매월 초 한번씩 전달의 스케쥴과 실제근무 시간을 비교합니다</p>
      </div>
      
      <div className="p-6">
        <div className="mb-6">
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <button
            onClick={() => setShowMenuDescription(!showMenuDescription)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-blue-800 ml-3">메뉴 설명 및 사용 방법</h3>
            </div>
            <svg
              className={`h-5 w-5 text-blue-400 transition-transform ${showMenuDescription ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showMenuDescription && (
            <div className="mt-4">
              <div className="text-sm text-blue-700 space-y-1">
                <p>• 매월 초 한번씩 전달의 스케쥴과 실제근무 시간을 비교합니다</p>
                <p>• 비교할 월을 선택하고 실제근무 데이터를 복사붙여넣기합니다</p>
                <p>• 차이가 있는 경우 초과/부족 시간을 확인하고, 수정할 수 있습니다</p>
              </div>
              
              <h3 className="text-sm font-medium text-blue-800 mt-4 mb-2">사용 방법</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p>1. 직원 선택</p>
                <p>2. POS에서 실제 근무 데이터 붙여넣기</p>
                <p>3. 근무시간 비교 버튼 클릭해서 차이나는 시간을 조정</p>
                <p>4. 모든 스케쥴 수정/확인 완료 시 검토완료 상태로 변경</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 선택된 월 표시 */}
      {selectedMonth && (
        <div className="mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="text-blue-600 font-medium">
                📅 선택된 월: {selectedMonth}
              </div>
            </div>
          </div>
        </div>
      )}

        {/* 전체 검토 상태 */}
        {selectedEmployeeId && (
          <div className="bg-white shadow rounded-lg overflow-hidden mb-6 w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">전체 검토 상태</h3>
            </div>
            <div className="px-6 py-4 w-full">
              {(() => {
                const isPayrollConfirmed = payrollConfirmedEmployees.includes(selectedEmployeeId);
                
                // 해당 직원의 모든 지점 상태 조회
                const employeeStatuses = employeeReviewStatus.filter(status => status.employeeId === selectedEmployeeId);
                console.log(`🔥🔥🔥 ${employees.find(e => e.id === selectedEmployeeId)?.name} 전체 상태:`, employeeStatuses);
                console.log(`🔥🔥🔥 직원 지점 목록:`, employeeBranches);
                
                return (
                  <div className="space-y-4">
                    {/* 급여확정 상태 */}
                    {isPayrollConfirmed && (
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg mb-4">
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          급여확정완료
                        </span>
                      </div>
                    )}
                    
                    {/* 지점별 검토 상태 - 급여확정완료 상태여도 표시 */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700">지점별 검토 상태</h4>
                      {employeeBranches.length > 0 ? (
                        employeeBranches.map(branchId => {
                            const branch = branches.find(b => b.id === branchId);
                            const branchStatus = employeeStatuses.find(status => status.branchId === branchId);
                            const status = branchStatus?.status || '검토전';
                            
                            console.log(`🔥 지점 ${branch?.name} (${branchId}) 상태:`, status, 'branchStatus:', branchStatus);
                            
                            return (
                              <div key={branchId} className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors w-full ${
                                selectedBranchId === branchId 
                                  ? 'border-blue-500 bg-blue-50' 
                                  : 'border-gray-200 hover:bg-gray-50'
                              }`}
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                
                                // 🔥 지점 변경 시 기존 비교 결과 초기화 (다른 지점의 수정된 데이터가 로드를 막지 않도록)
                                setComparisonResults([]);
                                console.log('🔥 지점 선택됨:', branchId, branch?.name);
                                
                                // 🔥 flushSync를 사용하여 상태 업데이트를 동기적으로 처리하여 UI가 즉시 반영되도록 함
                                flushSync(() => {
                                  setSelectedBranchId(branchId);
                                });
                                
                                // 🔥 branchId를 직접 전달하여 즉시 로드 (상태 업데이트 대기 불필요)
                                // 데이터가 없어도 지점 선택은 즉시 반영되어야 함
                                try {
                                  await loadExistingComparisonDataForBranch(branchId);
                                } catch (error) {
                                  console.error('지점 데이터 로드 실패:', error);
                                  // 에러가 발생해도 지점 선택은 유지
                                }
                              }}>
                                <div className="flex items-center space-x-3 flex-1">
                                  <span className={`text-sm font-medium ${
                                    selectedBranchId === branchId ? 'text-blue-700' : 'text-gray-700'
                                  }`}>
                                    {branch?.name || `지점 ${branchId}`}
                                  </span>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    status === '급여확정완료' ? 'bg-purple-100 text-purple-800' :
                                    status === '근무시간검토완료' ? 'bg-green-100 text-green-800' :
                                    status === '검토중' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {status}
                                  </span>
                                </div>
                                {/* 급여확정완료 상태일 때는 버튼 숨김 */}
                                <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                                  {status === '급여확정완료' ? (
                                    <span className="text-sm text-gray-500 font-medium">급여확정완료</span>
                                  ) : status === '근무시간검토완료' ? (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        // 🔥 급여확정완료 상태 확인
                                        const isPayrollConfirmed = employeeReviewStatus.some(s => 
                                          s.employeeId === selectedEmployeeId && s.status === '급여확정완료'
                                        );
                                        
                                        if (isPayrollConfirmed) {
                                          alert('급여확정완료 상태에서는 검토상태를 변경할 수 없습니다.');
                                          return;
                                        }
                                        
                                        if (confirm(`${branch?.name} 지점의 검토완료를 취소하시겠습니까?`)) {
                                          // 🔥 상태를 '검토중'으로 변경
                                          setEmployeeReviewStatus(prev => {
                                            return prev.map(s => 
                                              s.employeeId === selectedEmployeeId && s.branchId === branchId
                                                ? { ...s, status: '검토중' as '검토전' | '검토중' | '근무시간검토완료' | '근무시간검토완료' }
                                                : s
                                            );
                                          });
                                          
                                          // 🔥 비교 결과 테이블 강제 리렌더링을 위해 복사
                                          setComparisonResults([...comparisonResults]);
                                          
                                          await saveReviewStatus(selectedEmployeeId, '검토중', branchId);
                                        }
                                      }}
                                      className="bg-orange-600 text-white px-3 py-1 rounded text-xs hover:bg-orange-700"
                                    >
                                      검토완료취소
                                    </button>
                                  ) : status === '검토중' ? (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        // 🔥 급여확정완료 상태 확인
                                        const isPayrollConfirmed = employeeReviewStatus.some(s => 
                                          s.employeeId === selectedEmployeeId && s.status === '급여확정완료'
                                        );
                                        
                                        if (isPayrollConfirmed) {
                                          alert('급여확정완료 상태에서는 검토상태를 변경할 수 없습니다.');
                                          return;
                                        }
                                        
                                        if (confirm(`${branch?.name} 지점의 검토를 완료하시겠습니까?`)) {
                                          // 🔥 상태를 '근무시간검토완료'로 변경
                                          setEmployeeReviewStatus(prev => {
                                            return prev.map(s => 
                                              s.employeeId === selectedEmployeeId && s.branchId === branchId
                                                ? { ...s, status: '근무시간검토완료' as '검토전' | '검토중' | '근무시간검토완료' | '근무시간검토완료' }
                                                : s
                                            );
                                          });
                                          
                                          // 🔥 비교 결과 테이블 강제 리렌더링을 위해 복사
                                          setComparisonResults([...comparisonResults]);
                                          
                                          await saveReviewStatus(selectedEmployeeId, '근무시간검토완료', branchId);
                                          // 🔥 loadReviewStatus 제거: 이미 상태를 업데이트했으므로 불필요
                                          // await loadReviewStatus(employees);
                                          
                                          // 🔥 비교 결과 테이블 강제 리렌더링
                                          setComparisonResults([...comparisonResults]);
                                        }
                                      }}
                                      className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                                    >
                                      검토완료
                                    </button>
                                  ) : (
                                    // 🔥 검토전 상태: 검토완료 버튼 표시 (비교 데이터가 있으면 바로 완료 가능)
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        console.log('🔥🔥🔥 검토완료 버튼 클릭됨 (검토전 상태)');
                                        console.log('🔥🔥🔥 branchId:', branchId, 'branch name:', branch?.name);
                                        console.log('🔥🔥🔥 selectedEmployeeId:', selectedEmployeeId);
                                        console.log('🔥🔥🔥 selectedBranchId:', selectedBranchId);
                                        
                                        if (confirm(`${branch?.name} 지점의 검토를 완료하시겠습니까?`)) {
                                          console.log('🔥🔥🔥 확인 클릭됨!');
                                          
                                          // 🔥 상태를 '근무시간검토완료'로 변경
                                          setEmployeeReviewStatus(prev => {
                                            const existing = prev.find(s => 
                                              s.employeeId === selectedEmployeeId && s.branchId === branchId
                                            );
                                            
                                            console.log('🔥🔥🔥 기존 상태:', existing);
                                            
                                            if (existing) {
                                              const updated = prev.map(s => 
                                                s.employeeId === selectedEmployeeId && s.branchId === branchId
                                                  ? { ...s, status: '근무시간검토완료' as '검토전' | '검토중' | '근무시간검토완료' | '근무시간검토완료' }
                                                  : s
                                              );
                                              console.log('🔥🔥🔥 기존 상태 업데이트:', updated);
                                              return updated;
                                            } else {
                                              // 상태가 없으면 새로 추가
                                              const newStatus = { 
                                                employeeId: selectedEmployeeId, 
                                                branchId: branchId, 
                                                status: '근무시간검토완료' as '검토전' | '검토중' | '근무시간검토완료' | '근무시간검토완료' 
                                              };
                                              console.log('🔥🔥🔥 새로운 상태 추가:', newStatus);
                                              return [...prev, newStatus];
                                            }
                                          });
                                          
                                          setComparisonResults([...comparisonResults]);
                                          
                                          console.log('🔥🔥🔥 saveReviewStatus 호출 직전, branchId:', branchId);
                                          await saveReviewStatus(selectedEmployeeId, '근무시간검토완료', branchId);
                                          console.log('🔥🔥🔥 saveReviewStatus 호출 완료');
                                        } else {
                                          console.log('🔥🔥🔥 확인 취소됨');
                                        }
                                      }}
                                      className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                                    >
                                      검토완료
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-sm text-gray-500">지점 정보가 없습니다.</div>
                        )}
                      </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

      </div>

      {/* 직원 리스트 테이블 */}
      {!hideEmployeeSelection && selectedBranchId && selectedMonth && employees.length > 0 ? (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            선택된 지점의 직원 목록
          </h3>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      선택
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      직원명
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      고용형태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      검토여부
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employees.map((employee) => {
                    const hasContractInfo = employee.employmentType && employee.salaryType;
                    return (
                      <tr 
                        key={employee.id} 
                        className={`${
                          hasContractInfo 
                            ? `hover:bg-gray-50 cursor-pointer ${selectedEmployeeId === employee.id ? 'bg-blue-50' : ''}`
                            : 'bg-gray-100 cursor-not-allowed opacity-60'
                        }`}
                        onClick={() => {
                          if (hasContractInfo) {
                            setSelectedEmployeeId(employee.id);
                          } else {
                            alert('근로계약 정보가 없습니다.\n직원관리 > 근로계약관리에서 계약정보를 입력해주세요.');
                          }
                        }}
                      >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <input
                          type="radio"
                          name="employee"
                          value={employee.id}
                          checked={selectedEmployeeId === employee.id}
                          onChange={() => {
                            console.log('직원 선택 시도:', employee.name, 'hasContractInfo:', hasContractInfo, 'employmentType:', employee.employmentType, 'salaryType:', employee.salaryType);
                            if (hasContractInfo) {
                              console.log('직원 선택됨:', employee.id);
                              setSelectedEmployeeId(employee.id);
                            } else {
                              console.log('근로계약 정보 없음으로 선택 불가');
                            }
                          }}
                          disabled={!hasContractInfo}
                          className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 ${
                            !hasContractInfo ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center space-x-2">
                          <span>{employee.name}</span>
                          {!hasContractInfo && (
                            <span 
                              className="text-red-500 text-xs"
                              title="근로계약정보 입력 필요"
                            >
                              ⚠️
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(() => {
                          if (employee.employmentType && employee.salaryType) {
                            const salaryTypeText = employee.salaryType === 'hourly' ? '시급' : '월급';
                            return `${employee.employmentType}(${salaryTypeText})`;
                          } else if (employee.employmentType) {
                            return employee.employmentType;
                          } else {
                            return '-';
                          }
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {(() => {
                          // 근로계약 히스토리가 없는 경우
                          if (!employee.employmentType || !employee.salaryType) {
                            return (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full text-red-600 bg-red-50">
                                근로계약 정보 필요
                              </span>
                            );
                          }
                          
                          const empStatus = employeeReviewStatus.find(status => status.employeeId === employee.id)?.status || '검토전';
                          const getStatusColor = (status: string) => {
                            switch (status) {
                              case '검토전': return 'text-gray-600 bg-gray-50';
                              case '검토중': return 'text-orange-600 bg-orange-50';
                              case '근무시간검토완료': return 'text-green-600 bg-green-50';
                              case '급여확정완료': return 'text-purple-600 bg-purple-50';
                              default: return 'text-gray-600 bg-gray-50';
                            }
                          };
                          return (
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(empStatus)}`}>
                              {empStatus}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      ) : null}

      {/* 실제근무 데이터 입력 */}
      {!isPayrollConfirmed(selectedEmployeeId) && (() => {
        // 급여확정완료 상태인지 확인 (모든 지점이 급여확정완료인지 확인)
        const employeeStatuses = employeeReviewStatus.filter(status => 
          status.employeeId === selectedEmployeeId
        );
        
        // 해당 직원의 모든 지점이 급여확정완료 상태인지 확인
        const allConfirmed = employeeStatuses.length > 0 && 
          employeeStatuses.every(status => status.status === '급여확정완료');
        
        console.log('🔥 급여확정완료 상태 확인:', {
          selectedEmployeeId,
          employeeStatuses: employeeStatuses.length,
          allConfirmed,
          statuses: employeeStatuses.map(s => ({ branchId: s.branchId, status: s.status }))
        });
        
        return !allConfirmed;
      })() && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            실제근무 데이터 (복사붙여넣기) <span className="text-red-500">*</span>
          </label>
        
        {/* 도움말 */}
        <div className="mb-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <button
            onClick={() => setShowDataCopyMethod(!showDataCopyMethod)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <h4 className="text-sm font-medium text-blue-900 ml-3">데이터 복사 방법</h4>
            </div>
            <svg
              className={`h-5 w-5 text-blue-400 transition-transform ${showDataCopyMethod ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showDataCopyMethod && (
            <div className="mt-4">
              <div className="text-sm text-blue-800 space-y-2">
                <p><strong>POS ASP 시스템에서 복사하기:</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>POS ASP 시스템 → 기타관리 → 근태관리 → 월근태내역</li>
                  <li>조회일자 설정 후 &quot;조회&quot; 버튼 클릭</li>
                  <li>아래 표에서 해당 직원의 <strong>전체 데이터 영역을 선택</strong>하여 복사</li>
                  <li>복사한 데이터를 아래 텍스트 영역에 붙여넣기</li>
                </ol>
                <div className="mt-3 p-2 bg-white border border-blue-300 rounded text-xs">
                  <p className="font-medium text-gray-700">복사 예시:</p>
                  <p className="text-gray-600 font-mono">2025-09-11	2025-09-11 19:00:10	2025-09-11 22:11:05	2025-09-11	...	3:11</p>
                  <div className="mt-2">
                    <button
                      onClick={() => {
                        const modal = document.createElement('div');
                        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                        modal.innerHTML = 
                          '<div class="bg-white p-4 rounded-lg max-w-6xl max-h-[90vh] overflow-auto">' +
                            '<div class="flex justify-between items-center mb-4">' +
                              '<h3 class="text-lg font-semibold">POS ASP 시스템 화면 예시</h3>' +
                              '<button onclick="this.closest(\'.fixed\').remove()" class="text-gray-500 hover:text-gray-700 text-xl">&times;</button>' +
                            '</div>' +
                            '<div class="text-sm text-gray-600 mb-4">' +
                              '<p><strong>복사할 영역:</strong> 아래 표에서 해당 직원의 전체 데이터 행을 선택하여 복사하세요.</p>' +
                              '<p><strong>주의:</strong> 표 헤더는 제외하고 데이터 행만 복사해야 합니다.</p>' +
                            '</div>' +
                            '<div class="bg-gray-100 p-4 rounded border">' +
                              '<p class="text-xs text-gray-500 mb-2">POS ASP 시스템 → 기타관리 → 근태관리 → 월근태내역 화면</p>' +
                              '<div class="bg-white border rounded p-3">' +
                                '<img src="/images/pos-asp-example.png" alt="POS ASP 시스템 화면 예시" class="w-full h-auto border rounded" onerror="console.log(\'이미지 로드 실패:\', this); this.style.display=\'none\';" />' +
                              '</div>' +
                              '<div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">' +
                                '<p class="font-medium text-yellow-800 mb-2">💡 복사 방법:</p>' +
                                '<ul class="text-yellow-700 space-y-1">' +
                                  '<li>• 위 표에서 해당 직원의 데이터 행들을 마우스로 드래그하여 선택한 후 Ctrl+C로 복사하세요.</li>' +
                                  '<li>• 헤더는 제외하고 데이터 행만 복사</li>' +
                                  '<li>• 여러 날의 데이터가 있는 경우 모든 행을 포함</li>' +
                                '</ul>' +
                              '</div>' +
                            '</div>' +
                          '</div>';
                        document.body.appendChild(modal);
                      }}
                      className="text-blue-600 hover:text-blue-800 text-xs underline"
                    >
                      📷 POS ASP 화면 예시 보기
                    </button>
                  </div>
                </div>
                
                <div className="mt-6">
                  <p><strong>지점별로 관리하는 출퇴근시간관리엑셀에서 복사하기:</strong></p>
                  <div className="mt-3 p-2 bg-white border border-blue-300 rounded text-xs">
                    <p className="font-medium text-gray-700">복사 예시:</p>
                    <p className="text-gray-600 font-mono">2025-09-01	월	1	11:00	15:00		4</p>
                    <div className="mt-2">
                      <button
                        onClick={() => {
                          const modal = document.createElement('div');
                          modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                          modal.innerHTML = 
                            '<div class="bg-white p-4 rounded-lg max-w-6xl max-h-[90vh] overflow-auto">' +
                              '<div class="flex justify-between items-center mb-4">' +
                                '<h3 class="text-lg font-semibold">출퇴근시간관리엑셀 화면 예시</h3>' +
                                '<button onclick="this.closest(\'.fixed\').remove()" class="text-gray-500 hover:text-gray-700 text-xl">&times;</button>' +
                              '</div>' +
                              '<div class="text-sm text-gray-600 mb-4">' +
                                '<p><strong>복사할 영역:</strong> 엑셀에서 해당 직원의 전체 데이터 행을 선택하여 복사하세요.</p>' +
                                '<p><strong>주의:</strong> 표 헤더는 제외하고 데이터 행만 복사해야 합니다.</p>' +
                              '</div>' +
                              '<div class="bg-gray-100 p-4 rounded border">' +
                                '<p class="text-xs text-gray-500 mb-2">출퇴근시간관리엑셀 화면</p>' +
                                '<div class="bg-white border rounded p-3">' +
                                  '<img src="/images/excel-attendance-example.png" alt="출퇴근시간관리엑셀 화면 예시" class="w-full h-auto border rounded" onerror="console.log(\'이미지 로드 실패:\', this); this.style.display=\'none\';" />' +
                                '</div>' +
                                '<div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">' +
                                  '<p class="font-medium text-yellow-800 mb-2">💡 복사 방법:</p>' +
                                  '<ul class="text-yellow-700 space-y-1">' +
                                    '<li>• 엑셀에서 해당 직원의 데이터 행들을 선택한 후 Ctrl+C로 복사하세요.</li>' +
                                    '<li>• 형식: 날짜, 요일, 주차, 출근, 퇴근, 휴게-점심, 휴게-저녁, 근무시간</li>' +
                                    '<li>• 출근/퇴근 시간이 없는 행은 자동으로 무시됩니다.</li>' +
                                  '</ul>' +
                                '</div>' +
                              '</div>' +
                            '</div>';
                          document.body.appendChild(modal);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-xs underline"
                      >
                        📷 출퇴근시간관리엑셀 화면 예시 보기
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <textarea
          value={actualWorkData}
          onChange={(e) => setActualWorkData(e.target.value)}
          placeholder="POS ASP 시스템 또는 지점별로 관리하는 출퇴근시간관리엑셀에서 복사한 실제근무 데이터를 붙여넣으세요..."
          className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        </div>
      )}

      {/* 비교 실행 버튼 */}
      {!isPayrollConfirmed(selectedEmployeeId) && (() => {
        // 급여확정완료 상태인지 확인
        const reviewStatus = employeeReviewStatus.find(status => 
          status.employeeId === selectedEmployeeId && status.branchId === selectedBranchId
        );
        return reviewStatus?.status !== '급여확정완료';
      })() && (
        <div className="mb-6">
          <button
            onClick={() => {
              console.log('🔥🔥🔥 근무시간 비교 버튼 클릭됨');
              compareWorkTimes();
            }}
            disabled={loading || (() => {
              const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);
              if (!selectedEmployee) return false;
              // 현재 선택된 지점의 검토상태만 확인
              const reviewStatus = employeeReviewStatus.find(status => 
                status.employeeId === selectedEmployeeId && status.branchId === selectedBranchId
              );
              return reviewStatus?.status === '근무시간검토완료';
            })()}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? '로딩 중...' : (() => {
              const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);
              if (!selectedEmployee) return '근무시간 비교';
              const reviewStatus = employeeReviewStatus.find(status => status.employeeId === selectedEmployeeId);
              return reviewStatus?.status === '근무시간검토완료' ? '검토완료 (비교 불가)' : '근무시간 비교';
            })()}
          </button>
        </div>
      )}


      {/* 비교 결과 - 급여확정완료 상태여도 표시 (조회만 가능) */}
      {(() => {
        // 🔥 통일된 편집 가능 여부 조건
        const currentBranchStatus = employeeReviewStatus.find(status => 
          status.employeeId === selectedEmployeeId && status.branchId === selectedBranchId
        );
        // 급여확정완료 상태이거나 근무시간검토완료 상태면 편집 불가
        const isEditable = currentBranchStatus?.status !== '근무시간검토완료' && 
                          currentBranchStatus?.status !== '급여확정완료' &&
                          !isPayrollConfirmed(selectedEmployeeId);
        
        // 급여확정완료 상태가 아닐 때만 행 추가 버튼 표시
        const showAddButton = !isPayrollConfirmed(selectedEmployeeId) && 
                             currentBranchStatus?.status !== '급여확정완료';
        
        return (
          <>
            {showAddButton && (
              <div className="flex justify-end mb-2">
                <button
                  onClick={addManualComparisonRow}
                  disabled={!selectedEmployeeId || !selectedMonth}
                  className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50"
                >
                  + 행 추가
                </button>
              </div>
            )}
            {(() => {
        
        return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {(() => {
              const selectedEmployeeName = employees.find(emp => emp.id === selectedEmployeeId)?.name || '선택된 직원';
              return `${selectedEmployeeName} 비교결과 ${comparisonResults.length > 0 ? `(${comparisonResults.length}건)` : ''}`;
            })()}
          </h3>
        </div>
        
        {comparisonResults.length > 0 && (
          <div>
            {/* 확인완료 상태 표시 */}
            <div className="mb-4">
              <div className="text-sm text-gray-600">
                {(() => {
                  const completedCount = comparisonResults.filter(result => 
                    result.status === 'review_completed' || result.status === 'time_match'
                  ).length;
                  const totalCount = comparisonResults.length;
                  const allReviewCompleted = completedCount === totalCount && totalCount > 0;
                  return (
                    <span>
                      {completedCount}/{totalCount} 항목 확인완료
                      {allReviewCompleted && <span className="ml-2 text-green-600 font-semibold">✓ 전체 검토완료</span>}
                    </span>
                  );
                })()}
              </div>
            </div>
            
            <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    날짜
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    스케줄시간(A)
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    POS근무시각
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    실근무시각(B)
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    실휴게시간(C)
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    실근무시간 (D=B-C)
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    차이 (A-D)
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    연장근무시간
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {comparisonResults.map((result, index) => {
                  const rowBgColor = (result.status === 'review_completed' || result.status === 'time_match') 
                    ? 'bg-white' 
                    : 'bg-yellow-50';
                  const range = getSelectedMonthRange();
                  const minDateStr = range.start ? `${range.start.getFullYear()}-${String(range.start.getMonth()+1).padStart(2,'0')}-01` : undefined;
                  const maxDateStr = range.end ? `${range.end.getFullYear()}-${String(range.end.getMonth()+1).padStart(2,'0')}-${String(range.end.getDate()).padStart(2,'0')}` : undefined;
                  
                  // const allReviewCompleted = isBranchReviewCompleted || (completedCount === comparisonResults.length && comparisonResults.length > 0);
                  
                  return (
                    <tr key={index} className={`hover:bg-gray-50 ${rowBgColor} border-t border-gray-200`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {/* 날짜는 수동 추가된 행(isNew)만 편집 허용 */}
                        {!isEditable || result.status === 'review_completed' || isPayrollConfirmed(selectedEmployeeId) || !result.isNew ? (
                          <span>{result.date}</span>
                        ) : (
                          <div className="flex items-center">
                          <input
                            type="date"
                            value={result.date}
                            min={minDateStr}
                            max={maxDateStr}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const updated = [...comparisonResults];
                              updated[index] = { ...result, date: e.target.value, isModified: true };
                              setComparisonResults(updated);
                            }}
                            onBlur={() => {
                              // 월 범위 검증 및 정렬 후 저장
                              const { start, end } = getSelectedMonthRange();
                              try {
                                const d = new Date(result.date);
                                if (start && end && (d < start || d > end)) {
                                  alert('선택한 월 범위 내의 날짜만 입력할 수 있습니다.');
                                  // 범위를 벗어나면 해당 월의 1일로 되돌림
                                  const fallback = `${selectedMonth}-01`;
                                  const updated = [...comparisonResults];
                                  updated[index] = { ...result, date: fallback };
                                  setComparisonResults(updated);
                                } else {
                                  // 날짜 정렬
                                  const sorted = [...comparisonResults].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                  setComparisonResults(sorted);
                                  // 저장
                                  saveComparisonResults(sorted).catch(err => console.error('날짜 저장 실패:', err));
                                }
                              } catch {}
                            }}
                            className="px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                          {result.isNew && (
                            <button
                              onClick={async () => {
                                const rowToDelete = comparisonResults[index];
                                
                                // DB에서도 삭제 (docId가 있는 경우)
                                if (rowToDelete.docId) {
                                  try {
                                    await deleteDoc(doc(db, 'workTimeComparisonResults', rowToDelete.docId));
                                    console.log('🔥 DB에서 비교결과 삭제됨:', rowToDelete.docId, '날짜:', rowToDelete.date);
                                  } catch (error) {
                                    console.error('DB 삭제 실패:', error);
                                    return;
                                  }
                                }
                                
                                // 화면에서 제거
                                const updated = comparisonResults.filter((_, i) => i !== index);
                                setComparisonResults(updated);
                                
                                // 삭제 후 데이터 다시 로드하여 최신 상태 확인
                                try {
                                  await loadExistingComparisonData();
                                  console.log('🔥 삭제 후 데이터 다시 로드 완료');
                                } catch (error) {
                                  console.error('데이터 다시 로드 실패:', error);
                                }
                              }}
                              className="ml-2 px-2 py-1 border border-red-300 text-red-600 rounded text-xs hover:bg-red-50"
                            >
                              삭제
                            </button>
                          )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        <div className="space-y-1">
                          {/* 스케줄 근무시간 표시 */}
                          <div className="text-xs text-gray-500 font-medium">
                            {(() => {
                              // scheduledHours는 이미 휴게시간을 제외한 순 근무시간이므로 그대로 사용
                              const scheduledWorkHours = result.scheduledHours;
                              const hours = Math.floor(scheduledWorkHours);
                              const minutes = Math.round((scheduledWorkHours - hours) * 60);
                              return `${hours}:${minutes.toString().padStart(2, '0')}`;
                            })()}
                          </div>
                          {/* 스케줄 시간 표시: 7:00 또는 9:30-17:00(0:30) 형태 */}
                          <div>{(() => {
                            const hours = Math.floor(result.scheduledHours);
                            const minutes = Math.round((result.scheduledHours - hours) * 60);
                            const breakTime = result.breakTime || 0;
                            const breakHours = Math.floor(breakTime);
                            const breakMinutes = Math.round((breakTime - breakHours) * 60);
                            
                            // scheduledTimeRange가 있으면 항상 시간범위 형태로 표시
                            if (result.scheduledTimeRange && result.scheduledTimeRange !== '-') {
                              if (breakTime > 0) {
                                // 휴게시간이 있는 경우: 9:30-17:00(0:30) 형태
                                return `${result.scheduledTimeRange}(${breakHours}:${breakMinutes.toString().padStart(2, '0')})`;
                              } else {
                                // 휴게시간이 없는 경우: 9:30-17:00 형태
                                return `${result.scheduledTimeRange}`;
                              }
                            } else {
                              // scheduledTimeRange가 없는 경우에만 hours:minutes 형태
                              console.log(`🔥 스케줄시간 표시: ${result.date}, scheduledTimeRange: ${result.scheduledTimeRange}, breakTime: ${breakTime}, hours: ${hours}, minutes: ${minutes}`);
                              return `${hours}:${minutes.toString().padStart(2, '0')}`;
                            }
                          })()}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        <span className="text-gray-600">{result.posTimeRange || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {!isEditable || result.status === 'review_completed' || isPayrollConfirmed(selectedEmployeeId) ? (
                          <span className="text-gray-600">{result.actualTimeRange || '-'}</span>
                        ) : (
                          <input
                            type="text"
                            value={editingActualTimeRangeIndex === index ? editingActualTimeRangeValue : (result.actualTimeRange || '')}
                            onChange={(e) => {
                              setEditingActualTimeRangeIndex(index);
                              setEditingActualTimeRangeValue(e.target.value);
                            }}
                            onFocus={() => {
                              setEditingActualTimeRangeIndex(index);
                              setEditingActualTimeRangeValue(result.actualTimeRange || '');
                            }}
                            onBlur={async () => {
                              const newActualTimeRange = editingActualTimeRangeValue;
                              const updatedResults = [...comparisonResults];
                              // actualWorkHours 재계산
                              // 🔥 부동소수점 오차 방지: 계산 후 반올림 (소수점 4자리까지)
                              const newActualWorkHours = Math.round((Math.max(0, parseTimeRangeToHours(newActualTimeRange) - (result.actualBreakTime || 0))) * 10000) / 10000;
                              // difference 재계산: 실제순근무시간 - 스케줄시간
                              const newDifference = newActualWorkHours - result.scheduledHours;
                              // status 재계산: 10분(0.17시간) 이상 차이나면 확인필요
                              let newStatus: 'time_match' | 'review_required' | 'review_completed' = 'time_match';
                              if (Math.abs(newDifference) >= 0.17) {
                                newStatus = 'review_required';
                              } else {
                                newStatus = 'time_match';
                              }
                              
                              updatedResults[index] = {
                                ...result,
                                actualTimeRange: newActualTimeRange,
                                actualWorkHours: newActualWorkHours,
                                difference: newDifference,
                                status: newStatus,
                                isModified: true
                              };
                              setComparisonResults(updatedResults);
                              setEditingActualTimeRangeIndex(null);
                              setEditingActualTimeRangeValue('');
                              // DB 저장 (비동기)
                              saveComparisonResults(updatedResults).catch(err => {
                                console.error('실근무시각 저장 실패:', err);
                              });
                            }}
                            className="w-30 px-2 py-1 border border-gray-300 rounded text-xs text-center"
                            placeholder="10:02-22:32"
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {!isEditable || result.status === 'review_completed' || isPayrollConfirmed(selectedEmployeeId) ? (
                          <span className="text-gray-600">
                            {(() => {
                              const actualBreakTime = result.actualBreakTime || 0;
                              const hours = Math.floor(actualBreakTime);
                              const minutes = Math.round((actualBreakTime - hours) * 60);
                              return `${hours}:${minutes.toString().padStart(2, '0')}`;
                            })()}
                          </span>
                        ) : (
                          <input
                            type="text"
                            value={editingBreakTimeIndex === index 
                              ? editingBreakTimeValue
                              : (() => {
                                  const actualBreakTime = result.actualBreakTime || 0;
                                  const hours = Math.floor(actualBreakTime);
                                  const minutes = Math.round((actualBreakTime - hours) * 60);
                                  return `${hours}:${minutes.toString().padStart(2, '0')}`;
                                })()
                            }
                            onChange={(e) => {
                              const timeStr = e.target.value;
                              // 편집 중인 값 업데이트
                              setEditingBreakTimeIndex(index);
                              setEditingBreakTimeValue(timeStr);
                            }}
                            onBlur={async (e) => {
                              // 포커스를 잃을 때 파싱 및 업데이트
                              const timeStr = e.target.value;
                              let newActualBreakTime = 0;
                              
                              if (timeStr.includes(':')) {
                                const parts = timeStr.split(':');
                                const h = parseInt(parts[0]) || 0;
                                const m = parseInt(parts[1]) || 0;
                                newActualBreakTime = h + (m / 60);
                              } else {
                                newActualBreakTime = parseFloat(timeStr) || 0;
                              }
                              
                              const updatedResults = [...comparisonResults];
                              // actualWorkHours 재계산
                              // 🔥 부동소수점 오차 방지: 계산 후 반올림 (소수점 4자리까지)
                              const newActualWorkHours = Math.round((Math.max(0, parseTimeRangeToHours(result.actualTimeRange || '') - newActualBreakTime)) * 10000) / 10000;
                              // difference 재계산: 실제순근무시간 - 스케줄시간
                              const newDifference = newActualWorkHours - result.scheduledHours;
                              // status 재계산: 10분(0.17시간) 이상 차이나면 확인필요
                              let newStatus = result.status;
                              if (Math.abs(newDifference) >= 0.17) {
                                newStatus = 'review_required';
                              } else {
                                newStatus = 'time_match';
                              }
                              
                              const updatedResult = {
                                ...result,
                                actualBreakTime: newActualBreakTime,
                                actualWorkHours: newActualWorkHours,
                                difference: newDifference,
                                status: newStatus,
                                isModified: true
                              };
                              updatedResults[index] = updatedResult;
                              
                              // 상태 업데이트 (먼저 업데이트하여 화면에 반영)
                              setComparisonResults(updatedResults);
                              setEditingBreakTimeIndex(null);
                              setEditingBreakTimeValue('');
                              
                              // DB에 즉시 저장 (비동기로 실행하되 상태는 이미 업데이트됨)
                              saveComparisonResults(updatedResults).catch(error => {
                                console.error('실휴게시간 저장 실패:', error);
                                // 저장 실패 시 사용자에게 알림하지 않고 조용히 실패 처리
                                // 상태는 이미 업데이트되어 있으므로 화면에는 반영됨
                              });
                            }}
                            onFocus={() => {
                              // 포커스를 받을 때 현재 값을 편집 값으로 설정
                              const actualBreakTime = result.actualBreakTime || 0;
                              const hours = Math.floor(actualBreakTime);
                              const minutes = Math.round((actualBreakTime - hours) * 60);
                              setEditingBreakTimeIndex(index);
                              setEditingBreakTimeValue(`${hours}:${minutes.toString().padStart(2, '0')}`);
                            }}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-xs text-center"
                            placeholder="0:30"
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        <span className="text-gray-600">
                          {(() => {
                            const actualWorkHours = result.actualWorkHours || 0;
                            const hours = Math.floor(actualWorkHours);
                            const minutes = Math.round((actualWorkHours - hours) * 60);
                            return `${hours}:${minutes.toString().padStart(2, '0')}`;
                          })()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {(() => {
                          const absDifference = Math.abs(result.difference);
                          const hours = Math.floor(absDifference);
                          const minutes = Math.round((absDifference - hours) * 60);
                          const sign = result.difference > 0 ? '+' : result.difference < 0 ? '-' : '';
                          return `${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(result.status)}`}>
                          {getStatusText(result.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {/* 연장근무시간은 정직원만 표시 */}
                        {(() => {
                          // 정직원인지 확인 (실제로는 직원 정보를 확인해야 함)
                          const isRegularEmployee = true; // 임시로 true, 실제로는 직원 타입 확인
                          if (!isRegularEmployee) return '-';
                          
                          // 연장근무시간 계산 (실제 근무시간 - 주간 근무시간)
                          const weeklyWorkHours = 40; // 기본값, 실제로는 직원 정보에서 가져와야 함
                          const overtimeHours = Math.max(0, result.actualHours - weeklyWorkHours);
                          
                          if (overtimeHours === 0) return '0:00';
                          
                          const hours = Math.floor(overtimeHours);
                          const minutes = Math.round((overtimeHours - hours) * 60);
                          return `${hours}:${minutes.toString().padStart(2, '0')}`;
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {/* 🔥 검토완료가 아니고, 급여확정도 안 되었을 때만 버튼 표시 (시간일치 포함) */}
                        {isEditable && (result.status === 'review_required' || result.status === 'review_completed' || result.status === 'time_match') && !isPayrollConfirmed(selectedEmployeeId) && (
                          <div className="flex space-x-2">
                            {result.status === 'review_completed' ? (
                              // 🔥 검토완료 상태: 확인완료 취소 버튼
                              <button
                                onClick={async () => {
                                  const updatedResults = [...comparisonResults];
                                  updatedResults[index] = {
                                    ...result,
                                    status: 'review_required',
                                    isModified: true
                                  };
                                  setComparisonResults(sortComparisonResults(updatedResults));
                                  
                                  // 🔥 비교 결과 테이블의 행별 확인 버튼은 상태를 변경하지 않음
                                  // 상태 변경은 지점별 검토상태 버튼에서만 이루어짐
                                  
                                  // DB에 저장
                                  await saveModifiedData(updatedResults[index]);
                                }}
                                className="bg-orange-600 text-white px-3 py-1 rounded text-xs hover:bg-orange-700"
                              >
                                확인완료취소
                              </button>
                            ) : (
                              // 미확인 상태: 확인 버튼
                              <>
                                <button
                                  onClick={async () => {
                                    const updatedResults = [...comparisonResults];
                                    updatedResults[index] = {
                                      ...result,
                                      status: 'review_completed',
                                      isModified: true
                                    };
                                    setComparisonResults(sortComparisonResults(updatedResults));
                                    
                                    // 🔥 비교 결과 테이블의 행별 확인 버튼은 상태를 변경하지 않음
                                    // 상태 변경은 지점별 검토상태 버튼에서만 이루어짐
                                    
                                    // DB에 저장
                                    await saveModifiedData(updatedResults[index]);
                                  }}
                                  className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                                >
                                  확인완료
                                </button>
                                {/* 🔥 스케줄시간복사 버튼: 확인완료 버튼 옆에만 표시 */}
                                {result.scheduledTimeRange && result.scheduledTimeRange !== '-' && (
                                  <button
                                    onClick={async () => {
                                      if (confirm('스케줄 시간을 실제 근무시간으로 복사하시겠습니까?')) {
                                        const updatedResults = [...comparisonResults];
                                        
                                        // 🔥 스케줄의 휴게시간도 함께 복사
                                        const scheduledBreakTime = result.breakTime || 0;
                                        
                                        updatedResults[index] = {
                                          ...result,
                                          actualHours: result.scheduledHours,
                                          actualTimeRange: result.scheduledTimeRange, // actualTimeRange = scheduledTimeRange
                                          actualBreakTime: scheduledBreakTime, // 🔥 스케줄 휴게시간 복사
                                          // 🔥 부동소수점 오차 방지: 계산 후 반올림 (소수점 4자리까지)
                                          actualWorkHours: Math.round((Math.max(0, parseTimeRangeToHours(result.scheduledTimeRange || '') - scheduledBreakTime)) * 10000) / 10000, // actualTimeRange에서 계산
                                          difference: 0, // 스케줄과 동일하므로 차이 0
                                          status: result.status === 'time_match' ? 'time_match' : 'review_completed', // 시간일치면 시간일치 유지, 아니면 확인완료
                                          isModified: true
                                        };
                                        setComparisonResults(sortComparisonResults(updatedResults));
                                        
                                        // 🔥 비교 결과 테이블의 행별 확인 버튼은 상태를 변경하지 않음
                                        // 상태 변경은 지점별 검토상태 버튼에서만 이루어짐
                                        
                                        // DB에 저장
                                        await saveModifiedData(updatedResults[index]);
                                      }
                                    }}
                                    className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                                  >
                                    스케줄시간복사
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              onClick={async () => {
                                if (!confirm('해당 비교 결과 행을 삭제하시겠습니까?')) {
                                  return;
                                }
                                const rowToDelete = comparisonResults[index];
                                
                                // DB에서도 삭제 (docId가 있는 경우)
                                if (rowToDelete.docId) {
                                  try {
                                    await deleteDoc(doc(db, 'workTimeComparisonResults', rowToDelete.docId));
                                    console.log('🔥 DB에서 비교결과 삭제됨:', rowToDelete.docId, '날짜:', rowToDelete.date);
                                  } catch (error) {
                                    console.error('DB 삭제 실패:', error);
                                    alert('삭제 중 오류가 발생했습니다.');
                                    return;
                                  }
                                }
                                
                                // 화면에서 제거
                                const updatedResults = sortComparisonResults(
                                  comparisonResults.filter((_, i) => i !== index)
                                );
                                setComparisonResults(updatedResults);
                                
                                // 삭제 후 데이터 다시 로드하여 최신 상태 확인
                                try {
                                  await loadExistingComparisonData();
                                  console.log('🔥 삭제 후 데이터 다시 로드 완료');
                                } catch (error) {
                                  console.error('데이터 다시 로드 실패:', error);
                                }
                              }}
                              className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700"
                            >
                              삭제
                            </button>
                          </div>
                        )}
                        
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr className="font-semibold">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    합계
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    {(() => {
                      const totalScheduled = comparisonResults.reduce((sum, result) => sum + result.scheduledHours, 0);
                      const hours = Math.floor(totalScheduled);
                      const minutes = Math.round((totalScheduled - hours) * 60);
                      return `${hours}:${minutes.toString().padStart(2, '0')}`;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    {(() => {
                      // POS근무시각 합계 - posTimeRange의 시간 계산
                      const totalPosTime = comparisonResults.reduce((sum, result) => {
                        return sum + parseTimeRangeToHours(result.posTimeRange || '');
                      }, 0);
                      const hours = Math.floor(totalPosTime);
                      const minutes = Math.round((totalPosTime - hours) * 60);
                      return `${hours}:${minutes.toString().padStart(2, '0')}`;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    {(() => {
                      // actualTimeRange의 총 시간 계산 (실근무시각(B) 합계)
                      const totalActualTimeRange = comparisonResults.reduce((sum, result) => {
                        return sum + parseTimeRangeToHours(result.actualTimeRange || '');
                      }, 0);
                      const hours = Math.floor(totalActualTimeRange);
                      const minutes = Math.round((totalActualTimeRange - hours) * 60);
                      return `${hours}:${minutes.toString().padStart(2, '0')}`;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    {(() => {
                      // 실휴게시간(C) 합계 - actualBreakTime 사용
                      const totalActualBreak = comparisonResults.reduce((sum, result) => sum + (result.actualBreakTime || 0), 0);
                      const hours = Math.floor(totalActualBreak);
                      const minutes = Math.round((totalActualBreak - hours) * 60);
                      return `${hours}:${minutes.toString().padStart(2, '0')}`;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    {(() => {
                      // 실근무시간 (D=B-C) 합계 - actualWorkHours 사용
                      const totalActualWork = comparisonResults.reduce((sum, result) => {
                        const hours = result.actualWorkHours || 0;
                        console.log(`🔥 합계 계산: ${result.date} = ${hours}시간 (actualWorkHours: ${result.actualWorkHours}, branchId: ${result.branchId})`);
                        return sum + hours;
                      }, 0);
                      console.log(`🔥🔥🔥 근무시간 비교 합계: ${totalActualWork}시간 (${comparisonResults.length}건)`);
                      const hours = Math.floor(totalActualWork);
                      const minutes = Math.round((totalActualWork - hours) * 60);
                      return `${hours}:${minutes.toString().padStart(2, '0')}`;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    {(() => {
                      // 차이 (A-D) 합계
                      const totalDifference = comparisonResults.reduce((sum, result) => sum + result.difference, 0);
                      const absDifference = Math.abs(totalDifference);
                      const hours = Math.floor(absDifference);
                      const minutes = Math.round((absDifference - hours) * 60);
                      const sign = totalDifference > 0 ? '+' : totalDifference < 0 ? '-' : '';
                      return `${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                      -
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    {(() => {
                      const totalOvertime = comparisonResults.reduce((sum, result) => {
                        const weeklyWorkHours = 40; // 기본값, 실제로는 직원 정보에서 가져와야 함
                        return sum + Math.max(0, result.actualHours - weeklyWorkHours);
                      }, 0);
                      
                      if (totalOvertime === 0) return '0:00';
                      
                      const hours = Math.floor(totalOvertime);
                      const minutes = Math.round((totalOvertime - hours) * 60);
                      return `${hours}:${minutes.toString().padStart(2, '0')}`;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {/* 합계 행에는 작업 버튼 없음 */}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          </div>
        )}

        {comparisonResults.length === 0 && selectedEmployeeId && selectedMonth && selectedBranchId && (
          <div className="px-6 py-12 text-center">
            <div className="text-gray-500 text-lg mb-2">📊</div>
            <div className="text-gray-500 text-lg mb-2">비교결과 데이터 없음</div>
            <div className="text-gray-400 text-sm">
              지점, 월, 직원을 선택하고 실제근무 데이터를 입력한 후<br />
              &quot;근무시간 비교&quot; 버튼을 클릭해주세요.
            </div>
          </div>
        )}
        
        {/* 요약 통계 */}
        {comparisonResults.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {comparisonResults.filter(r => r.status === 'time_match').length}
              </div>
              <div className="text-sm text-green-600">시간일치</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {comparisonResults.filter(r => r.status === 'review_required').length}
              </div>
              <div className="text-sm text-orange-600">확인필요</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {comparisonResults.filter(r => r.status === 'review_completed').length}
              </div>
              <div className="text-sm text-purple-600">확인완료</div>
            </div>
          </div>
        )}
      </div>
        );
      })()}
          </>
        );
      })()}

      {/* 급여메모 편집 - 항상 표시 */}
      {selectedEmployeeId && (
        <div className="mt-6 bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">급여메모</h3>
          </div>
          <div className="px-6 py-4 space-y-4">
            {/* 관리자용 메모 */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 text-sm">🔒</span>
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900 mb-2">급여메모 (관리자용)</h4>
                <textarea
                  value={employeeMemos[selectedEmployeeId]?.admin || ''}
                  onChange={(e) => {
                    const memo = e.target.value;
                    setEmployeeMemos(prev => ({
                      ...prev,
                      [selectedEmployeeId]: {
                        ...prev[selectedEmployeeId],
                        admin: memo
                      }
                    }));
                  }}
                  onBlur={(e) => {
                    const memo = e.target.value;
                    saveEmployeeMemo(selectedEmployeeId, memo, 'admin');
                  }}
                  placeholder="관리자용 메모를 입력하세요..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={3}
                />
              </div>
            </div>

            {/* 해당직원공지용 메모 */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-sm">📢</span>
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900 mb-2">급여메모 (해당직원공지용)</h4>
                <textarea
                  value={employeeMemos[selectedEmployeeId]?.employee || ''}
                  onChange={(e) => {
                    const memo = e.target.value;
                    setEmployeeMemos(prev => ({
                      ...prev,
                      [selectedEmployeeId]: {
                        ...prev[selectedEmployeeId],
                        employee: memo
                      }
                    }));
                  }}
                  onBlur={(e) => {
                    const memo = e.target.value;
                    saveEmployeeMemo(selectedEmployeeId, memo, 'employee');
                  }}
                  placeholder="해당직원조회용 메모를 입력하세요..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 전월 이월 연장근무시간 입력 팝업 */}
      {showOvertimePopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              전월 이월 연장근무시간 입력
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              최초 연장근무시간 계산을 위해 전월 이월 연장근무시간을 입력해주세요.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                전월 이월 연장근무시간 (시간)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={overtimeInput}
                onChange={(e) => setOvertimeInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 5.5"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowOvertimePopup(false);
                  setOvertimeInput('');
                  setPendingOvertimeCalculation(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                취소
              </button>
              <button
                onClick={() => {
                  const inputValue = parseFloat(overtimeInput);
                  if (!isNaN(inputValue) && inputValue >= 0) {
                    completeOvertimeCalculation(inputValue);
                  }
                }}
                disabled={!overtimeInput || isNaN(parseFloat(overtimeInput)) || parseFloat(overtimeInput) < 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
