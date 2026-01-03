'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, getDoc, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getPayrollMonth } from '@/utils/work-schedule/dateUtils';
import * as XLSX from 'xlsx';

interface ConfirmedPayroll {
  id: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  month: string;
  confirmedAt: Date;
  grossPay: number;
  deductions: number;
  netPay: number;
  memo?: string; // 비고란 추가
  employmentType?: string; // 고용형태
  branches: {
    branchId: string;
    branchName: string;
    workHours: number;
  }[];
}

interface Employee {
  id: string;
  name: string;
  residentNumber?: string;
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
  hireDate?: any;
  resignationDate?: any;
  employmentType?: string;
}

interface Branch {
  id: string;
  name: string;
}

const TaxFileGeneration: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(getPayrollMonth());
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [confirmedPayrolls, setConfirmedPayrolls] = useState<ConfirmedPayroll[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingMemo, setEditingMemo] = useState<{[key: string]: string}>({});
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());

  // 지점 로드
  const loadBranches = useCallback(async () => {
    try {
      const branchesSnapshot = await getDocs(collection(db, 'branches'));
      const branchesData = branchesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Branch[];
      setBranches(branchesData);
    } catch (error) {
      console.error('지점 로드 실패:', error);
    }
  }, []);

  // 직원 로드
  const loadEmployees = useCallback(async () => {
    if (!selectedMonth) return;
    
    try {
      // 선택된 월의 시작일과 끝일 계산
      const [year, month] = selectedMonth.split('-').map(Number);
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0, 23, 59, 59);
      
      const employeesSnapshot = await getDocs(collection(db, 'employees'));
      const employeesData = employeesSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Employee))
        .filter(employee => {
          // 입사일과 퇴사일 확인
          const hireDate = employee.hireDate?.toDate ? employee.hireDate.toDate() : 
                          employee.hireDate ? new Date(employee.hireDate) : null;
          const resignationDate = employee.resignationDate?.toDate ? employee.resignationDate.toDate() : 
                                 employee.resignationDate ? new Date(employee.resignationDate) : null;
          
          // 입사일이 없으면 제외
          if (!hireDate) return false;
          
          // 입사일이 해당월 이후면 제외
          if (hireDate > monthEnd) return false;
          
          // 퇴사일이 있고, 퇴사일이 해당월 이전이면 제외
          if (resignationDate && resignationDate < monthStart) return false;
          
          return true;
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')) as Employee[];
      
      setEmployees(employeesData);
    } catch (error) {
      console.error('직원 로드 실패:', error);
    }
  }, [selectedMonth]);

  // 확정된 급여 데이터 로드
  const loadConfirmedPayrolls = useCallback(async () => {
    if (!selectedMonth) return;
    
    setLoading(true);
    try {
      console.log('🔥 세무사 전송파일 - 급여확정 데이터 조회 시작:', selectedMonth);
      
      const confirmedPayrollsQuery = query(
        collection(db, 'confirmedPayrolls'),
        where('month', '==', selectedMonth)
      );
      const confirmedPayrollsSnapshot = await getDocs(confirmedPayrollsQuery);
      
      console.log('🔥 세무사 전송파일 - 조회된 데이터:', confirmedPayrollsSnapshot.docs.length, '건');
      
      const confirmedPayrollsData = confirmedPayrollsSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('🔥 급여확정 데이터:', data);
        return {
          id: doc.id,
          ...data,
          confirmedAt: data.confirmedAt?.toDate() || new Date()
        };
      }) as ConfirmedPayroll[];
      
      console.log('🔥 세무사 전송파일 - 최종 데이터:', confirmedPayrollsData);
      
      setConfirmedPayrolls(confirmedPayrollsData);
    } catch (error) {
      console.error('확정된 급여 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  // 컴포넌트 마운트 시 초기 데이터 로드
  useEffect(() => {
    loadBranches();
    loadEmployees();
  }, [loadBranches, loadEmployees]);

  // 월이 변경될 때 확정된 급여 데이터 로드
  useEffect(() => {
    loadConfirmedPayrolls();
  }, [loadConfirmedPayrolls]);

  // 비고 저장 함수
  const saveMemo = async (payrollId: string, memo: string) => {
    try {
      await updateDoc(doc(db, 'confirmedPayrolls', payrollId), {
        memo: memo,
        updatedAt: new Date()
      });
      
      // 로컬 상태 업데이트
      setConfirmedPayrolls(prev => 
        prev.map(p => p.id === payrollId ? { ...p, memo } : p)
      );
      
      // 편집 상태 초기화
      setEditingMemo(prev => {
        const newState = { ...prev };
        delete newState[payrollId];
        return newState;
      });
      
      alert('비고가 저장되었습니다.');
    } catch (error) {
      console.error('비고 저장 실패:', error);
      alert('비고 저장에 실패했습니다.');
    }
  };

  // 전체 데이터(대표지점 기준 보정) - 탭 건수 계산용, selectedBranchId와 무관
  const normalizedAllPayrolls = confirmedPayrolls.map(payroll => {
    // branchId가 비어있는 기존 데이터 보정: 직원의 대표지점 사용
    if (!payroll.branchId) {
      const emp = employees.find(e => e.id === payroll.employeeId) as any;
      const primaryBranchId = emp?.primaryBranchId || '';
      const primaryBranchName = emp?.primaryBranchName || '';
      return { ...payroll, branchId: primaryBranchId, branchName: primaryBranchName } as any;
    }
    return payroll;
  });

  // 지점별 필터링된 데이터 (대표지점 기준 보정) - 실제 표시용
  const filteredPayrolls = (selectedBranchId 
    ? normalizedAllPayrolls.filter(payroll => payroll.branchId === selectedBranchId)
    : normalizedAllPayrolls
  );

  // 테이블 데이터 생성 (대표지점 기준으로 그룹화)
  const tableDataMap = new Map<string, any>();
  
  filteredPayrolls.forEach(payroll => {
    const employee = employees.find(emp => emp.id === payroll.employeeId);
    if (!employee) return;
    
    const key = payroll.employeeId;
    
    if (!tableDataMap.has(key)) {
      // 입사일 처리
      let hireDateStr = '정보없음';
      if (employee?.hireDate) {
        try {
          // Firebase Timestamp인 경우 toDate() 사용, 아니면 직접 Date 생성
          const hireDate = employee.hireDate.toDate ? employee.hireDate.toDate() : new Date(employee.hireDate);
          if (!isNaN(hireDate.getTime())) {
            hireDateStr = hireDate.toLocaleDateString('ko-KR');
          }
        } catch (error) {
          console.error('입사일 변환 오류:', error, employee.hireDate);
          hireDateStr = '정보없음';
        }
      }
      
      tableDataMap.set(key, {
        id: payroll.employeeId, // 🔥 직원 ID로 변경 (payroll.id가 아닌 employeeId 사용)
        payrollId: payroll.id, // payroll.id는 별도로 저장 (필요시 사용)
        residentNumber: employee?.residentNumber || '-',
        employeeName: payroll.employeeName,
        hireDate: hireDateStr,
        bankName: employee?.bankName || '-',
        bankCode: employee?.bankCode || '-',
        netPay: payroll.netPay,
        grossPay: payroll.grossPay,
        memo: payroll.memo || ''
      });
    } else {
      // 이미 있는 경우 netPay와 grossPay 누적
      const existing = tableDataMap.get(key)!;
      existing.netPay += payroll.netPay;
      existing.grossPay += payroll.grossPay;
    }
  });
  
  const tableData = Array.from(tableDataMap.values());

  // 모달 열 때 초기 선택 상태 설정 (전체 선택, 외국인 제외)
  useEffect(() => {
    if (showExcelModal && tableData.length > 0) {
      const defaultIds = new Set(tableData
        .filter(row => {
          const emp = employees.find(e => e.id === row.id);
          return emp && emp.employmentType !== '외국인';
        })
        .map(row => row.id));
      setSelectedEmployeeIds(defaultIds);
    }
  }, [showExcelModal, tableData, employees]);

  // 엑셀 저장 함수
  const handleExcelDownload = () => {
    if (!selectedMonth) {
      alert('월을 선택해주세요.');
      return;
    }

    // 선택된 직원 필터링 (모두 선택 시 전체, 외국인 제외)
    const filteredData = tableData.filter(row => {
      if (selectedEmployeeIds.size === 0) {
        // 전체 선택 시 외국인만 제외
        const emp = employees.find(e => e.id === row.id);
        return emp && emp.employmentType !== '외국인';
      }
      return selectedEmployeeIds.has(row.id);
    });

    if (filteredData.length === 0) {
      alert('저장할 데이터가 없습니다.');
      return;
    }

    // 지점별로 그룹화
    const branchGroups = new Map<string, typeof filteredData>();
    filteredData.forEach(row => {
      const payroll = normalizedAllPayrolls.find(p => p.employeeId === row.id);
      const branchId = payroll?.branchId || '전체';
      const branchName = payroll?.branchName || '전체';
      const key = branchId;
      
      if (!branchGroups.has(key)) {
        branchGroups.set(key, []);
      }
      branchGroups.get(key)!.push(row);
    });

    // 엑셀 워크북 생성
    const wb = XLSX.utils.book_new();

    // 각 지점별로 시트 생성
    branchGroups.forEach((data, branchId) => {
      const branchName = branches.find(b => b.id === branchId)?.name || '전체';
      
      // 근로소득, 일용직, 사업소득으로 분류 (payroll 또는 employee에서 가져오기)
      const laborIncome = data.filter(row => {
        const payroll = normalizedAllPayrolls.find(p => p.employeeId === row.id);
        const emp = employees.find(e => e.id === row.id);
        const employmentType = payroll?.employmentType || emp?.employmentType;
        return employmentType === '근로소득';
      });
      const dailyWorker = data.filter(row => {
        const payroll = normalizedAllPayrolls.find(p => p.employeeId === row.id);
        const emp = employees.find(e => e.id === row.id);
        const employmentType = payroll?.employmentType || emp?.employmentType;
        return employmentType === '일용직';
      });
      const businessIncome = data.filter(row => {
        const payroll = normalizedAllPayrolls.find(p => p.employeeId === row.id);
        const emp = employees.find(e => e.id === row.id);
        const employmentType = payroll?.employmentType || emp?.employmentType;
        return employmentType && employmentType !== '근로소득' && employmentType !== '일용직';
      });

      // 섹션별 데이터 변환
      const convertToExcelData = (rows: typeof data) => rows.map(row => ({
        주민번호: row.residentNumber,
        성명: row.employeeName,
        입사일: row.hireDate,
        은행: row.bankName,
        은행코드: row.bankCode,
        지급액: row.netPay,
        신고총액: row.grossPay,
        비고: row.memo || ''
      }));

      const excelData: any[] = [];
      
      // 근로소득 섹션
      if (laborIncome.length > 0) {
        excelData.push({ 주민번호: '4대보험', 성명: '', 입사일: '', 은행: '', 은행코드: '', 지급액: '', 신고총액: '', 비고: '' });
        excelData.push(...convertToExcelData(laborIncome));
        excelData.push({}); // 빈 행
      }

      // 일용직 섹션
      if (dailyWorker.length > 0) {
        excelData.push({ 주민번호: '일용직', 성명: '', 입사일: '', 은행: '', 은행코드: '', 지급액: '', 신고총액: '', 비고: '' });
        excelData.push(...convertToExcelData(dailyWorker));
        excelData.push({}); // 빈 행
      }

      // 사업소득 섹션
      if (businessIncome.length > 0) {
        excelData.push({ 주민번호: '사업소득', 성명: '', 입사일: '', 은행: '', 은행코드: '', 지급액: '', 신고총액: '', 비고: '' });
        excelData.push(...convertToExcelData(businessIncome));
      }

      const ws = XLSX.utils.json_to_sheet(excelData);
      XLSX.utils.book_append_sheet(wb, ws, branchName);
    });

    // 파일명: YYYY-MM_세무사전송용_급여내역.xlsx
    const fileName = `${selectedMonth}_세무사전송용_급여내역.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    setShowExcelModal(false);
    alert('엑셀 파일이 저장되었습니다.');
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">세무사 전송파일 생성</h1>
            <p className="mt-1 text-sm text-gray-600">급여확정된 데이터를 기반으로 세무사 전송파일을 생성합니다</p>
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
              onClick={() => setShowExcelModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              📥 엑셀 저장
            </button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              🔄 상태 새로고침
            </button>
          </div>
        </div>
      </div>

      {/* 지점 탭 */}
      {selectedMonth && (
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setSelectedBranchId('')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  selectedBranchId === ''
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                전체 ({normalizedAllPayrolls.length}건)
              </button>
              {branches.map((branch) => {
                const branchCount = normalizedAllPayrolls.filter(p => p.branchId === branch.id).length;
                return (
                  <button
                    key={branch.id}
                    onClick={() => setSelectedBranchId(branch.id)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      selectedBranchId === branch.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {branch.name} ({branchCount}건)
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* 데이터 테이블 */}
      {selectedMonth && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              세무사 전송 데이터 ({filteredPayrolls.length}건)
            </h3>
          </div>
          
          {loading ? (
            <div className="px-6 py-12 text-center">
              <div className="text-gray-500">로딩 중...</div>
            </div>
          ) : tableData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      주민번호
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      성명
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      입사일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      은행
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      은행코드
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      지급액
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      신고총액
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      비고
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tableData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.residentNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.employeeName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.hireDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.bankName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.bankCode}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        {(row.netPay || 0).toLocaleString()}원
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        {(row.grossPay || 0).toLocaleString()}원
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editingMemo[row.id] !== undefined ? editingMemo[row.id] : row.memo}
                            onChange={(e) => setEditingMemo(prev => ({ ...prev, [row.id]: e.target.value }))}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="비고 입력"
                          />
                          {editingMemo[row.id] !== undefined && editingMemo[row.id] !== row.memo && (() => {
                            // 🔥 직원별로 그룹화되어 있으므로, 해당 직원의 첫 번째 payroll을 찾아서 사용
                            const payroll = normalizedAllPayrolls.find(p => p.employeeId === row.id);
                            const payrollId = payroll?.id || row.payrollId;
                            return (
                              <button
                                onClick={() => payrollId && saveMemo(payrollId, editingMemo[row.id])}
                                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium whitespace-nowrap"
                              >
                                저장
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <div className="text-gray-500 text-lg mb-2">📊</div>
              <div className="text-gray-500 text-lg mb-2">데이터 없음</div>
              <div className="text-gray-400 text-sm">
                선택한 월에 급여확정된 데이터가 없습니다.
              </div>
            </div>
          )}
        </div>
      )}

      {/* 엑셀 저장 모달 */}
      {showExcelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">엑셀 저장할 직원 선택</h2>
            
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => {
                  const allIds = new Set(tableData
                    .filter(row => {
                      const emp = employees.find(e => e.id === row.id);
                      return emp && emp.employmentType !== '외국인';
                    })
                    .map(row => row.id));
                  setSelectedEmployeeIds(allIds);
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                전체 선택 (외국인 제외)
              </button>
              <button
                onClick={() => setSelectedEmployeeIds(new Set())}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
              >
                전체 해제
              </button>
            </div>

            <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
              {tableData.map((row) => {
                const emp = employees.find(e => e.id === row.id);
                const isForeigner = emp?.employmentType === '외국인';
                const isSelected = selectedEmployeeIds.has(row.id);
                
                return (
                  <label
                    key={row.id}
                    className={`flex items-center p-2 border rounded cursor-pointer ${
                      isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'
                    } ${isForeigner ? 'opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        const newSet = new Set(selectedEmployeeIds);
                        if (e.target.checked) {
                          newSet.add(row.id);
                        } else {
                          newSet.delete(row.id);
                        }
                        console.log('체크박스 변경:', row.id, e.target.checked, Array.from(newSet));
                        setSelectedEmployeeIds(new Set(newSet)); // 완전히 새로운 Set 인스턴스 생성
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      disabled={isForeigner}
                      className="mr-2"
                    />
                    <span className="flex-1">
                      {row.employeeName} 
                      {isForeigner && <span className="text-gray-500 text-sm"> (외국인 - 제외됨)</span>}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowExcelModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                취소
              </button>
              <button
                onClick={handleExcelDownload}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                엑셀 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaxFileGeneration;
