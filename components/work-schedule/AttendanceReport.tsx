'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDate } from '@/lib/attendance-utils';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  date: string;
  type: 'checkin' | 'checkout';
  actualTime: Date;
  status?: 'on_time' | 'late' | 'early';
  lateMinutes?: number;
  earlyMinutes?: number;
  reason?: string;
  reasonOther?: string;
  note?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
}

interface Branch {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  name: string;
}

export default function AttendanceReport() {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // 필터 상태
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  useEffect(() => {
    loadBranches();
    loadEmployees();
  }, []);

  useEffect(() => {
    loadAttendanceRecords();
  }, [selectedMonth, selectedBranchId, selectedEmployeeId]);

  const loadBranches = async () => {
    try {
      const branchesSnapshot = await getDocs(collection(db, 'branches'));
      const branchesData = branchesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || ''
      })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      setBranches(branchesData);
    } catch (error) {
      console.error('지점 목록 로드 실패:', error);
    }
  };

  const loadEmployees = async () => {
    try {
      const employeesSnapshot = await getDocs(collection(db, 'employees'));
      const employeesData = employeesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || ''
      })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      setEmployees(employeesData);
    } catch (error) {
      console.error('직원 목록 로드 실패:', error);
    }
  };

  const loadAttendanceRecords = async () => {
    try {
      setLoading(true);
      
      // 선택한 월의 시작일과 종료일 계산
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      
      const startDateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);
      
      // 쿼리 조건 구성
      const constraints: any[] = [];
      
      // 날짜 범위 필터링 (월별)
      // Firestore에서 문자열 비교로 날짜 범위 필터링
      constraints.push(where('date', '>=', startDateStr));
      constraints.push(where('date', '<=', endDateStr));
      
      // 지점 필터링
      if (selectedBranchId) {
        constraints.push(where('branchId', '==', selectedBranchId));
      }
      
      // 직원 필터링
      if (selectedEmployeeId) {
        constraints.push(where('employeeId', '==', selectedEmployeeId));
      }
      
      // 쿼리 실행
      // orderBy는 where와 함께 사용할 때 인덱스가 필요할 수 있으므로
      // 가능한 한 간단한 쿼리로 구성
      let attendanceQuery;
      if (constraints.length === 2) {
        // 날짜 필터만 있는 경우
        attendanceQuery = query(
          collection(db, 'attendanceRecords'),
          ...constraints,
          orderBy('date', 'desc')
        );
      } else {
        // 다른 필터가 있는 경우 orderBy 없이 조회 후 클라이언트에서 정렬
        attendanceQuery = query(
          collection(db, 'attendanceRecords'),
          ...constraints
        );
      }
      
      const snapshot = await getDocs(attendanceQuery);
      
      const recordsData: AttendanceRecord[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const actualTime = data.actualTime?.toDate 
          ? data.actualTime.toDate() 
          : (data.actualTime ? new Date(data.actualTime) : new Date());
        
        recordsData.push({
          id: doc.id,
          employeeId: data.employeeId || '',
          employeeName: data.employeeName || '',
          branchId: data.branchId || '',
          branchName: data.branchName || '',
          date: data.date || '',
          type: data.type || 'checkin',
          actualTime,
          status: data.status,
          lateMinutes: data.lateMinutes,
          earlyMinutes: data.earlyMinutes,
          reason: data.reason,
          reasonOther: data.reasonOther,
          note: data.note,
          scheduledStartTime: data.scheduledStartTime,
          scheduledEndTime: data.scheduledEndTime
        });
      });
      
      // 클라이언트에서 정렬 (날짜 내림차순, 시간 내림차순)
      recordsData.sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        return b.actualTime.getTime() - a.actualTime.getTime();
      });
      
      setRecords(recordsData);
    } catch (error) {
      console.error('근태 기록 로드 실패:', error);
      alert('근태 기록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 날짜별로 그룹화
  const groupedByDate = records.reduce((acc, record) => {
    if (!acc[record.date]) {
      acc[record.date] = [];
    }
    acc[record.date].push(record);
    return acc;
  }, {} as Record<string, AttendanceRecord[]>);

  // 직원별로 그룹화
  const groupedByEmployee = records.reduce((acc, record) => {
    if (!acc[record.employeeId]) {
      acc[record.employeeId] = {
        employeeName: record.employeeName,
        records: []
      };
    }
    acc[record.employeeId].records.push(record);
    return acc;
  }, {} as Record<string, { employeeName: string; records: AttendanceRecord[] }>);

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">근태보고서</h3>
        
        {/* 필터 섹션 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* 월 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              월 선택
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* 지점 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              지점 선택
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* 직원 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              직원 선택
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체</option>
              {employees.map(employee => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* 통계 정보 */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">총 기록 수:</span>
              <span className="ml-2 font-semibold text-gray-900">{records.length}건</span>
            </div>
            <div>
              <span className="text-gray-600">출근 기록:</span>
              <span className="ml-2 font-semibold text-green-600">
                {records.filter(r => r.type === 'checkin').length}건
              </span>
            </div>
            <div>
              <span className="text-gray-600">퇴근 기록:</span>
              <span className="ml-2 font-semibold text-blue-600">
                {records.filter(r => r.type === 'checkout').length}건
              </span>
            </div>
            <div>
              <span className="text-gray-600">지각/일찍:</span>
              <span className="ml-2 font-semibold text-orange-600">
                {records.filter(r => r.status === 'late' || r.status === 'early').length}건
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 데이터 테이블 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          선택한 조건에 해당하는 근태 기록이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  날짜
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  지점
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  직원명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  구분
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  실제 시간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  스케줄 시간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  사유/메모
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.branchName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {record.employeeName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {record.type === 'checkin' ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        출근
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        퇴근
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.actualTime.toLocaleTimeString('ko-KR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.type === 'checkin' 
                      ? (record.scheduledStartTime || '-')
                      : (record.scheduledEndTime || '-')
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {record.status === 'on_time' ? (
                      <span className="text-green-600">정시</span>
                    ) : record.status === 'late' ? (
                      <span className="text-red-600">
                        지각 {record.lateMinutes ? `+${record.lateMinutes}분` : ''}
                      </span>
                    ) : record.status === 'early' ? (
                      <span className="text-orange-600">
                        일찍 {record.earlyMinutes ? `-${record.earlyMinutes}분` : ''}
                      </span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="max-w-xs">
                      {record.reason && (
                        <div className="text-xs">
                          사유: {record.reason}
                          {record.reasonOther && ` (${record.reasonOther})`}
                        </div>
                      )}
                      {record.note && (
                        <div className="text-xs mt-1 text-gray-400">
                          메모: {record.note}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

