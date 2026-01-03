'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getPayrollMonth } from '@/utils/work-schedule/dateUtils';

interface ShortTermWorker {
  id: string;
  branchId: string;
  branchName: string;
  month: string;
  name: string;
  socialSecurityNumber: string; // 주민번호 (마스킹 처리)
  phoneNumber: string; // 핸드폰 번호
  workType: 'hourly' | 'fixed'; // 근무형태: 시급 또는 총금액
  hourlyWage: number;
  fixedAmount: number; // 총금액인 경우
  totalWorkHours: number;
  totalPay: number;
  depositAmount: number;
  depositDate: string;
  notes: string;
  workDetails: WorkDetail[];
  depositDetails: DepositDetail[];
  // 계좌정보
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DepositDetail {
  id: string;
  depositDate: string;
  depositAmount: number;
  notes: string;
}

interface WorkDetail {
  id: string;
  workDate: string;
  startTime: string;
  endTime: string;
  breakTime: number; // 분 단위
  workHours: number; // 시간 단위
  notes?: string;
}

interface Branch {
  id: string;
  name: string;
}

interface ShortTermWorkerManagementProps {
  userBranch?: {
    id: string;
    name: string;
  } | null;
  isManager?: boolean;
}

export default function ShortTermWorkerManagement({ userBranch, isManager }: ShortTermWorkerManagementProps) {
  const [workers, setWorkers] = useState<ShortTermWorker[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingWorker, setEditingWorker] = useState<ShortTermWorker | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(getPayrollMonth());
  const [showEditModal, setShowEditModal] = useState(false);
  const [workerToEdit, setWorkerToEdit] = useState<ShortTermWorker | null>(null);
  const [bankCodes, setBankCodes] = useState<Array<{code: string, name: string}>>([]);

  // 새 직원 추가 폼 상태
  const [newWorker, setNewWorker] = useState({
    branchId: '',
    name: '',
    socialSecurityNumber: '',
    phoneNumber: '',
    workType: 'hourly' as 'hourly' | 'fixed',
    hourlyWage: 0,
    fixedAmount: 0,
    notes: '',
    bankName: '',
    accountNumber: '',
    accountHolder: ''
  });


  // 엑셀형 근무 추가 상태
  const [showExcelForm, setShowExcelForm] = useState(false);
  const [excelWorkDetails, setExcelWorkDetails] = useState<Array<{
    workDate: string;
    startTime: string;
    endTime: string;
    breakTime: number;
    notes: string;
  }>>([{ workDate: '', startTime: '', endTime: '', breakTime: 0, notes: '' }]);

  // 입금내역 추가 상태
  const [showDepositForm, setShowDepositForm] = useState<{[key: string]: boolean}>({});
  const [newDepositDetail, setNewDepositDetail] = useState<{
    depositDate: string;
    depositAmount: number;
    notes: string;
  }>({
    depositDate: '',
    depositAmount: 0,
    notes: ''
  });

  // 근무내역 수정 상태
  const [editingWorkDetail, setEditingWorkDetail] = useState<{[key: string]: boolean}>({});
  const [editWorkDetail, setEditWorkDetail] = useState<{
    workDate: string;
    startTime: string;
    endTime: string;
    breakTime: number;
    notes: string;
  }>({
    workDate: '',
    startTime: '',
    endTime: '',
    breakTime: 0,
    notes: ''
  });

  // 입금내역 수정 상태
  const [editingDepositDetail, setEditingDepositDetail] = useState<{[key: string]: boolean}>({});
  const [editDepositDetail, setEditDepositDetail] = useState<{
    depositDate: string;
    depositAmount: number;
    notes: string;
  }>({
    depositDate: '',
    depositAmount: 0,
    notes: ''
  });

  // 지점 목록 로드
  const loadBranches = async () => {
    try {
      const branchesSnapshot = await getDocs(collection(db, 'branches'));
      const branchesData = branchesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setBranches(branchesData);
    } catch (error) {
      console.error('지점 목록 로드 실패:', error);
    }
  };

  // 단기알바 목록 로드
  const loadWorkers = async () => {
    if (!selectedMonth) {
      setWorkers([]);
      return;
    }

    setLoading(true);
    try {
      let workersQuery;
      
      if (isManager && userBranch) {
        // 매니저는 자신의 지점만 조회
        workersQuery = query(
          collection(db, 'shortTermWorkers'),
          where('branchId', '==', userBranch.id),
          where('month', '==', selectedMonth),
          orderBy('createdAt', 'desc')
        );
      } else {
        // 관리자는 모든 지점 조회
        workersQuery = query(
          collection(db, 'shortTermWorkers'),
          where('month', '==', selectedMonth),
          orderBy('createdAt', 'desc')
        );
      }

      const workersSnapshot = await getDocs(workersQuery);
      const workersData = workersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as ShortTermWorker;
      });


      setWorkers(workersData);
    } catch (error) {
      console.error('단기알바 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 근무시간 계산
  const calculateWorkHours = (startTime: string, endTime: string, breakTime: number): number => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.max(0, diffHours - (breakTime / 60));
  };

  // 총 근무시간 계산
  const calculateTotalWorkHours = (workDetails: WorkDetail[]): number => {
    return workDetails.reduce((total, detail) => total + detail.workHours, 0);
  };

  // 총 급여 계산
  const calculateTotalPay = (workType: 'hourly' | 'fixed' | undefined, hourlyWage: number | undefined, totalWorkHours: number | undefined, fixedAmount: number | undefined = 0): number => {
    const safeWorkType = workType || 'hourly';
    const safeHourlyWage = hourlyWage || 0;
    const safeTotalWorkHours = totalWorkHours || 0;
    const safeFixedAmount = fixedAmount || 0;
    
    if (safeWorkType === 'fixed') {
      return safeFixedAmount;
    }
    return Math.round(safeHourlyWage * safeTotalWorkHours);
  };

  // 주민번호 마스킹
  const maskSocialSecurityNumber = (ssn: string): string => {
    if (ssn.length >= 8) {
      return ssn.substring(0, 6) + '****';
    }
    return ssn;
  };

  // 시간 포맷팅
  const formatTime = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  // 근무 상세 토글
  const toggleWorkDetails = (workerId: string) => {
    setExpandedWorker(expandedWorker === workerId ? null : workerId);
  };

  // 새 직원 추가
  const handleAddWorker = async () => {
    // 필수항목 검증
    if (!newWorker.branchId || !newWorker.name || !newWorker.socialSecurityNumber) {
      alert('지점, 이름, 주민번호는 필수항목입니다.');
      return;
    }

    if (!selectedMonth) {
      alert('월을 선택해주세요.');
      return;
    }

    // 근무형태별 검증
    if (newWorker.workType === 'hourly' && newWorker.hourlyWage <= 0) {
      alert('시급을 입력해주세요.');
      return;
    }

    if (newWorker.workType === 'fixed' && newWorker.fixedAmount <= 0) {
      alert('총금액을 입력해주세요.');
      return;
    }

    try {
      const branch = branches.find(b => b.id === newWorker.branchId);
      const workerData = {
        branchId: newWorker.branchId,
        branchName: branch?.name || '',
        month: selectedMonth,
        name: newWorker.name,
        socialSecurityNumber: newWorker.socialSecurityNumber,
        phoneNumber: newWorker.phoneNumber,
        workType: newWorker.workType,
        hourlyWage: newWorker.workType === 'hourly' ? newWorker.hourlyWage : 0,
        fixedAmount: newWorker.workType === 'fixed' ? newWorker.fixedAmount : 0,
        totalWorkHours: 0,
        totalPay: newWorker.workType === 'fixed' ? newWorker.fixedAmount : 0,
        depositAmount: 0,
        depositDate: '',
        notes: newWorker.notes,
        workDetails: [],
        depositDetails: [],
        bankName: newWorker.bankName,
        accountNumber: newWorker.accountNumber,
        accountHolder: newWorker.accountHolder,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await addDoc(collection(db, 'shortTermWorkers'), workerData);
      setNewWorker({ 
        branchId: '', 
        name: '', 
        socialSecurityNumber: '', 
        phoneNumber: '', 
        workType: 'hourly',
        hourlyWage: 0,
        fixedAmount: 0,
        notes: '', 
        bankName: '', 
        accountNumber: '', 
        accountHolder: '' 
      });
      setShowAddForm(false);
      loadWorkers();
    } catch (error) {
      console.error('직원 추가 실패:', error);
      alert('직원 추가에 실패했습니다.');
    }
  };


  // 입금 정보 업데이트
  const handleUpdateDeposit = async (workerId: string, depositAmount: number, depositDate: string) => {
    try {
      await updateDoc(doc(db, 'shortTermWorkers', workerId), {
        depositAmount: depositAmount,
        depositDate: depositDate,
        updatedAt: new Date()
      });
      loadWorkers();
    } catch (error) {
      console.error('입금 정보 업데이트 실패:', error);
      alert('입금 정보 업데이트에 실패했습니다.');
    }
  };

  // 입금 상세 추가
  const handleAddDepositDetail = async (workerId: string, depositDate: string, depositAmount: number, notes: string) => {
    try {
      const worker = workers.find(w => w.id === workerId);
      if (!worker) return;

      const newDeposit: DepositDetail = {
        id: Date.now().toString(),
        depositDate: depositDate,
        depositAmount: depositAmount,
        notes: notes
      };

      const updatedDepositDetails = [...(worker.depositDetails || []), newDeposit];

      await updateDoc(doc(db, 'shortTermWorkers', workerId), {
        depositDetails: updatedDepositDetails,
        updatedAt: new Date()
      });

      // 폼 초기화
      setNewDepositDetail({
        depositDate: '',
        depositAmount: 0,
        notes: ''
      });
      setShowDepositForm(prev => ({ ...prev, [workerId]: false }));

      loadWorkers();
    } catch (error) {
      console.error('입금 상세 추가 실패:', error);
      alert('입금 상세 추가에 실패했습니다.');
    }
  };

  // 입금내역 인라인 추가
  const handleInlineAddDeposit = async (workerId: string) => {
    if (!newDepositDetail.depositDate || newDepositDetail.depositAmount <= 0) {
      alert('입금일과 입금액을 입력해주세요.');
      return;
    }

    await handleAddDepositDetail(
      workerId,
      newDepositDetail.depositDate,
      newDepositDetail.depositAmount,
      newDepositDetail.notes
    );
  };

  // 근무내역 수정 시작
  const handleStartEditWorkDetail = (workerId: string, detail: WorkDetail) => {
    setEditWorkDetail({
      workDate: detail.workDate,
      startTime: detail.startTime,
      endTime: detail.endTime,
      breakTime: detail.breakTime,
      notes: detail.notes || ''
    });
    setEditingWorkDetail(prev => ({ ...prev, [detail.id]: true }));
  };

  // 근무내역 수정 취소
  const handleCancelEditWorkDetail = (detailId: string) => {
    setEditingWorkDetail(prev => ({ ...prev, [detailId]: false }));
    setEditWorkDetail({
      workDate: '',
      startTime: '',
      endTime: '',
      breakTime: 0,
      notes: ''
    });
  };

  // 근무내역 수정 저장
  const handleSaveEditWorkDetail = async (workerId: string, detailId: string) => {
    if (!editWorkDetail.workDate || !editWorkDetail.startTime || !editWorkDetail.endTime) {
      alert('근무일, 출근시각, 퇴근시각을 입력해주세요.');
      return;
    }

    try {
      const worker = workers.find(w => w.id === workerId);
      if (!worker) return;

      const updatedWorkDetails = worker.workDetails.map(detail => 
        detail.id === detailId 
          ? {
              ...detail,
              workDate: editWorkDetail.workDate,
              startTime: editWorkDetail.startTime,
              endTime: editWorkDetail.endTime,
              breakTime: editWorkDetail.breakTime,
              workHours: calculateWorkHours(editWorkDetail.startTime, editWorkDetail.endTime, editWorkDetail.breakTime),
              notes: editWorkDetail.notes
            }
          : detail
      );

      const totalWorkHours = calculateTotalWorkHours(updatedWorkDetails);
      const totalPay = calculateTotalPay(worker.workType, worker.hourlyWage, totalWorkHours, worker.fixedAmount);

      await updateDoc(doc(db, 'shortTermWorkers', workerId), {
        workDetails: updatedWorkDetails,
        totalWorkHours: totalWorkHours,
        totalPay: totalPay,
        updatedAt: new Date()
      });

      setEditingWorkDetail(prev => ({ ...prev, [detailId]: false }));
      setEditWorkDetail({
        workDate: '',
        startTime: '',
        endTime: '',
        breakTime: 0,
        notes: ''
      });

      loadWorkers();
    } catch (error) {
      console.error('근무내역 수정 실패:', error);
      alert('근무내역 수정에 실패했습니다.');
    }
  };

  // 근무내역 삭제
  const handleDeleteWorkDetail = async (workerId: string, detailId: string) => {
    if (!confirm('정말로 이 근무내역을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const worker = workers.find(w => w.id === workerId);
      if (!worker) return;

      const updatedWorkDetails = worker.workDetails.filter(detail => detail.id !== detailId);
      const totalWorkHours = calculateTotalWorkHours(updatedWorkDetails);
      const totalPay = calculateTotalPay(worker.workType, worker.hourlyWage, totalWorkHours, worker.fixedAmount);

      await updateDoc(doc(db, 'shortTermWorkers', workerId), {
        workDetails: updatedWorkDetails,
        totalWorkHours: totalWorkHours,
        totalPay: totalPay,
        updatedAt: new Date()
      });

      loadWorkers();
    } catch (error) {
      console.error('근무내역 삭제 실패:', error);
      alert('근무내역 삭제에 실패했습니다.');
    }
  };

  // 입금내역 수정 시작
  const handleStartEditDepositDetail = (deposit: DepositDetail) => {
    setEditDepositDetail({
      depositDate: deposit.depositDate,
      depositAmount: deposit.depositAmount,
      notes: deposit.notes || ''
    });
    setEditingDepositDetail(prev => ({ ...prev, [deposit.id]: true }));
  };

  // 입금내역 수정 취소
  const handleCancelEditDepositDetail = (depositId: string) => {
    setEditingDepositDetail(prev => ({ ...prev, [depositId]: false }));
    setEditDepositDetail({
      depositDate: '',
      depositAmount: 0,
      notes: ''
    });
  };

  // 입금내역 수정 저장
  const handleSaveEditDepositDetail = async (workerId: string, depositId: string) => {
    if (!editDepositDetail.depositDate || editDepositDetail.depositAmount <= 0) {
      alert('입금일과 입금액을 입력해주세요.');
      return;
    }

    try {
      const worker = workers.find(w => w.id === workerId);
      if (!worker) return;

      const updatedDepositDetails = worker.depositDetails?.map(deposit => 
        deposit.id === depositId 
          ? {
              ...deposit,
              depositDate: editDepositDetail.depositDate,
              depositAmount: editDepositDetail.depositAmount,
              notes: editDepositDetail.notes
            }
          : deposit
      ) || [];

      await updateDoc(doc(db, 'shortTermWorkers', workerId), {
        depositDetails: updatedDepositDetails,
        updatedAt: new Date()
      });

      setEditingDepositDetail(prev => ({ ...prev, [depositId]: false }));
      setEditDepositDetail({
        depositDate: '',
        depositAmount: 0,
        notes: ''
      });

      loadWorkers();
    } catch (error) {
      console.error('입금내역 수정 실패:', error);
      alert('입금내역 수정에 실패했습니다.');
    }
  };

  // 입금 상세 삭제
  const handleDeleteDepositDetail = async (workerId: string, depositIndex: number) => {
    try {
      const worker = workers.find(w => w.id === workerId);
      if (!worker) return;

      const updatedDepositDetails = worker.depositDetails?.filter((_, index) => index !== depositIndex) || [];

      await updateDoc(doc(db, 'shortTermWorkers', workerId), {
        depositDetails: updatedDepositDetails,
        updatedAt: new Date()
      });

      loadWorkers();
    } catch (error) {
      console.error('입금 상세 삭제 실패:', error);
      alert('입금 상세 삭제에 실패했습니다.');
    }
  };

  // 직원 비고 업데이트
  const handleUpdateNotes = async (workerId: string, notes: string) => {
    try {
      await updateDoc(doc(db, 'shortTermWorkers', workerId), {
        notes: notes,
        updatedAt: new Date()
      });
      loadWorkers();
    } catch (error) {
      console.error('직원 비고 업데이트 실패:', error);
      alert('직원 비고 업데이트에 실패했습니다.');
    }
  };

  // 직원 수정
  const handleEditWorker = (worker: ShortTermWorker) => {
    setWorkerToEdit(worker);
    setShowEditModal(true);
  };

  // 직원 정보 업데이트
  const handleUpdateWorker = async (updatedData: Partial<ShortTermWorker>) => {
    if (!workerToEdit) return;
    
    try {
      // 시급이 변경되었는지 확인 (원본 데이터와 비교)
      const originalWorker = workers.find(w => w.id === workerToEdit.id);
      const hourlyWageChanged = updatedData.hourlyWage !== undefined && 
                               updatedData.hourlyWage !== originalWorker?.hourlyWage;
      
      console.log('🔥 시급 변경 확인:', {
        newWage: updatedData.hourlyWage,
        oldWage: originalWorker?.hourlyWage,
        changed: hourlyWageChanged
      });
      
      let finalUpdateData = {
        ...updatedData,
        updatedAt: new Date()
      };
      
      // 시급, 총금액, 또는 근무형태가 변경된 경우 급여 재계산
      const workTypeChanged = updatedData.workType !== undefined && updatedData.workType !== workerToEdit.workType;
      const fixedAmountChanged = updatedData.fixedAmount !== undefined && updatedData.fixedAmount !== workerToEdit.fixedAmount;
      
      if (hourlyWageChanged || workTypeChanged || fixedAmountChanged) {
        const totalWorkHours = workerToEdit.totalWorkHours || 0;
        const totalPay = calculateTotalPay(
          updatedData.workType || workerToEdit.workType, 
          updatedData.hourlyWage || workerToEdit.hourlyWage, 
          totalWorkHours, 
          updatedData.fixedAmount || workerToEdit.fixedAmount
        );
        
        console.log('🔥 급여 재계산:', {
          workType: updatedData.workType || workerToEdit.workType,
          hourlyWage: updatedData.hourlyWage || workerToEdit.hourlyWage,
          fixedAmount: updatedData.fixedAmount || workerToEdit.fixedAmount,
          totalWorkHours,
          totalPay
        });
        
        finalUpdateData = {
          ...finalUpdateData,
          totalPay: totalPay
        };
      }
      
      await updateDoc(doc(db, 'shortTermWorkers', workerToEdit.id), finalUpdateData);
      setShowEditModal(false);
      setWorkerToEdit(null);
      loadWorkers();
    } catch (error) {
      console.error('직원 정보 업데이트 실패:', error);
      alert('직원 정보 업데이트에 실패했습니다.');
    }
  };

  // 직원 삭제
  const handleDeleteWorker = async (workerId: string) => {
    if (!confirm('정말로 이 직원을 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'shortTermWorkers', workerId));
      loadWorkers();
    } catch (error) {
      console.error('직원 삭제 실패:', error);
      alert('직원 삭제에 실패했습니다.');
    }
  };

  // 은행코드 로드
  const loadBankCodes = async () => {
    try {
      const bankCodesSnapshot = await getDocs(collection(db, 'bankCodes'));
      const codes = bankCodesSnapshot.docs.map(doc => ({
        code: doc.id,
        name: doc.data().name
      }));
      setBankCodes(codes);
    } catch (error) {
      console.error('은행코드 로드 실패:', error);
    }
  };

  // 엑셀형 근무 추가 - 행 추가
  const addExcelRow = () => {
    setExcelWorkDetails(prev => [...prev, { workDate: '', startTime: '', endTime: '', breakTime: 0, notes: '' }]);
  };

  // 엑셀형 근무 추가 - 행 삭제
  const removeExcelRow = (index: number) => {
    if (excelWorkDetails.length > 1) {
      setExcelWorkDetails(prev => prev.filter((_, i) => i !== index));
    }
  };

  // 엑셀형 근무 추가 - 데이터 변경
  const updateExcelRow = (index: number, field: string, value: string | number) => {
    setExcelWorkDetails(prev => prev.map((row, i) => 
      i === index ? { ...row, [field]: value } : row
    ));
  };

  // 엑셀형 근무 일괄 추가
  const handleExcelAddWorkDetails = async (workerId: string) => {
    const validRows = excelWorkDetails.filter(row => 
      row.workDate && row.startTime && row.endTime
    );

    if (validRows.length === 0) {
      alert('유효한 근무 데이터를 입력해주세요.');
      return;
    }

    try {
      const worker = workers.find(w => w.id === workerId);
      if (!worker) return;

      const newWorkDetails: WorkDetail[] = validRows.map(row => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        workDate: row.workDate,
        startTime: row.startTime,
        endTime: row.endTime,
        breakTime: row.breakTime,
        workHours: calculateWorkHours(row.startTime, row.endTime, row.breakTime),
        notes: row.notes || ''
      }));

      const updatedWorkDetails = [...worker.workDetails, ...newWorkDetails];
      const totalWorkHours = calculateTotalWorkHours(updatedWorkDetails);
      const totalPay = calculateTotalPay(worker.workType, worker.hourlyWage, totalWorkHours, worker.fixedAmount);

      await updateDoc(doc(db, 'shortTermWorkers', workerId), {
        workDetails: updatedWorkDetails,
        totalWorkHours: totalWorkHours,
        totalPay: totalPay,
        updatedAt: new Date()
      });

      // 폼 초기화
      setExcelWorkDetails([{ workDate: '', startTime: '', endTime: '', breakTime: 0, notes: '' }]);
      setShowExcelForm(false);
      loadWorkers();
    } catch (error) {
      console.error('엑셀형 근무 추가 실패:', error);
      alert('근무 추가에 실패했습니다.');
    }
  };

  // 월별 데이터 로드
  useEffect(() => {
    loadWorkers();
  }, [selectedMonth]);

  useEffect(() => {
    loadBranches();
    loadBankCodes();
    
    // 현재 월을 기본값으로 설정
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(currentMonth);
  }, []);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">단기알바 관리</h1>
            <p className="mt-1 text-sm text-gray-600">단기알바 직원의 근무시간 및 급여를 체계적으로 관리합니다</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">처리할 월:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!selectedMonth}
            >
              {showAddForm ? '취소' : '새 직원 추가'}
            </button>
          </div>
        </div>
      </div>

      {/* 새 직원 추가 폼 */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">새 직원 추가</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">지점 <span className="text-red-500">*</span></label>
              <select
                value={newWorker.branchId}
                onChange={(e) => setNewWorker({...newWorker, branchId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">지점 선택</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={newWorker.name}
                onChange={(e) => setNewWorker({...newWorker, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="이름을 입력하세요"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">주민번호 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={newWorker.socialSecurityNumber}
                onChange={(e) => setNewWorker({...newWorker, socialSecurityNumber: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="주민번호를 입력하세요"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">핸드폰 번호</label>
              <input
                type="text"
                value={newWorker.phoneNumber}
                onChange={(e) => setNewWorker({...newWorker, phoneNumber: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="핸드폰 번호를 입력하세요"
              />
            </div>

            {/* 근무형태 선택 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">근무형태</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="workType"
                    value="hourly"
                    checked={newWorker.workType === 'hourly'}
                    onChange={(e) => setNewWorker({...newWorker, workType: e.target.value as 'hourly' | 'fixed'})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">시급</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="workType"
                    value="fixed"
                    checked={newWorker.workType === 'fixed'}
                    onChange={(e) => setNewWorker({...newWorker, workType: e.target.value as 'hourly' | 'fixed'})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">총금액</span>
                </label>
              </div>
            </div>

            {/* 시급 입력 (시급 선택 시) */}
            {newWorker.workType === 'hourly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시급 (원) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={newWorker.hourlyWage}
                  onChange={(e) => setNewWorker({...newWorker, hourlyWage: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="시급을 입력하세요"
                />
              </div>
            )}

            {/* 총금액 입력 (총금액 선택 시) */}
            {newWorker.workType === 'fixed' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">총금액 (원) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={newWorker.fixedAmount}
                  onChange={(e) => setNewWorker({...newWorker, fixedAmount: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="총금액을 입력하세요"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">은행</label>
              <select
                value={newWorker.bankName}
                onChange={(e) => setNewWorker({...newWorker, bankName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">은행을 선택하세요</option>
                {bankCodes.map((bank) => (
                  <option key={bank.code} value={bank.name}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">계좌번호</label>
              <input
                type="text"
                value={newWorker.accountNumber}
                onChange={(e) => setNewWorker({...newWorker, accountNumber: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="계좌번호를 입력하세요"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">예금주</label>
              <input
                type="text"
                value={newWorker.accountHolder}
                onChange={(e) => setNewWorker({...newWorker, accountHolder: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예금주명을 입력하세요"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시급</label>
              <input
                type="number"
                value={newWorker.hourlyWage}
                onChange={(e) => setNewWorker({...newWorker, hourlyWage: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="시급을 입력하세요"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
              <textarea
                value={newWorker.notes}
                onChange={(e) => setNewWorker({...newWorker, notes: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="비고를 입력하세요"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleAddWorker}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              추가
            </button>
          </div>
        </div>
      )}

      {/* 단기알바 목록 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">지점</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름/주민번호</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">핸드폰</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">근무형태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시급/총금액</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총근무시간</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총급여</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">공제액</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">실지급액</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총입금액</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상세보기</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-4 text-center text-gray-500">로딩중...</td>
                </tr>
              ) : workers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-4 text-center text-gray-500">등록된 단기알바가 없습니다.</td>
                </tr>
              ) : (
                workers.map((worker) => {
                  // 실지급액과 총입금액 비교
                  const netPay = Math.round(worker.totalPay * 0.967);
                  const totalDeposit = worker.depositDetails?.reduce((sum, deposit) => sum + deposit.depositAmount, 0) || 0;
                  const isAmountMismatch = netPay !== totalDeposit;
                  
                  return (
                    <React.Fragment key={worker.id}>
                      {/* 첫 번째 줄: 기본 정보 */}
                      <tr className={`hover:bg-gray-50 ${isAmountMismatch ? 'bg-yellow-50' : ''}`}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="font-medium">{worker.branchName}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <button
                          onClick={() => handleEditWorker(worker)}
                          className="text-left hover:bg-gray-100 p-2 rounded"
                        >
                          <div className="font-semibold text-blue-600 hover:text-blue-800">{worker.name}</div>
                          <div className="text-xs text-gray-500">{worker.socialSecurityNumber}</div>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>{worker.phoneNumber || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="font-semibold">
                          {(worker.workType || 'hourly') === 'hourly' ? '시급' : '총금액'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="font-semibold text-blue-600">
                          {(worker.workType || 'hourly') === 'hourly' 
                            ? `${(worker.hourlyWage || 0).toLocaleString()}원/시간`
                            : `${(worker.fixedAmount || 0).toLocaleString()}원`
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>
                          {(worker.workType || 'hourly') === 'hourly' 
                            ? formatTime(worker.totalWorkHours || 0)
                            : '-'
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="font-semibold text-blue-600">{(worker.totalPay || 0).toLocaleString()}원</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>{Math.round((worker.totalPay || 0) * 0.033).toLocaleString()}원</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="font-semibold text-green-600">{Math.round((worker.totalPay || 0) * 0.967).toLocaleString()}원</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="font-semibold text-purple-600">
                          {worker.depositDetails?.reduce((sum, deposit) => sum + deposit.depositAmount, 0).toLocaleString() || 0}원
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <button
                          onClick={() => toggleWorkDetails(worker.id)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {expandedWorker === worker.id ? '접기' : '상세보기 ▼'}
                        </button>
                      </td>
                    </tr>
                    
                    {/* 상세보기 */}
                    {expandedWorker === worker.id && (
                      <tr>
                        <td colSpan={10} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-6">
                            {/* 근무내역 상세보기 */}
                            <div>
                              <div className="flex justify-between items-center mb-4">
                                <h4 className="text-lg font-medium text-gray-900">근무내역 상세보기</h4>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => setShowExcelForm(!showExcelForm)}
                                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                                >
                                  {showExcelForm ? '닫기' : '추가'}
                                </button>
                              </div>
                            </div>
                            
                            
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">근무일</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">출근시각</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">퇴근시각</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">휴식시간</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">근무시간</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">비고</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {/* 근무 추가 입력창 */}
                                  {showExcelForm && (
                                    <>
                                      {excelWorkDetails.map((row, index) => (
                                        <tr key={`new-${index}`} className="bg-blue-50">
                                          <td className="px-4 py-2">
                                            <input
                                              type="date"
                                              value={row.workDate}
                                              onChange={(e) => updateExcelRow(index, 'workDate', e.target.value)}
                                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                            />
                                          </td>
                                          <td className="px-4 py-2">
                                            <input
                                              type="time"
                                              value={row.startTime}
                                              onChange={(e) => updateExcelRow(index, 'startTime', e.target.value)}
                                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                            />
                                          </td>
                                          <td className="px-4 py-2">
                                            <input
                                              type="time"
                                              value={row.endTime}
                                              onChange={(e) => updateExcelRow(index, 'endTime', e.target.value)}
                                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                            />
                                          </td>
                                          <td className="px-4 py-2">
                                            <input
                                              type="number"
                                              value={row.breakTime}
                                              onChange={(e) => updateExcelRow(index, 'breakTime', Number(e.target.value))}
                                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                              min="0"
                                            />
                                          </td>
                                          <td className="px-4 py-2 text-sm text-gray-500">
                                            {row.startTime && row.endTime ? formatTime(calculateWorkHours(row.startTime, row.endTime, row.breakTime)) : '-'}
                                          </td>
                                          <td className="px-4 py-2">
                                            <input
                                              type="text"
                                              value={row.notes}
                                              onChange={(e) => updateExcelRow(index, 'notes', e.target.value)}
                                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                              placeholder="비고"
                                            />
                                          </td>
                                          <td className="px-4 py-2">
                                            <div className="flex space-x-1">
                                              <button
                                                onClick={addExcelRow}
                                                className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                                                title="행 추가"
                                              >
                                                +
                                              </button>
                                              {excelWorkDetails.length > 1 && (
                                                <button
                                                  onClick={() => removeExcelRow(index)}
                                                  className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                                                  title="행 삭제"
                                                >
                                                  -
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                      <tr className="bg-blue-100">
                                        <td colSpan={7} className="px-4 py-2">
                                          <div className="flex justify-end space-x-2">
                                            <button
                                              onClick={() => setShowExcelForm(false)}
                                              className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 text-sm"
                                            >
                                              취소
                                            </button>
                                            <button
                                              onClick={() => handleExcelAddWorkDetails(worker.id)}
                                              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                                            >
                                              일괄 추가
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    </>
                                  )}
                                  
                                  {/* 기존 근무 데이터 */}
                                  {worker.workDetails.map((detail) => (
                                    <tr key={detail.id}>
                                      {editingWorkDetail[detail.id] ? (
                                        <>
                                          <td className="px-4 py-2">
                                            <input
                                              type="date"
                                              value={editWorkDetail.workDate}
                                              onChange={(e) => setEditWorkDetail({...editWorkDetail, workDate: e.target.value})}
                                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                            />
                                          </td>
                                          <td className="px-4 py-2">
                                            <input
                                              type="time"
                                              value={editWorkDetail.startTime}
                                              onChange={(e) => setEditWorkDetail({...editWorkDetail, startTime: e.target.value})}
                                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                            />
                                          </td>
                                          <td className="px-4 py-2">
                                            <input
                                              type="time"
                                              value={editWorkDetail.endTime}
                                              onChange={(e) => setEditWorkDetail({...editWorkDetail, endTime: e.target.value})}
                                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                            />
                                          </td>
                                          <td className="px-4 py-2">
                                            <input
                                              type="number"
                                              value={editWorkDetail.breakTime}
                                              onChange={(e) => setEditWorkDetail({...editWorkDetail, breakTime: Number(e.target.value)})}
                                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                              placeholder="휴식시간(분)"
                                            />
                                          </td>
                                          <td className="px-4 py-2 text-sm text-gray-900">{formatTime(calculateWorkHours(editWorkDetail.startTime, editWorkDetail.endTime, editWorkDetail.breakTime))}</td>
                                          <td className="px-4 py-2">
                                            <input
                                              type="text"
                                              value={editWorkDetail.notes}
                                              onChange={(e) => setEditWorkDetail({...editWorkDetail, notes: e.target.value})}
                                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                              placeholder="비고"
                                            />
                                          </td>
                                          <td className="px-4 py-2">
                                            <div className="flex space-x-1">
                                              <button
                                                onClick={() => handleCancelEditWorkDetail(detail.id)}
                                                className="px-2 py-1 text-gray-600 border border-gray-300 rounded text-xs hover:bg-gray-50"
                                              >
                                                취소
                                              </button>
                                              <button
                                                onClick={() => handleSaveEditWorkDetail(worker.id, detail.id)}
                                                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                              >
                                                저장
                                              </button>
                                            </div>
                                          </td>
                                        </>
                                      ) : (
                                        <>
                                          <td className="px-4 py-2 text-sm text-gray-900">{detail.workDate}</td>
                                          <td className="px-4 py-2 text-sm text-gray-900">{detail.startTime}</td>
                                          <td className="px-4 py-2 text-sm text-gray-900">{detail.endTime}</td>
                                          <td className="px-4 py-2 text-sm text-gray-900">{detail.breakTime}분</td>
                                          <td className="px-4 py-2 text-sm text-gray-900">{formatTime(detail.workHours)}</td>
                                          <td className="px-4 py-2 text-sm text-gray-900">{detail.notes || '-'}</td>
                                          <td className="px-4 py-2 text-sm text-gray-900">
                                            <div className="flex space-x-1">
                                              <button
                                                onClick={() => handleStartEditWorkDetail(worker.id, detail)}
                                                className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                                              >
                                                수정
                                              </button>
                                              <button
                                                onClick={() => handleDeleteWorkDetail(worker.id, detail.id)}
                                                className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                              >
                                                삭제
                                              </button>
                                            </div>
                                          </td>
                                        </>
                                      )}
                                    </tr>
                                  ))}
                                  {worker.workDetails.length === 0 && !showExcelForm && (
                                    <tr>
                                      <td colSpan={7} className="px-4 py-2 text-center text-gray-500">등록된 근무가 없습니다.</td>
                                    </tr>
                                  )}
                                  {/* 합계 행 */}
                                  <tr className="bg-gray-100 font-medium">
                                    <td className="px-4 py-2 text-sm text-gray-900">합계</td>
                                    <td className="px-4 py-2 text-sm text-gray-900">-</td>
                                    <td className="px-4 py-2 text-sm text-gray-900">-</td>
                                    <td className="px-4 py-2 text-sm text-gray-900">
                                      {worker.workDetails.reduce((total, detail) => total + detail.breakTime, 0)}분
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-900">{formatTime(worker.totalWorkHours)}</td>
                                    <td className="px-4 py-2 text-sm text-gray-900">-</td>
                                    <td className="px-4 py-2 text-sm text-gray-900">-</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                            </div>
                            
                            {/* 입금내역 상세보기 */}
                            <div>
                              <div className="flex justify-between items-center mb-4">
                                <h4 className="text-lg font-medium text-gray-900">입금내역 상세보기</h4>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => setShowDepositForm(prev => ({ ...prev, [worker.id]: !prev[worker.id] }))}
                                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                                  >
                                    {showDepositForm[worker.id] ? '닫기' : '입금 추가'}
                                  </button>
                                </div>
                              </div>
                              
                              {/* 계좌정보 */}
                              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                                <h5 className="text-sm font-medium text-gray-900 mb-2">계좌정보</h5>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-600">은행:</span>
                                    <span className="ml-2 font-medium">{worker.bankName || '미입력'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">계좌번호:</span>
                                    <span className="ml-2 font-medium">{worker.accountNumber || '미입력'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">예금주:</span>
                                    <span className="ml-2 font-medium">{worker.accountHolder || '미입력'}</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* 입금내역 테이블 */}
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">입금일</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">입금액</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">비고</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {/* 입금 추가 입력창 */}
                                    {showDepositForm[worker.id] && (
                                      <tr className="bg-green-50">
                                        <td className="px-4 py-2">
                                          <input
                                            type="date"
                                            value={newDepositDetail.depositDate}
                                            onChange={(e) => setNewDepositDetail({...newDepositDetail, depositDate: e.target.value})}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                          />
                                        </td>
                                        <td className="px-4 py-2">
                                          <input
                                            type="number"
                                            value={newDepositDetail.depositAmount || ''}
                                            onChange={(e) => setNewDepositDetail({...newDepositDetail, depositAmount: Number(e.target.value)})}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                            placeholder="입금액"
                                          />
                                        </td>
                                        <td className="px-4 py-2">
                                          <input
                                            type="text"
                                            value={newDepositDetail.notes}
                                            onChange={(e) => setNewDepositDetail({...newDepositDetail, notes: e.target.value})}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                            placeholder="비고"
                                          />
                                        </td>
                                        <td className="px-4 py-2">
                                          <div className="flex space-x-1">
                                            <button
                                              onClick={() => {
                                                setShowDepositForm(prev => ({ ...prev, [worker.id]: false }));
                                                setNewDepositDetail({ depositDate: '', depositAmount: 0, notes: '' });
                                              }}
                                              className="px-2 py-1 text-gray-600 border border-gray-300 rounded text-xs hover:bg-gray-50"
                                            >
                                              취소
                                            </button>
                                            <button
                                              onClick={() => handleInlineAddDeposit(worker.id)}
                                              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                            >
                                              추가
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                    
                                    {worker.depositDetails?.map((deposit, index) => (
                                      <tr key={index}>
                                        {editingDepositDetail[deposit.id] ? (
                                          <>
                                            <td className="px-4 py-2">
                                              <input
                                                type="date"
                                                value={editDepositDetail.depositDate}
                                                onChange={(e) => setEditDepositDetail({...editDepositDetail, depositDate: e.target.value})}
                                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                              />
                                            </td>
                                            <td className="px-4 py-2">
                                              <input
                                                type="number"
                                                value={editDepositDetail.depositAmount || ''}
                                                onChange={(e) => setEditDepositDetail({...editDepositDetail, depositAmount: Number(e.target.value)})}
                                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                placeholder="입금액"
                                              />
                                            </td>
                                            <td className="px-4 py-2">
                                              <input
                                                type="text"
                                                value={editDepositDetail.notes}
                                                onChange={(e) => setEditDepositDetail({...editDepositDetail, notes: e.target.value})}
                                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                placeholder="비고"
                                              />
                                            </td>
                                            <td className="px-4 py-2">
                                              <div className="flex space-x-1">
                                                <button
                                                  onClick={() => handleCancelEditDepositDetail(deposit.id)}
                                                  className="px-2 py-1 text-gray-600 border border-gray-300 rounded text-xs hover:bg-gray-50"
                                                >
                                                  취소
                                                </button>
                                                <button
                                                  onClick={() => handleSaveEditDepositDetail(worker.id, deposit.id)}
                                                  className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                                >
                                                  저장
                                                </button>
                                              </div>
                                            </td>
                                          </>
                                        ) : (
                                          <>
                                            <td className="px-4 py-2 text-sm text-gray-900">{deposit.depositDate}</td>
                                            <td className="px-4 py-2 text-sm text-gray-900">{deposit.depositAmount.toLocaleString()}원</td>
                                            <td className="px-4 py-2 text-sm text-gray-900">{deposit.notes}</td>
                                            <td className="px-4 py-2 text-sm text-gray-900">
                                              <div className="flex space-x-1">
                                                <button
                                                  onClick={() => handleStartEditDepositDetail(deposit)}
                                                  className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                                                >
                                                  수정
                                                </button>
                                                <button
                                                  onClick={() => handleDeleteDepositDetail(worker.id, index)}
                                                  className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                                >
                                                  삭제
                                                </button>
                                              </div>
                                            </td>
                                          </>
                                        )}
                                      </tr>
                                    )) || []}
                                    {(!worker.depositDetails || worker.depositDetails.length === 0) && (
                                      <tr>
                                        <td colSpan={4} className="px-4 py-2 text-center text-gray-500">등록된 입금내역이 없습니다.</td>
                                      </tr>
                                    )}
                                    {/* 합계 행 */}
                                    {worker.depositDetails && worker.depositDetails.length > 0 && (
                                      <tr className="bg-gray-100 font-medium">
                                        <td className="px-4 py-2 text-sm text-gray-900">합계</td>
                                        <td className="px-4 py-2 text-sm text-gray-900">
                                          {worker.depositDetails.reduce((sum, deposit) => sum + deposit.depositAmount, 0).toLocaleString()}원
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-900">-</td>
                                        <td className="px-4 py-2 text-sm text-gray-900">-</td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            
                            {/* 직원 비고 */}
                            <div>
                              <div className="mb-4">
                                <h4 className="text-lg font-medium text-gray-900 mb-2">직원 비고</h4>
                                <textarea
                                  value={worker.notes}
                                  onChange={(e) => handleUpdateNotes(worker.id, e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                  rows={3}
                                  placeholder="직원에 대한 비고를 입력하세요..."
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 직원 수정 모달 */}
      {showEditModal && workerToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">직원 정보 수정</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={workerToEdit.name}
                  onChange={(e) => setWorkerToEdit({...workerToEdit, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주민번호 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={workerToEdit.socialSecurityNumber}
                  onChange={(e) => setWorkerToEdit({...workerToEdit, socialSecurityNumber: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">핸드폰 번호</label>
                <input
                  type="text"
                  value={workerToEdit.phoneNumber}
                  onChange={(e) => setWorkerToEdit({...workerToEdit, phoneNumber: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 근무형태 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">근무형태</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="editWorkType"
                      value="hourly"
                      checked={workerToEdit.workType === 'hourly'}
                      onChange={(e) => setWorkerToEdit({...workerToEdit, workType: e.target.value as 'hourly' | 'fixed'})}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">시급</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="editWorkType"
                      value="fixed"
                      checked={workerToEdit.workType === 'fixed'}
                      onChange={(e) => setWorkerToEdit({...workerToEdit, workType: e.target.value as 'hourly' | 'fixed'})}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">총금액</span>
                  </label>
                </div>
              </div>

              {/* 시급 입력 (시급 선택 시) */}
              {workerToEdit.workType === 'hourly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시급 (원) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={workerToEdit.hourlyWage}
                    onChange={(e) => setWorkerToEdit({...workerToEdit, hourlyWage: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* 총금액 입력 (총금액 선택 시) */}
              {workerToEdit.workType === 'fixed' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">총금액 (원) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={workerToEdit.fixedAmount}
                    onChange={(e) => setWorkerToEdit({...workerToEdit, fixedAmount: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">은행</label>
                <select
                  value={workerToEdit.bankName}
                  onChange={(e) => setWorkerToEdit({...workerToEdit, bankName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">은행을 선택하세요</option>
                  {bankCodes.map((bank) => (
                    <option key={bank.code} value={bank.name}>
                      {bank.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">계좌번호</label>
                <input
                  type="text"
                  value={workerToEdit.accountNumber}
                  onChange={(e) => setWorkerToEdit({...workerToEdit, accountNumber: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">예금주</label>
                <input
                  type="text"
                  value={workerToEdit.accountHolder}
                  onChange={(e) => setWorkerToEdit({...workerToEdit, accountHolder: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
                <textarea
                  value={workerToEdit.notes}
                  onChange={(e) => setWorkerToEdit({...workerToEdit, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setWorkerToEdit(null);
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => handleUpdateWorker(workerToEdit)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                수정
              </button>
              <button
                onClick={() => handleDeleteWorker(workerToEdit.id)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
