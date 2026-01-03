'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from 'firebase/auth';
import WorkTimeComparison from '@/components/work-schedule/WorkTimeComparison';
import PayrollCalculation from '@/components/work-schedule/PayrollCalculation';
import { getPayrollMonth } from '@/utils/work-schedule/dateUtils';

interface Employee {
  id: string;
  name: string;
  employmentType: string;
  salaryType?: string;
  salaryAmount?: number;
  weeklyWorkHours?: number;
  includesWeeklyHolidayInWage?: boolean;
  branches: string[];
  probationStartDate?: Date;
  probationEndDate?: Date;
  resignationDate?: Date;
}

interface Branch {
  id: string;
  name: string;
}

interface PayrollStatus {
  employeeId: string;
  month: string;
  branchId: string;
  status: '미처리' | '근무시간검토중' | '근무시간검토완료' | '급여확정완료';
  lastUpdated: Date;
}

interface EmployeePayrollProcessingProps {
  user: User;
  userBranch?: {
    id: string;
    name: string;
  } | null;
  isManager: boolean;
  onMonthChange?: (month: string) => void;
  onEmployeeChange?: (employeeId: string) => void;
  onStatusChange?: () => void; // 상태 변경 시 호출되는 콜백
}

const EmployeePayrollProcessing: React.FC<EmployeePayrollProcessingProps> = ({ 
  userBranch, 
  isManager,
  onMonthChange,
  onEmployeeChange,
  onStatusChange
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(getPayrollMonth());
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('전체');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState<string>('전체');
  const [payrollStatuses, setPayrollStatuses] = useState<PayrollStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'work-comparison' | 'payroll-calculation'>('work-comparison');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true); // 좌측 패널 표시 여부
  const [contracts, setContracts] = useState<{
    id: string;
    employeeId: string;
    employeeName: string;
    employmentType: string;
    salaryType: string;
    hourlyWage?: number;
    monthlySalary?: number;
    probationStartDate?: Date;
    probationEndDate?: Date;
    startDate: Date;
    endDate?: Date;
    createdAt: Date;
    updatedAt: Date;
  }[]>([]);

  // 급여 처리 상태 새로고침 함수 (개별 직원용)
  const refreshEmployeeStatus = useCallback(async (employeeId: string) => {
    try {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) return;

      console.log(`\n=== ${employee.name} 상태 새로고침 ===`);
      
      // 1. 급여확정 상태 확인
      const payrollQuery = query(
        collection(db, 'confirmedPayrolls'),
        where('employeeId', '==', employeeId),
        where('month', '==', selectedMonth)
      );
      const payrollSnapshot = await getDocs(payrollQuery);
      
      // 2. 검토상태 확인
      const allReviewStatusQuery = query(
        collection(db, 'employeeReviewStatus'),
        where('employeeId', '==', employeeId),
        where('month', '==', selectedMonth)
      );
      const allReviewStatusSnapshot = await getDocs(allReviewStatusQuery);
      
      let status: '미처리' | '근무시간검토중' | '근무시간검토완료' | '급여확정완료' = '미처리';
      
      if (payrollSnapshot.docs.length > 0) {
        status = '급여확정완료';
      } else if (allReviewStatusSnapshot.docs.length > 0) {
        const employeeBranches = employee.branches || [];
        const allCompleted = employeeBranches.length > 0 && 
          employeeBranches.every(branchId => {
            const branchStatus = allReviewStatusSnapshot.docs.find(doc => doc.data().branchId === branchId);
            return branchStatus && (
              branchStatus.data().status === '검토완료' || 
              branchStatus.data().status === '근무시간검토완료' || 
              branchStatus.data().status === '급여확정완료'
            );
          });
        
        const hasInProgress = allReviewStatusSnapshot.docs.some(doc => 
          doc.data().status === '검토중' || doc.data().status === '근무시간검토중'
        );
        
        if (allCompleted) {
          status = '근무시간검토완료';
        } else if (hasInProgress) {
          status = '근무시간검토중';
        } else {
          status = '미처리';
        }
      }
      
      // 3. 상태 업데이트
      setPayrollStatuses(prev => {
        const updated = prev.map(p => 
          p.employeeId === employeeId 
            ? { ...p, status, lastUpdated: new Date() }
            : p
        );
        return updated;
      });
      
      console.log(`${employee.name} 상태 업데이트됨:`, status);
    } catch (error) {
      console.error('직원 상태 새로고침 실패:', error);
    }
  }, [employees, selectedMonth]);

  // 급여 처리 상태 로드 (해당월, 해당직원 기준)
  const loadPayrollStatuses = useCallback(async (employeesData: Employee[]) => {
    try {
      const statuses: PayrollStatus[] = [];
      
      for (const employee of employeesData) {
        console.log(`\n=== ${employee.name} (${employee.id}) 상태 확인 시작 ===`);
        
        // 급여확정 상태 확인 (해당월, 해당직원)
        const payrollQuery = query(
          collection(db, 'confirmedPayrolls'),
          where('employeeId', '==', employee.id),
          where('month', '==', selectedMonth)
        );
        const payrollSnapshot = await getDocs(payrollQuery);
        console.log(`${employee.name} 급여확정 상태:`, payrollSnapshot.docs.length > 0 ? '있음' : '없음');
        
        // 해당 직원의 모든 지점의 근무시간비교 검토상태 확인
        const allReviewStatusQuery = query(
          collection(db, 'employeeReviewStatus'),
          where('employeeId', '==', employee.id),
          where('month', '==', selectedMonth)
        );
        const allReviewStatusSnapshot = await getDocs(allReviewStatusQuery);
        console.log(`${employee.name} 검토상태 개수:`, allReviewStatusSnapshot.docs.length);
        
        let status: '미처리' | '근무시간검토중' | '근무시간검토완료' | '급여확정완료' = '미처리';
        
        if (payrollSnapshot.docs.length > 0) {
          status = '급여확정완료';
          console.log(`${employee.name} 최종 상태: 급여확정완료`);
        } else if (allReviewStatusSnapshot.docs.length > 0) {
          const employeeBranches = employee.branches || [];
          const allCompleted = employeeBranches.length > 0 && 
            employeeBranches.every(branchId => {
              const branchStatus = allReviewStatusSnapshot.docs.find(doc => doc.data().branchId === branchId);
              return branchStatus && (
                branchStatus.data().status === '검토완료' || 
                branchStatus.data().status === '근무시간검토완료' || 
                branchStatus.data().status === '급여확정완료'
              );
            });
          
          const hasInProgress = allReviewStatusSnapshot.docs.some(doc => 
            doc.data().status === '검토중' || doc.data().status === '근무시간검토중'
          );
          
          if (allCompleted) {
            status = '근무시간검토완료';
          } else if (hasInProgress) {
            status = '근무시간검토중';
          } else {
            status = '미처리';
          }
          
          console.log(`${employee.name} 최종 상태:`, status);
        }
        
        statuses.push({
          employeeId: employee.id,
          month: selectedMonth,
          branchId: selectedBranchId,
          status: status,
          lastUpdated: new Date()
        });
      }
      
      console.log('=== 최종 상태 목록 ===');
      statuses.forEach(s => {
        const employee = employeesData.find(e => e.id === s.employeeId);
        console.log(`${employee?.name}: ${s.status}`);
      });
      
      setPayrollStatuses(statuses);
    } catch (error) {
      console.error('급여 처리 상태 로드 실패:', error);
    }
  }, [selectedMonth, selectedBranchId]);

  // 전체 상태 새로고침 함수
  const refreshAllStatuses = useCallback(async () => {
    try {
      console.log('=== 전체 상태 새로고침 시작 ===');
      await loadPayrollStatuses(employees);
      console.log('=== 전체 상태 새로고침 완료 ===');
    } catch (error) {
      console.error('전체 상태 새로고침 실패:', error);
    }
  }, [employees, loadPayrollStatuses]);

  // 글로벌 상태 새로고침 함수 (window 객체에 등록)
  useEffect(() => {
    // 개별 직원 새로고침 함수 등록
    (window as unknown as { refreshEmployeeStatus?: (id: string) => void }).refreshEmployeeStatus = refreshEmployeeStatus;
    return () => {
      delete (window as unknown as { refreshEmployeeStatus?: (id: string) => void }).refreshEmployeeStatus;
    };
  }, [refreshEmployeeStatus]);

  // 🔥 통합 데이터 로드 (무한루프 방지)
  const loadAllData = useCallback(async () => {
    if (!selectedMonth) return;
    
    setLoading(true);
    try {
      console.log('=== 데이터 로드 시작:', selectedMonth, '===');
      
      // 해당월 계산
      const targetDate = new Date(selectedMonth);
      const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
      const now = new Date();
      
      // 🔥 병렬로 조회 (JOIN 대신)
      const [employeesSnapshot, contractsSnapshot, employeeBranchesSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'employees'), orderBy('name'))),
        getDocs(collection(db, 'employmentContracts')),
        getDocs(collection(db, 'employeeBranches'))
      ]);
      
      console.log('Firestore 조회 완료:', {
        직원수: employeesSnapshot.docs.length,
        계약수: contractsSnapshot.docs.length,
        직원지점관계수: employeeBranchesSnapshot.docs.length
      });
      
      // 직원-지점 관계 맵 생성
      const employeeBranchesMap = new Map<string, string[]>();
      employeeBranchesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const employeeId = data.employeeId;
        const branchId = data.branchId;
        if (employeeId && branchId) {
          if (!employeeBranchesMap.has(employeeId)) {
            employeeBranchesMap.set(employeeId, []);
          }
          employeeBranchesMap.get(employeeId)!.push(branchId);
        }
      });
      
      console.log('직원-지점 관계 맵:', Array.from(employeeBranchesMap.entries()).slice(0, 5));
      
      // 1. 직원 데이터 변환 (재직중인 직원만)
      const allEmployees = employeesSnapshot.docs
        .map(doc => {
          const data = doc.data();
          // employeeBranches 컬렉션에서 실제 근무 지점 정보 가져오기
          const branchIds = employeeBranchesMap.get(doc.id) || [];
          return {
            id: doc.id,
            name: data.name,
            // employmentType은 employmentContracts에서 가져오므로 여기서는 제거
            salaryType: data.salaryType,
            weeklyWorkHours: data.weeklyWorkHours, // 기본값 설정을 위해 추가
            branches: branchIds.length > 0 ? branchIds : (data.branches && data.branches.length > 0 ? data.branches : (data.branchId ? [data.branchId] : [])),
            hireDate: data.hireDate?.toDate ? data.hireDate.toDate() : data.hireDate,
            probationStartDate: data.probationStartDate?.toDate ? data.probationStartDate.toDate() : data.probationStartDate,
            probationEndDate: data.probationEndDate?.toDate ? data.probationEndDate.toDate() : data.probationEndDate,
            resignationDate: data.resignationDate?.toDate ? data.resignationDate.toDate() : data.resignationDate
          };
        })
        .filter(employee => {
          // 해당월에 근무가 걸쳐있는 직원만 (입사일/퇴사일 기준)
          const hireDate = employee.hireDate?.toDate ? employee.hireDate.toDate() : 
                          employee.hireDate ? new Date(employee.hireDate) : null;
          const resignationDate = employee.resignationDate;
          
          // 입사일이 없으면 제외
          if (!hireDate) return false;
          
          // 선택된 월의 시작일과 끝일 계산
          const [year, month] = selectedMonth.split('-').map(Number);
          const monthStart = new Date(year, month - 1, 1);
          const monthEnd = new Date(year, month, 0, 23, 59, 59);
          
          // 입사일이 해당월 이후면 제외
          if (hireDate > monthEnd) return false;
          
          // 퇴사일이 있고, 퇴사일이 해당월 이전이면 제외
          if (resignationDate && resignationDate < monthStart) return false;
          
          return true;
        });
      
      console.log('재직중인 직원:', allEmployees.length, '명');
      console.log('재직중인 직원 목록:', allEmployees.map(e => e.name));
      
      // 조선아 직원이 재직중인 직원 목록에 있는지 확인
      const choSunAh = allEmployees.find(e => e.name === '조선아');
      if (choSunAh) {
        console.log('조선아 직원 재직중 목록에 있음:', choSunAh);
        console.log('조선아 직원의 employeeId:', choSunAh.id);
      } else {
        console.log('조선아 직원이 재직중인 직원 목록에 없음');
      }
      
      // 2. 계약 데이터 변환 (해당월에 유효한 계약만)
      const validContracts = contractsSnapshot.docs
        .map(doc => {
          const data = doc.data();
          console.log('🔥 계약서 데이터:', doc.id, data);
          return {
            id: doc.id,
            employeeId: data.employeeId,
            employeeName: data.employeeName,
            employmentType: data.employmentType,
            salaryType: data.salaryType,
            salaryAmount: data.salaryAmount,
            weeklyWorkHours: data.weeklyWorkHours,
            includeHolidayAllowance: data.includeHolidayAllowance,
            probationStartDate: data.probationStartDate?.toDate ? data.probationStartDate.toDate() : data.probationStartDate,
            probationEndDate: data.probationEndDate?.toDate ? data.probationEndDate.toDate() : data.probationEndDate,
            startDate: data.startDate?.toDate ? data.startDate.toDate() : data.startDate,
            endDate: data.endDate?.toDate ? data.endDate.toDate() : data.endDate,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
          };
        })
        .filter(contract => {
          // 해당월에 유효한 계약만
          const startDate = contract.startDate;
          const endDate = contract.endDate;
          
          if (!startDate) return false;
          
          const isStartValid = startDate <= monthEnd;
          const isEndValid = !endDate || endDate >= monthStart;
          
          return isStartValid && isEndValid;
        });
      
      console.log('해당월 유효한 계약:', validContracts.length, '건');
      
      // 조선아와 관련된 계약서 확인
      const choSunAhContracts = validContracts.filter(contract => 
        contract.employeeName === '조선아'
      );
      console.log('조선아 관련 계약서:', choSunAhContracts.length, '건');
      if (choSunAhContracts.length > 0) {
        console.log('조선아 계약서 상세:', choSunAhContracts);
      }
      
      // 3. 메모리 JOIN: 유효한 계약이 있는 직원만 필터링하고 계약서 정보 병합
      const employeesWithContracts = allEmployees
        .filter(employee =>
          validContracts.some(contract => contract.employeeId === employee.id)
        )
        .map(employee => {
          const contract = validContracts.find(c => c.employeeId === employee.id);
          return {
            ...employee,
            // 계약서에서 급여 정보 가져오기
            employmentType: contract?.employmentType || '',
            salaryType: contract?.salaryType || employee.salaryType,
            salaryAmount: contract?.salaryAmount || 0,
            weeklyWorkHours: contract?.weeklyWorkHours || employee.weeklyWorkHours || 40,
            includesWeeklyHolidayInWage: contract?.includeHolidayAllowance || false,
            // 수습기간: 무조건 직원 기본 정보에서 가져오기 (계약서에는 없음)
            probationStartDate: employee.probationStartDate,
            probationEndDate: employee.probationEndDate
          };
        });
      
      console.log('계약이 있는 직원:', employeesWithContracts.length, '명');
      console.log('계약이 있는 직원 목록:', employeesWithContracts.map(emp => ({
        name: emp.name,
        employmentType: emp.employmentType,
        salaryType: emp.salaryType,
        salaryAmount: emp.salaryAmount
      })));
      
      // 나인 직원의 계약서 정보 상세 확인
      console.log('🔥 전체 직원 목록:', allEmployees.map(emp => ({ id: emp.id, name: emp.name })));
      console.log('🔥 유효한 계약 목록:', validContracts.map(c => ({ 
        id: c.id, 
        employeeId: c.employeeId, 
        employeeName: c.employeeName,
        salaryAmount: c.salaryAmount,
        salaryType: c.salaryType,
        startDate: c.startDate,
        endDate: c.endDate
      })));
      
      const nainEmployee = allEmployees.find(emp => emp.name === '나인');
      if (nainEmployee) {
        console.log('🔥 나인 직원 기본 정보:', nainEmployee);
        const nainContract = validContracts.find(c => c.employeeId === nainEmployee.id);
        console.log('🔥 나인 직원 계약서:', nainContract);
      } else {
        console.log('🔥 나인 직원을 allEmployees에서 찾을 수 없음');
      }
      
      const nainEmployeeWithContract = employeesWithContracts.find(emp => emp.name === '나인');
      if (nainEmployeeWithContract) {
        console.log('🔥 나인 직원 계약서 상세:', {
          employee: nainEmployeeWithContract,
          contract: validContracts.find(c => c.employeeId === nainEmployeeWithContract.id)
        });
        console.log('🔥 나인 직원 수습기간 데이터:', {
          probationStartDate: nainEmployeeWithContract.probationStartDate,
          probationEndDate: nainEmployeeWithContract.probationEndDate,
          selectedMonth: selectedMonth
        });
      } else {
        console.log('🔥 나인 직원이 employeesWithContracts에 없음');
      }
      
      // 4. 한 번에 상태 업데이트 (무한루프 방지!)
      console.log('최종 직원 목록:', employeesWithContracts.map(e => e.name));
      console.log('조선아 직원 확인:', employeesWithContracts.find(e => e.name === '조선아'));
      setEmployees(employeesWithContracts);
      setContracts(validContracts);
      
      // 5. 급여 처리 상태 로드
      await loadPayrollStatuses(employeesWithContracts);
      
      console.log('=== 데이터 로드 완료 ===');
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, loadPayrollStatuses]);

  // 🔥 최적화: selectedBranchId 자동 설정 제거
  // 사용자가 선택한 지점 필터를 유지하고, 직원 선택 시 자동으로 변경하지 않음
  // useEffect(() => {
  //   if (selectedEmployee && selectedEmployee.branches && selectedEmployee.branches.length > 0 && selectedBranchId === undefined) {
  //     setSelectedBranchId(selectedEmployee.branches[0]);
  //     console.log('EmployeePayrollProcessing - selectedBranchId 자동 설정:', selectedEmployee.branches[0]);
  //   }
  // }, [selectedEmployee, selectedBranchId]);


  // 지점 목록 로드
  const loadBranches = useCallback(async () => {
    try {
      const branchesQuery = query(collection(db, 'branches'), orderBy('name'));
      const branchesSnapshot = await getDocs(branchesQuery);
      const branchesData = branchesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      
      setBranches(branchesData);
      
      // 관리자, 매니저 모두 전지점 기본 선택
      // (매니저는 필터가 보이지 않으므로 실제로는 자신의 지점만 보임)
      setSelectedBranchId(''); // 전지점 기본 선택
    } catch (error) {
      console.error('지점 목록 로드 실패:', error);
    }
  }, []);

  // selectedMonth 기본값은 getPayrollMonth()로 처리

  // 🔥 최적화: 지점 목록은 컴포넌트 마운트 시 한 번만
  useEffect(() => {
    loadBranches();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 🔥 최적화: 월이 변경될 때 통합 데이터 로드 (무한루프 방지)
  useEffect(() => {
    if (selectedMonth) {
      loadAllData();
    }
  }, [selectedMonth, loadAllData]);
  
  // 🔥 임시: 직원 데이터가 없을 때 강제로 로드
  useEffect(() => {
    if (selectedMonth && employees.length === 0) {
      console.log('🔥 직원 데이터가 없어서 강제로 loadAllData 호출');
      loadAllData();
    }
  }, [selectedMonth, employees.length, loadAllData]);

  // 필터링된 직원 목록
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === '전체' || 
      payrollStatuses.find(status => status.employeeId === employee.id)?.status === statusFilter;
    
    // 지점 필터링
    const matchesBranch = selectedBranchId === '' || 
      (employee.branches && employee.branches.includes(selectedBranchId));
    
    // 고용형태 필터링
    const matchesEmploymentType = employmentTypeFilter === '전체' || (() => {
      const contract = contracts.find(contract => contract.employeeId === employee.id);
      if (!contract) return employmentTypeFilter === '근로계약정보 없음';
      
      const employmentType = contract.employmentType;
      switch (employmentType) {
        case '근로소득':
          return employmentTypeFilter === '근로소득자';
        case '사업소득':
          return employmentTypeFilter === '사업소득자';
        case '외국인':
          return employmentTypeFilter === '외국인';
        case '일용직':
          return employmentTypeFilter === '일용직';
        default:
          return employmentTypeFilter === employmentType;
      }
    })();
    
    // 조선아 직원 디버깅
    if (employee.name === '조선아') {
      console.log('조선아 직원 필터링 결과:', {
        matchesSearch,
        matchesStatus,
        matchesBranch,
        matchesEmploymentType,
        selectedBranchId,
        employeeBranches: employee.branches,
        employmentTypeFilter,
        contract: contracts.find(contract => contract.employeeId === employee.id)
      });
    }
    
    return matchesSearch && matchesStatus && matchesBranch && matchesEmploymentType;
  });

  // 직원 선택 핸들러
  const handleEmployeeSelect = (employee: Employee) => {
    setSelectedEmployee(employee);
    setSelectedEmployeeId(employee.id);
    console.log('EmployeePayrollProcessing - 직원 선택됨:', employee.name, employee.id);
    onEmployeeChange?.(employee.id);
    console.log('EmployeePayrollProcessing - onEmployeeChange 호출됨:', employee.id);
    console.log('선택된 직원:', employee);
    console.log('선택된 직원의 지점:', employee.branches);
  };

  // 상태별 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case '미처리': return 'text-red-600 bg-red-50';
      case '근무시간검토중': return 'text-yellow-600 bg-yellow-50';
      case '근무시간검토완료': return 'text-blue-600 bg-blue-50';
      case '급여계산완료': return 'text-purple-600 bg-purple-50';
      case '급여확정완료': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">직원별 급여처리</h1>
        <p className="text-gray-600 mt-1">직원별로 근무시간 비교 및 급여계산을 체계적으로 관리합니다</p>
      </div>

      {/* 상단 컨트롤 - 월 선택 및 새로고침 */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">처리할 월</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                onMonthChange?.(e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={refreshAllStatuses}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              🔄 상태 새로고침
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 relative">
        {/* 접기/펼치기 버튼 */}
        <button
          onClick={() => setIsLeftPanelVisible(!isLeftPanelVisible)}
          className="absolute left-0 top-0 z-10 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-r-lg shadow-lg transition-all"
          style={{ 
            left: isLeftPanelVisible ? '318px' : '0', // w-80 = 320px - 2px
            transition: 'left 0.3s ease'
          }}
          title={isLeftPanelVisible ? '직원 목록 숨기기' : '직원 목록 보기'}
        >
          {isLeftPanelVisible ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>
        
        {/* 좌측: 직원 목록 */}
        {isLeftPanelVisible && (
        <div className="w-80 flex-shrink-0 transition-all duration-300">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-900">직원 목록</h3>
              <p className="text-sm text-gray-500 mt-1">
                총 {filteredEmployees.length}명
              </p>
            </div>
            
            {/* 검색 및 필터 */}
            <div className="p-4 border-b border-gray-200 space-y-3">
              {/* 검색 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">직원 검색</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="직원명으로 검색..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              
              {/* 지점 필터 */}
              {!isManager && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">지점 필터</label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">전지점</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* 상태 필터 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상태 필터</label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="전체">전체</option>
                        <option value="미처리">미처리</option>
                        <option value="근무시간검토중">근무시간검토중</option>
                        <option value="근무시간검토완료">근무시간검토완료</option>
                        <option value="급여계산완료">급여계산완료</option>
                        <option value="급여확정완료">급여확정완료</option>
                      </select>
              </div>
              
              {/* 고용형태 필터 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">고용형태 필터</label>
                <select
                  value={employmentTypeFilter}
                  onChange={(e) => setEmploymentTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="전체">전체</option>
                  <option value="근로소득자">근로소득자</option>
                  <option value="사업소득자">사업소득자</option>
                  <option value="외국인">외국인</option>
                  <option value="일용직">일용직</option>
                  <option value="근로계약정보 없음">근로계약정보 없음</option>
                </select>
              </div>
            </div>
            
            <div>
              {loading ? (
                <div className="p-4 text-center text-gray-500">로딩 중...</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-4 text-center text-gray-500">직원이 없습니다</div>
              ) : (
                (() => {
                  console.log('직원 목록 렌더링:', filteredEmployees.length, '명');
                  return filteredEmployees.map(employee => {
                  const status = payrollStatuses.find(s => s.employeeId === employee.id)?.status || '미처리';
                  const isSelected = selectedEmployeeId === employee.id;
                  
                  return (
                    <div
                      key={employee.id}
                      onClick={() => {
                        console.log('직원 클릭됨:', employee.name);
                        handleEmployeeSelect(employee);
                      }}
                      className={`p-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                        isSelected ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 flex items-center text-sm">
                            {employee.name}
                            {(() => {
                              // 직원관리와 동일한 로직: contracts 배열에서 해당 직원의 계약서 확인
                              const hasContract = contracts.some(contract => contract.employeeId === employee.id);
                              // 디버깅용 로그 제거
                              // if (employee.name === '김상미') {
                              //   console.log('김상미 계약서 확인:', {
                              //     employeeId: employee.id,
                              //     hasContract,
                              //     contractsCount: contracts.length,
                              //     contracts: contracts.filter(c => c.employeeId === employee.id)
                              //   });
                              // }
                              return !hasContract && (
                                <span className="ml-2 text-red-500 text-sm" title="근로계약정보 없음">⚠️</span>
                              );
                            })()}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {(() => {
                              // 해당 직원의 근로계약정보에서 고용형태 가져오기
                              const contract = contracts.find(contract => contract.employeeId === employee.id);
                              if (!contract) {
                                return '근로계약정보 없음';
                              }
                              
                              // 근로계약정보의 employmentType 사용
                              const employmentType = contract.employmentType;
                              if (!employmentType) {
                                return '미설정';
                              }
                              
                              // 고용형태 표시명 변환
                              switch (employmentType) {
                                case '근로소득':
                                  return '근로소득자';
                                case '사업소득':
                                  return '사업소득자';
                                case '외국인':
                                  return '외국인';
                                case '일용직':
                                  return '일용직';
                                default:
                                  return employmentType;
                              }
                            })()} | {(() => {
                              // 해당 직원의 근로계약정보에서 급여형태 가져오기
                              const contract = contracts.find(contract => contract.employeeId === employee.id);
                              if (!contract) {
                                return '미설정';
                              }
                              // 급여타입 한글 변환
                              switch (contract.salaryType) {
                                case 'hourly':
                                  return '시급';
                                case 'monthly':
                                  return '월급';
                                default:
                                  return contract.salaryType || '시급';
                              }
                            })()}
                          </div>
                        </div>
                        <div className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                          {status}
                        </div>
                      </div>
                    </div>
                  );
                });
                })()
              )}
            </div>
          </div>
        </div>
        )}

        {/* 우측: 탭 콘텐츠 */}
        <div className={isLeftPanelVisible ? 'flex-1' : 'w-full'}>
          {selectedEmployee ? (
            <>
              {/* 선택된 직원 표시 - 흰색 상자 바깥 */}
              {selectedEmployeeId && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-lg shadow-sm mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <svg className="h-4 w-4 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          현재 선택된 직원
                        </p>
                        <p className="text-xs text-gray-600">
                          근무시간비교 및 급여계산 작업에 사용됩니다
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {selectedEmployee?.name || selectedEmployeeId}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 탭 메뉴가 있는 흰색 상자 */}
              <div className="bg-white rounded-lg shadow">
                {/* 탭 헤더 */}
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  <button
                    onClick={() => setActiveTab('work-comparison')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'work-comparison'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    근무시간비교
                  </button>
                  <button
                    onClick={() => {
                      console.log('EmployeePayrollProcessing - 급여계산작업 탭 클릭됨');
                      console.log('EmployeePayrollProcessing - 이전 activeTab:', activeTab);
                      setActiveTab('payroll-calculation');
                      console.log('EmployeePayrollProcessing - 새로운 activeTab 설정됨: payroll-calculation');
                    }}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'payroll-calculation'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    급여계산작업
                  </button>
                </nav>
              </div>

              {/* 탭 콘텐츠 */}
              <div className="p-6">
                {activeTab === 'work-comparison' && (
                  <WorkTimeComparison 
                    userBranch={selectedBranchId ? branches.find(b => b.id === selectedBranchId) : undefined}
                    isManager={isManager}
                    selectedEmployeeId={selectedEmployeeId}
                    selectedMonth={selectedMonth}
                    selectedBranchId={selectedBranchId}
                    hideEmployeeSelection={true}
                    hideBranchSelection={true}
                    selectedEmployeeBranches={selectedEmployee?.branches || []}
                    onStatusChange={onStatusChange}
                  />
                )}

                {activeTab === 'payroll-calculation' && (
                  <>
                    {console.log('EmployeePayrollProcessing - PayrollCalculation 렌더링 조건:', { activeTab, selectedEmployeeId, selectedMonth })}
                    {console.log('🔥 PayrollCalculation에 전달되는 employees:', employees.length, employees)}
            <PayrollCalculation
              selectedEmployeeId={selectedEmployeeId}
              selectedMonth={selectedMonth}
              employees={employees}
              onPayrollStatusChange={() => {
                // 급여확정 상태 변경 시 직원 목록과 상태 다시 로드
                loadAllData();
                onStatusChange?.(); // 상태 변경 콜백 호출
              }}
            />
                  </>
                )}
              </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {/* 선택된 직원 표시 */}
              {selectedEmployeeId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-blue-700">
                          <span className="font-medium">현재 선택된 직원:</span> 
                          <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                            {selectedEmployeeId}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-blue-600">
                      근무시간비교 • 급여계산작업에서 사용됩니다
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-gray-400 text-lg mb-2">👥</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">직원을 선택하세요</h3>
                <p className="text-gray-600">좌측에서 직원을 선택하면 근무시간비교 및 급여계산 작업을 진행할 수 있습니다.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeePayrollProcessing;
