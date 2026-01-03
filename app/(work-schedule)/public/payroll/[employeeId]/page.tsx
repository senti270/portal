'use client';

import React, { useState, useEffect, use } from 'react';
import { collection, getDocs, getDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useSearchParams } from 'next/navigation';

interface Employee {
  id: string;
  name: string;
  residentNumber?: string;
  email?: string;
}

interface ConfirmedPayroll {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string;
  calculations: any[];
  totalGrossPay?: number;
  totalDeductions?: number;
  totalNetPay?: number;
}

interface WorkTimeComparisonResult {
  id: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  month: string;
  date: string;
  actualWorkHours?: number;
  actualTimeRange?: string;
  posTimeRange?: string;
  actualBreakTime?: number;
}

interface PublicPayrollPageProps {
  params: Promise<{
    employeeId: string;
  }>;
}

export default function PublicPayrollPage({ params }: PublicPayrollPageProps) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payroll, setPayroll] = useState<ConfirmedPayroll | null>(null);
  const [workTimeComparisons, setWorkTimeComparisons] = useState<WorkTimeComparisonResult[]>([]);
  const [branches, setBranches] = useState<{id: string; name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 토큰에서 월 정보 추출
  const getMonthFromToken = (token: string): string | null => {
    try {
      const decoded = atob(token);
      const data = JSON.parse(decoded);
      return data.month || null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const employeeId = resolvedParams.employeeId;
        const token = searchParams.get('t');

        if (!token) {
          setError('유효하지 않은 링크입니다. (토큰 없음)');
          return;
        }

        // 토큰에서 월 정보 추출
        const month = getMonthFromToken(token);
        if (!month) {
          setError('유효하지 않은 링크입니다. (월 정보 추출 실패)');
          return;
        }

        // 직원 정보 로드 - 여러 방법으로 시도
        let employeeDoc = await getDoc(doc(db, 'employees', employeeId));
        let actualEmployeeId = employeeId;
        
        // 방법 1: URL의 ID가 employee ID인 경우
        if (!employeeDoc.exists()) {
          // 방법 2: URL의 ID가 confirmedPayrolls 문서 ID인 경우
          try {
            const payrollDoc = await getDoc(doc(db, 'confirmedPayrolls', employeeId));
            if (payrollDoc.exists()) {
              const payrollData = payrollDoc.data();
              actualEmployeeId = payrollData.employeeId;
              employeeDoc = await getDoc(doc(db, 'employees', actualEmployeeId));
            }
          } catch (e) {
            // 무시
          }
          
          // 방법 3: confirmedPayrolls에서 해당 월의 employeeId로 검색
          if (!employeeDoc.exists() && month) {
            try {
              const payrollQuery = query(
                collection(db, 'confirmedPayrolls'),
                where('month', '==', month)
              );
              const allPayrolls = await getDocs(payrollQuery);
              
              const matchingPayroll = allPayrolls.docs.find(doc => 
                doc.id === employeeId || doc.data().employeeId === employeeId
              );
              
              if (matchingPayroll) {
                const payrollData = matchingPayroll.data();
                actualEmployeeId = payrollData.employeeId || employeeId;
                employeeDoc = await getDoc(doc(db, 'employees', actualEmployeeId));
              }
            } catch (e) {
              // 무시
            }
          }
        }
        
        if (!employeeDoc.exists()) {
          // 디버깅 정보 수집
          let debugInfo = [
            `직원을 찾을 수 없습니다.`,
            `조회한 employeeId: ${employeeId}`,
            `시도한 actualEmployeeId: ${actualEmployeeId}`,
            `월: ${month}`
          ];
          
          try {
            const allEmployees = await getDocs(collection(db, 'employees'));
            debugInfo.push(`\n전체 직원 수: ${allEmployees.size}개`);
            debugInfo.push(`처음 10개 직원 ID 목록:`);
            allEmployees.docs.slice(0, 10).forEach((doc, idx) => {
              const data = doc.data();
              debugInfo.push(`  ${idx + 1}. ID: "${doc.id}", 이름: ${data.name || '이름 없음'}`);
            });
          } catch (debugErr) {
            debugInfo.push(`직원 목록 조회 오류: ${debugErr instanceof Error ? debugErr.message : String(debugErr)}`);
          }
          
          setError(debugInfo.join('\n'));
          return;
        }
        
        setEmployee({
          id: employeeDoc.id,
          ...employeeDoc.data()
        } as Employee);

        // 급여 데이터 로드
        const payrollQuery = query(
          collection(db, 'confirmedPayrolls'),
          where('employeeId', '==', actualEmployeeId),
          where('month', '==', month)
        );
        const payrollSnapshot = await getDocs(payrollQuery);
        
        if (payrollSnapshot.empty) {
          setError(`급여 데이터를 찾을 수 없습니다. (employeeId: ${actualEmployeeId}, month: ${month})`);
          return;
        }

        const payrollData = payrollSnapshot.docs[0].data();
        
        if (payrollData.month !== month) {
          setError('요청한 월의 급여 데이터를 찾을 수 없습니다.');
          return;
        }

        const calculations = payrollData.calculations || [];
        
        const totalGrossPay = calculations.reduce((sum: number, calc: any) => sum + (calc.grossPay || 0), 0);
        const totalDeductions = calculations.reduce((sum: number, calc: any) => {
          const deductions = calc.deductions;
          if (typeof deductions === 'object' && deductions !== null && 'total' in deductions) {
            return sum + (deductions.total || 0);
          }
          return sum + (typeof deductions === 'number' ? deductions : 0);
        }, 0);
        const totalNetPay = calculations.reduce((sum: number, calc: any) => sum + (calc.netPay || 0), 0);

        setPayroll({
          id: payrollSnapshot.docs[0].id,
          ...payrollData,
          totalGrossPay,
          totalDeductions,
          totalNetPay
        } as ConfirmedPayroll);

        // 근무시간 비교 데이터 로드
        const comparisonsQuery = query(
          collection(db, 'workTimeComparisonResults'),
          where('employeeId', '==', actualEmployeeId),
          where('month', '==', month)
        );
        const comparisonsSnapshot = await getDocs(comparisonsQuery);
        
        const comparisonsData = comparisonsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WorkTimeComparisonResult[];
        
        setWorkTimeComparisons(comparisonsData);

        // 지점 목록 로드
        const branchesSnapshot = await getDocs(collection(db, 'branches'));
        const branchesData = branchesSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || ''
        }));
        setBranches(branchesData);
      } catch (err) {
        setError(`데이터를 불러오는 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [resolvedParams.employeeId, searchParams]);

  // PDF 다운로드
  const handleDownloadPDF = async () => {
    if (!payroll || !employee) {
      alert('데이터를 불러올 수 없습니다.');
      return;
    }

    try {
      const element = document.getElementById('payroll-statement-content');
      if (!element) {
        alert('PDF 생성 대상 요소를 찾을 수 없습니다.');
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          const style = clonedDoc.createElement('style');
          style.textContent = `
            *, *::before, *::after {
              color: #000000 !important;
              background-color: #ffffff !important;
              border-color: #d1d5db !important;
              background-image: none !important;
              box-shadow: none !important;
            }
            .bg-gray-50, [class*="bg-gray-50"] { background-color: #f9fafb !important; }
            .bg-gray-100, [class*="bg-gray-100"] { background-color: #f3f4f6 !important; }
            .bg-gray-200, [class*="bg-gray-200"] { background-color: #e5e7eb !important; }
            .bg-blue-50, [class*="bg-blue-50"] { background-color: #eff6ff !important; }
            .text-gray-600, [class*="text-gray-600"] { color: #4b5563 !important; }
            .text-gray-700, [class*="text-gray-700"] { color: #374151 !important; }
            .text-gray-800, [class*="text-gray-800"] { color: #1f2937 !important; }
            .text-gray-900, [class*="text-gray-900"] { color: #111827 !important; }
            .text-blue-600, [class*="text-blue-600"] { color: #2563eb !important; }
            .text-red-600, [class*="text-red-600"] { color: #dc2626 !important; }
            .border-gray-200, [class*="border-gray-200"] { border-color: #e5e7eb !important; }
            .border-gray-300, [class*="border-gray-300"] { border-color: #d1d5db !important; }
            .border-gray-400, [class*="border-gray-400"] { border-color: #9ca3af !important; }
            table { border-collapse: collapse !important; }
            td, th { border: 1px solid #d1d5db !important; }
          `;
          clonedDoc.head.insertBefore(style, clonedDoc.head.firstChild);
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`급여명세서_${employee.name}_${payroll.month}.pdf`);
    } catch (err) {
      console.error('PDF 생성 실패:', err);
      alert('PDF 생성에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex justify-center items-center">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  if (error || !employee || !payroll) {
    return (
      <div className="min-h-screen bg-white flex justify-center items-center p-4">
        <div className="text-red-600 whitespace-pre-line font-mono text-sm max-w-4xl bg-red-50 p-4 rounded border border-red-200">
          <div className="font-bold mb-2">에러:</div>
          <div>{error || '데이터를 불러올 수 없습니다.'}</div>
        </div>
      </div>
    );
  }

  // 지점별 근무시간 계산
  const branchHoursMap = new Map<string, number>();
  workTimeComparisons.forEach((comparison) => {
    let branchName = comparison.branchName;
    if (!branchName && comparison.branchId) {
      const branch = branches.find(b => b.id === comparison.branchId);
      branchName = branch?.name || '-';
    } else if (!branchName) {
      branchName = '-';
    }
    const workHours = comparison.actualWorkHours || 0;
    const currentHours = branchHoursMap.get(branchName) || 0;
    branchHoursMap.set(branchName, currentHours + workHours);
  });
  const totalHours = Array.from(branchHoursMap.values()).reduce((sum, hours) => sum + hours, 0);

  // 지급/공제 항목 계산
  const allLineItems: Array<{type: 'earning' | 'deduction', label: string, amount: number, note: string}> = [];
  if (Array.isArray(payroll.calculations)) {
    payroll.calculations.forEach((calc: any) => {
      if (Array.isArray(calc.lineItems)) {
        calc.lineItems.forEach((item: any) => {
          const existingIndex = allLineItems.findIndex(li => li.label === item.label && li.type === item.type);
          if (existingIndex >= 0) {
            allLineItems[existingIndex].amount += (item.amount || 0);
          } else {
            allLineItems.push({
              type: item.type || 'earning',
              label: item.label || '',
              amount: item.amount || 0,
              note: item.note || ''
            });
          }
        });
      }
    });
  }
  const earningItems = allLineItems.filter(item => item.type === 'earning');
  const deductionItems = allLineItems.filter(item => item.type === 'deduction');
  const totalEarnings = earningItems.reduce((sum, item) => sum + item.amount, 0);
  const totalDeductions = deductionItems.reduce((sum, item) => sum + item.amount, 0);

  // 근무내역 데이터 준비
  const branchGroups: {[key: string]: WorkTimeComparisonResult[]} = {};
  workTimeComparisons.forEach((comparison) => {
    let branchName = comparison.branchName;
    if (!branchName && comparison.branchId) {
      const branch = branches.find(b => b.id === comparison.branchId);
      branchName = branch?.name || '-';
    } else if (!branchName) {
      branchName = '-';
    }
    if (!branchGroups[branchName]) {
      branchGroups[branchName] = [];
    }
    branchGroups[branchName].push(comparison);
  });

  const formatTime = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = dayNames[date.getDay()];
    return `${year}.${month}.${day}(${dayOfWeek})`;
  };

  const overallTotalActual = workTimeComparisons.reduce((sum, r) => sum + (Number(r.actualWorkHours) || 0), 0);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* 헤더 */}
        <div className="bg-white shadow rounded-lg p-3 sm:p-6 mb-3 sm:mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{employee.name}님의 급여명세서</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">{payroll.month} 급여</p>
            </div>
            <button
              onClick={handleDownloadPDF}
              className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
            >
              📄 PDF 다운로드
            </button>
          </div>
        </div>

        {/* 급여명세서 내용 */}
        <div id="payroll-statement-content" className="border border-gray-300 p-3 sm:p-6 bg-white">
          <div className="text-center mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">급여명세서</h1>
            <p className="text-sm sm:text-base text-gray-600">{payroll.month} 급여</p>
          </div>

          {/* 기본 정보 테이블 - 모바일에서는 세로 레이아웃 */}
          <div className="hidden sm:block mb-4 sm:mb-6">
            <table className="w-full border-collapse border border-gray-400">
              <tbody>
                <tr>
                  <td className="border border-gray-400 p-2 bg-gray-100 font-semibold w-1/4 text-sm">성명</td>
                  <td className="border border-gray-400 p-2 w-1/4 text-sm">{employee.name}</td>
                  <td className="border border-gray-400 p-2 bg-gray-100 font-semibold w-1/4 text-sm">주민번호</td>
                  <td className="border border-gray-400 p-2 w-1/4 text-sm">{employee.residentNumber || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 p-2 bg-gray-100 font-semibold text-sm">총 지급액</td>
                  <td className="border border-gray-400 p-2 text-sm">{(payroll.totalGrossPay || 0).toLocaleString()}원</td>
                  <td className="border border-gray-400 p-2 bg-gray-100 font-semibold text-sm">총 공제액</td>
                  <td className="border border-gray-400 p-2 text-red-600 text-sm">-{(payroll.totalDeductions || 0).toLocaleString()}원</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 p-2 bg-gray-100 font-semibold text-sm">실수령액</td>
                  <td className="border border-gray-400 p-2 font-bold text-blue-600 text-sm" colSpan={3}>{(payroll.totalNetPay || 0).toLocaleString()}원</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* 모바일용 기본 정보 */}
          <div className="sm:hidden mb-4 space-y-2">
            <div className="flex justify-between border-b pb-2">
              <span className="font-semibold text-sm">성명</span>
              <span className="text-sm">{employee.name}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="font-semibold text-sm">주민번호</span>
              <span className="text-sm">{employee.residentNumber || '-'}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="font-semibold text-sm">총 지급액</span>
              <span className="text-sm">{(payroll.totalGrossPay || 0).toLocaleString()}원</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="font-semibold text-sm">총 공제액</span>
              <span className="text-red-600 text-sm">-{(payroll.totalDeductions || 0).toLocaleString()}원</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="font-bold text-base">실수령액</span>
              <span className="font-bold text-blue-600 text-base">{(payroll.totalNetPay || 0).toLocaleString()}원</span>
            </div>
          </div>

          {/* 지점별 상세 */}
          {workTimeComparisons.length > 0 && (
            <div className="mb-4 sm:mb-6">
              <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">지점별 상세</h4>
              <div className="bg-blue-50 rounded-lg p-3 sm:p-4 border border-blue-200">
                <div className="text-blue-900 font-semibold mb-2 text-sm sm:text-base">실 근무시간</div>
                <div className="text-xl sm:text-2xl font-bold text-blue-900 mb-3 sm:mb-4">
                  {totalHours.toFixed(1)}h
                </div>
                <div className="space-y-1">
                  {Array.from(branchHoursMap.entries()).map(([branchName, hours], idx) => (
                    <div key={idx} className="flex justify-between text-blue-900 text-sm">
                      <span>{branchName}:</span>
                      <span className="font-medium">{hours.toFixed(1)}h</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 지급/공제 항목 */}
          <div className="mb-4 sm:mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 좌측: 지급항목 */}
              <div>
                <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">지급항목</h4>
                <table className="w-full border-collapse border border-gray-400 text-sm">
                  <thead>
                    <tr>
                      <th className="border border-gray-400 p-1.5 sm:p-2 bg-gray-100 font-semibold text-xs sm:text-sm">항목</th>
                      <th className="border border-gray-400 p-1.5 sm:p-2 bg-gray-100 font-semibold text-right text-xs sm:text-sm">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earningItems.length > 0 ? (
                      earningItems.map((item, idx) => (
                        <React.Fragment key={idx}>
                          <tr>
                            <td className="border border-gray-400 p-1.5 sm:p-2 text-gray-900 text-xs sm:text-sm">{item.label}</td>
                            <td className="border border-gray-400 p-1.5 sm:p-2 text-right text-gray-900 text-xs sm:text-sm">{item.amount.toLocaleString()}원</td>
                          </tr>
                          {item.note && (
                            <tr>
                              <td colSpan={2} className="border border-gray-400 p-1 pl-2 sm:pl-4">
                                <div className="text-xs text-gray-500 whitespace-pre-line">{item.note}</div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="border border-gray-400 p-1.5 sm:p-2 text-center text-gray-500 text-xs sm:text-sm">지급항목 없음</td>
                      </tr>
                    )}
                    <tr className="bg-gray-50 font-bold">
                      <td className="border border-gray-400 p-1.5 sm:p-2 text-gray-900 text-xs sm:text-sm">합계</td>
                      <td className="border border-gray-400 p-1.5 sm:p-2 text-right text-blue-600 text-xs sm:text-sm">{totalEarnings.toLocaleString()}원</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* 우측: 공제항목 */}
              <div>
                <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">공제항목</h4>
                <table className="w-full border-collapse border border-gray-400 text-sm">
                  <thead>
                    <tr>
                      <th className="border border-gray-400 p-1.5 sm:p-2 bg-gray-100 font-semibold text-xs sm:text-sm">항목</th>
                      <th className="border border-gray-400 p-1.5 sm:p-2 bg-gray-100 font-semibold text-right text-xs sm:text-sm">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deductionItems.length > 0 ? (
                      deductionItems.map((item, idx) => (
                        <React.Fragment key={idx}>
                          <tr>
                            <td className="border border-gray-400 p-1.5 sm:p-2 text-gray-900 text-xs sm:text-sm">{item.label}</td>
                            <td className="border border-gray-400 p-1.5 sm:p-2 text-right text-gray-900 text-xs sm:text-sm">-{item.amount.toLocaleString()}원</td>
                          </tr>
                          {item.note && (
                            <tr>
                              <td colSpan={2} className="border border-gray-400 p-1 pl-2 sm:pl-4">
                                <div className="text-xs text-gray-500 whitespace-pre-line">{item.note}</div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="border border-gray-400 p-1.5 sm:p-2 text-center text-gray-500 text-xs sm:text-sm">공제항목 없음</td>
                      </tr>
                    )}
                    <tr className="bg-gray-50 font-bold">
                      <td className="border border-gray-400 p-1.5 sm:p-2 text-gray-900 text-xs sm:text-sm">합계</td>
                      <td className="border border-gray-400 p-1.5 sm:p-2 text-right text-gray-900 text-xs sm:text-sm">-{totalDeductions.toLocaleString()}원</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* 실수령액 */}
            <div className="mt-3 sm:mt-4">
              <table className="w-full border-collapse border border-gray-400">
                <tbody>
                  <tr className="bg-blue-50 font-bold">
                    <td className="border border-gray-400 p-2 sm:p-2 w-1/2 text-sm sm:text-base">실수령액</td>
                    <td className="border border-gray-400 p-2 text-right text-blue-600 text-sm sm:text-base">{(totalEarnings - totalDeductions).toLocaleString()}원</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 기타사항 */}
          {Array.isArray(payroll.calculations) && (
            <div className="mt-3 sm:mt-4 mb-4 sm:mb-6">
              <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">기타사항</h4>
              <div className="text-xs sm:text-sm text-gray-700 space-y-2">
                {payroll.calculations.map((calc: any, idx) => {
                  const branchName = calc.branchName || (calc.branches && calc.branches[0]?.branchName) || '-';
                  const probationHours = calc.probationHours || 0;
                  const regularHours = calc.regularHours || 0;
                  const probationPay = calc.probationPay || 0;
                  const regularPay = calc.regularPay || 0;
                  const weeklyHolidayPay = calc.weeklyHolidayPay || 0;
                  const weeklyHolidayHours = calc.weeklyHolidayHours || 0;
                  const weeklyHolidayDetails = calc.weeklyHolidayDetails || [];
                  let hourlyWage = calc.hourlyWage || calc.salaryAmount || 0;
                  if (!hourlyWage && regularHours > 0 && regularPay > 0) {
                    hourlyWage = Math.round(regularPay / regularHours);
                  }
                  
                  return (
                    <div key={idx} className="border border-gray-200 p-3 bg-gray-50">
                      <div className="font-medium text-gray-900 mb-2">{branchName} 기준</div>
                      
                      {/* 주휴수당 주별 상세 */}
                      {(calc.salaryType === 'hourly' || calc.salaryType === '시급') && weeklyHolidayDetails && weeklyHolidayDetails.length > 0 && (
                        <div className="mb-3">
                          <div className="font-medium text-gray-800 mb-2">주휴수당 계산식 (주별):</div>
                          <div className="ml-2 space-y-2">
                            {[...weeklyHolidayDetails].sort((a: any, b: any) => {
                              const dateA = new Date(a.weekStart);
                              const dateB = new Date(b.weekStart);
                              return dateA.getTime() - dateB.getTime();
                            }).map((detail: any, detailIdx: number) => {
                              if (!detail.eligible) return null;
                              // 주휴수당 계산식: 시급 × 주휴시간 × 1.5 (수습기간이면 90% 적용)
                              const isProbationWeek = detail.reason && String(detail.reason).includes('수습기간');
                              const basePay = hourlyWage * detail.hours * 1.5;
                              const actualPay = isProbationWeek ? basePay * 0.9 : basePay;
                              
                              return (
                                <div key={detailIdx} className="text-gray-600 border-l-2 border-blue-300 pl-2 text-xs sm:text-sm">
                                  <div className="font-medium text-gray-700 mb-1">
                                    {detail.weekStart} ~ {detail.weekEnd}
                                  </div>
                                  <div className="text-gray-600">
                                    주휴수당 = 시급 × 주휴시간 × 1.5{isProbationWeek ? ' × 90%' : ''}<br/>
                                    = {hourlyWage.toLocaleString()}원 × {detail.hours.toFixed(1)}h × 1.5{isProbationWeek ? ' × 0.9' : ''}<br/>
                                    = {detail.pay.toLocaleString()}원 {isProbationWeek ? '(수습기간 90%)' : ''}
                                  </div>
                                </div>
                              );
                            })}
                            {weeklyHolidayPay > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-300 font-semibold text-gray-800">
                                주휴수당 합계: {weeklyHolidayPay.toLocaleString()}원
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* 주휴수당 (기존 전체 합계 - weeklyHolidayDetails가 없을 때만) */}
                      {(!weeklyHolidayDetails || weeklyHolidayDetails.length === 0) && weeklyHolidayPay > 0 && weeklyHolidayHours > 0 && (
                        <div className="mb-2">
                          <div className="font-medium text-gray-800">주휴수당 계산식:</div>
                          <div className="text-gray-600 ml-2">
                            주휴수당 = 시급 × 주휴시간 × 1.5<br/>
                            = {hourlyWage.toLocaleString()}원 × {weeklyHolidayHours}h × 1.5<br/>
                            = {weeklyHolidayPay.toLocaleString()}원
                          </div>
                        </div>
                      )}
                      
                      {probationHours > 0 && (
                        <div className="mb-2">
                          <div className="font-medium text-gray-800">수습 계산식:</div>
                          <div className="text-gray-600 ml-2">
                            수습급여 = 시급 × 수습시간 × 90%<br/>
                            = {hourlyWage.toLocaleString()}원 × {probationHours.toFixed(2)}h × 0.9<br/>
                            = {probationPay.toLocaleString()}원
                          </div>
                        </div>
                      )}
                      
                      {regularHours > 0 && (
                        <div className="mb-2">
                          <div className="font-medium text-gray-800">정규급여 계산식:</div>
                          <div className="text-gray-600 ml-2">
                            정규급여 = 시급 × 정규시간<br/>
                            = {hourlyWage.toLocaleString()}원 × {regularHours.toFixed(2)}h<br/>
                            = {regularPay.toLocaleString()}원
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 서명란 */}
          <div className="mt-4 sm:mt-8">
            <div className="border border-gray-400 p-3 sm:p-4">
              <div className="text-right">
                <div className="mb-2 text-sm sm:text-base">청담장어마켓 동탄점</div>
                <div className="relative text-sm sm:text-base">
                  대표자: 이진영
                  <span className="relative inline-block ml-2">(인)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 sm:mt-6 text-center">
            <p className="text-xs sm:text-sm text-gray-700 mb-2">
              위 내역과 같이 급여가 지급되었음을 증명합니다.
            </p>
            <p className="text-xs sm:text-sm text-gray-600">
              발급일: {new Date().toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
        </div>

        {/* 근무내역 */}
        {workTimeComparisons.length > 0 && (
          <div className="mt-4 sm:mt-6 bg-white shadow rounded-lg p-3 sm:p-6">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4">근무내역</h3>
            <div className="border border-gray-300 p-3 sm:p-6 bg-white">
              <div className="text-center mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">근무내역</h1>
                <p className="text-sm sm:text-base text-gray-600">{employee.name} - {payroll.month}</p>
              </div>

              {/* 직원 정보 테이블 - 모바일에서는 세로 레이아웃 */}
              <div className="hidden sm:block mb-4 sm:mb-6">
                <table className="w-full border-collapse border border-gray-400 text-sm">
                <tbody>
                  <tr>
                    <td className="border border-gray-400 p-2 bg-gray-100 font-semibold w-1/4">직원명</td>
                    <td className="border border-gray-400 p-2 w-1/4">{employee.name}</td>
                    <td className="border border-gray-400 p-2 bg-gray-100 font-semibold w-1/4">주민번호</td>
                    <td className="border border-gray-400 p-2 w-1/4">{employee.residentNumber || '-'}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-400 p-2 bg-gray-100 font-semibold">근무기간</td>
                    <td className="border border-gray-400 p-2">{payroll.month}</td>
                    <td className="border border-gray-400 p-2 bg-gray-100 font-semibold">총 실근무시간</td>
                    <td className="border border-gray-400 p-2 font-bold text-blue-600">
                      {formatTime(overallTotalActual || 0)}
                    </td>
                  </tr>
                </tbody>
                </table>
              </div>
              
              {/* 모바일용 직원 정보 */}
              <div className="sm:hidden mb-4 space-y-2">
                <div className="flex justify-between border-b pb-2">
                  <span className="font-semibold text-sm">직원명</span>
                  <span className="text-sm">{employee.name}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="font-semibold text-sm">주민번호</span>
                  <span className="text-sm">{employee.residentNumber || '-'}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="font-semibold text-sm">근무기간</span>
                  <span className="text-sm">{payroll.month}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="font-semibold text-sm">총 실근무시간</span>
                  <span className="font-bold text-blue-600 text-sm">{formatTime(overallTotalActual || 0)}</span>
                </div>
              </div>

              {/* 지점별 근무내역 */}
              {Object.entries(branchGroups).map(([branchName, comparisons]) => {
                const rows = comparisons.map((item) => {
                  const parseRange = (range: any) => {
                    if (!range || typeof range !== 'string' || !range.includes('-')) return { start: '-', end: '-' };
                    const [s, e] = range.split('-');
                    return { start: s || '-', end: e || '-' };
                  };
                  const pos = parseRange(item.posTimeRange);
                  const actual = parseRange(item.actualTimeRange);
                  const actualHours = item.actualWorkHours ?? 0;
                  const breakTime = item.actualBreakTime ?? 0;
                  return {
                    date: item.date,
                    posStartTime: pos.start,
                    posEndTime: pos.end,
                    actualStartTime: actual.start,
                    actualEndTime: actual.end,
                    actualBreakTime: breakTime,
                    actualWorkHours: actualHours
                  };
                });
                
                rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                
                const branchTotalHours = rows.filter(r => (Number(r.actualWorkHours) || 0) > 0).reduce((sum, r) => sum + (Number(r.actualWorkHours) || 0), 0);
                
                return (
                  <div key={branchName} className="mb-6 sm:mb-8">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">{branchName}</h3>
                    
                    {/* 데스크톱용 테이블 */}
                    <div className="hidden sm:block overflow-x-auto mb-4">
                      <table className="w-full border-collapse border border-gray-400 text-sm">
                        <thead>
                          <tr>
                            <th className="border border-gray-400 p-2 bg-gray-100 font-semibold" rowSpan={2}>날짜</th>
                            <th className="border border-gray-400 p-2 bg-gray-100 font-semibold" colSpan={2}>POS</th>
                            <th className="border border-gray-400 p-2 bg-gray-100 font-semibold" colSpan={2}>실근무</th>
                            <th className="border border-gray-400 p-2 bg-gray-100 font-semibold" rowSpan={2}>휴게시간</th>
                            <th className="border border-gray-400 p-2 bg-gray-100 font-semibold" rowSpan={2}>근무시간</th>
                          </tr>
                          <tr>
                            <th className="border border-gray-400 p-2 bg-gray-100 font-semibold">출근</th>
                            <th className="border border-gray-400 p-2 bg-gray-100 font-semibold">퇴근</th>
                            <th className="border border-gray-400 p-2 bg-gray-100 font-semibold">출근</th>
                            <th className="border border-gray-400 p-2 bg-gray-100 font-semibold">퇴근</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.filter(result => (Number(result.actualWorkHours) || 0) > 0).map((result, index) => (
                            <tr key={index}>
                              <td className="border border-gray-400 p-2 text-center">{formatDate(result.date)}</td>
                              <td className="border border-gray-400 p-2 text-center">{result.posStartTime || '-'}</td>
                              <td className="border border-gray-400 p-2 text-center">{result.posEndTime || '-'}</td>
                              <td className="border border-gray-400 p-2 text-center">{result.actualStartTime || '-'}</td>
                              <td className="border border-gray-400 p-2 text-center">{result.actualEndTime || '-'}</td>
                              <td className="border border-gray-400 p-2 text-center">
                                {formatTime(result.actualBreakTime || 0)}
                              </td>
                              <td className="border border-gray-400 p-2 text-center font-semibold">
                                {formatTime(result.actualWorkHours || 0)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50 font-bold">
                            <td className="border border-gray-400 p-2 text-center" colSpan={6}>합계</td>
                            <td className="border border-gray-400 p-2 text-center text-blue-600">
                              {formatTime(branchTotalHours)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    {/* 모바일용 카드 레이아웃 */}
                    <div className="sm:hidden space-y-3">
                      {rows.filter(result => (Number(result.actualWorkHours) || 0) > 0).map((result, index) => (
                        <div key={index} className="border border-gray-300 rounded-lg p-3 bg-gray-50">
                          <div className="font-semibold text-sm mb-2">{formatDate(result.date)}</div>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-600">POS 출근:</span>
                              <span>{result.posStartTime || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">POS 퇴근:</span>
                              <span>{result.posEndTime || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">실 출근:</span>
                              <span className="font-medium">{result.actualStartTime || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">실 퇴근:</span>
                              <span className="font-medium">{result.actualEndTime || '-'}</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-gray-200">
                              <span className="text-gray-600">휴게시간:</span>
                              <span>{formatTime(result.actualBreakTime || 0)}</span>
                            </div>
                            <div className="flex justify-between pt-1">
                              <span className="font-semibold">근무시간:</span>
                              <span className="font-bold text-blue-600">{formatTime(result.actualWorkHours || 0)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="border border-gray-400 rounded-lg p-3 bg-blue-50 font-bold text-center">
                        <div className="text-xs text-gray-600 mb-1">지점 합계</div>
                        <div className="text-lg text-blue-600">{formatTime(branchTotalHours)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* 총합계 */}
              <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 border border-blue-300">
                <div className="text-center">
                  <div className="text-base sm:text-lg font-semibold text-gray-900 mb-2">총합계</div>
                  <div className="text-xl sm:text-2xl font-bold text-blue-600">
                    {formatTime(overallTotalActual || 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
