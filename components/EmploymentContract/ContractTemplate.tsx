'use client'

import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import SignaturePad from './SignaturePad'

interface Branch {
  id: string
  name: string
  companyName?: string
  ceoName?: string
  businessNumber?: string
  address?: string
  phone?: string
}

interface ContractTemplateProps {
  branch: Branch
  onComplete: (data: ContractData) => void
  contractFileUrl?: string | null
}

export interface ContractData {
  // 근로자 정보
  employeeName: string
  residentNumber: string
  employeeAddress: string
  employeePhone: string
  employeeEmail?: string
  
  // 계약 정보
  startDateYear: string
  startDateMonth: string
  startDateDay: string
  endDateYear?: string
  endDateMonth?: string
  endDateDay?: string
  probationPeriod: string // 수습기간 (개월)
  
  // 근무장소 (고정 텍스트)
  
  // 업무 내용 (고정 텍스트)
  
  // 소정근로시간
  workStartHour: string
  workStartMinute: string
  workEndHour: string
  workEndMinute: string
  breakStartHour?: string
  breakStartMinute?: string
  breakEndHour?: string
  breakEndMinute?: string
  
  // 근무일/휴일
  workDaysPerWeek: string // 매주 몇 일
  workDaysDetail?: string // 근무요일 (필요시)
  selectedWorkDays: string[] // 선택한 근무요일 (월~일)
  weeklyHolidayDay: string // 주휴일 요일
  
  // 임금
  employmentType?: string // 고용형태 ('근로소득', '사업소득', '일용직', '외국인')
  salaryType: 'monthly' | 'daily' | 'hourly'
  salaryAmount: string
  includesWeeklyHoliday: boolean // 주휴수당 포함 여부
  paymentDay: string // 임금지급일
  paymentMethod: 'cash' | 'bank' // 지급방법
  bankName?: string // 은행명
  bankAccount?: string // 계좌번호
  
  // 계약일자
  contractDateYear: string
  contractDateMonth: string
  contractDateDay: string
  
  // 서명
  employeeSignature: string
  employerSignature: string
}

interface BankCode {
  id: string
  name: string
  code: string
}

export default function ContractTemplate({ branch, onComplete, contractFileUrl }: ContractTemplateProps) {
  const [step, setStep] = useState<'form' | 'signature' | 'complete'>('form')
  const [currentSigner, setCurrentSigner] = useState<'employee' | 'employer'>('employee')
  const [employeeSignature, setEmployeeSignature] = useState<string>('')
  const [employerSignature, setEmployerSignature] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [banks, setBanks] = useState<BankCode[]>([])

  const [formData, setFormData] = useState<ContractData>({
    employeeName: '',
    residentNumber: '',
    employeeAddress: '',
    employeePhone: '',
    employeeEmail: '',
    startDateYear: new Date().getFullYear().toString(),
    startDateMonth: String(new Date().getMonth() + 1).padStart(2, '0'),
    startDateDay: String(new Date().getDate()).padStart(2, '0'),
    probationPeriod: '1',
    workStartHour: '09',
    workStartMinute: '00',
    workEndHour: '18',
    workEndMinute: '00',
    workDaysPerWeek: '5',
    selectedWorkDays: ['월', '화', '수', '목', '금'],
    weeklyHolidayDay: '일',
    employmentType: '사업소득', // 기본값
    salaryType: 'hourly',
    salaryAmount: '',
    includesWeeklyHoliday: false,
    paymentDay: '10',
    paymentMethod: 'bank',
    contractDateYear: new Date().getFullYear().toString(),
    contractDateMonth: String(new Date().getMonth() + 1).padStart(2, '0'),
    contractDateDay: String(new Date().getDate()).padStart(2, '0'),
    employeeSignature: '',
    employerSignature: ''
  })

  useEffect(() => {
    loadBanks()
  }, [])

  const loadBanks = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'bankCodes'))
      const banksData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BankCode[]
      setBanks(banksData.sort((a, b) => a.name.localeCompare(b.name, 'ko')))
    } catch (error) {
      console.error('은행 목록을 불러올 수 없습니다:', error)
    }
  }

  const handleInputChange = (field: keyof ContractData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleWorkDayToggle = (day: string) => {
    setFormData(prev => {
      const currentSelected = prev.selectedWorkDays || []
      let newSelected: string[]
      
      if (currentSelected.includes(day)) {
        // 체크 해제
        newSelected = currentSelected.filter(d => d !== day)
      } else {
        // 체크 추가
        newSelected = [...currentSelected, day]
      }
      
      // 선택된 요일 개수로 매주 x일 업데이트
      const workDaysCount = newSelected.length.toString()
      
      // 선택되지 않은 요일 중 첫 번째를 주휴일로 자동 설정
      const allDays = ['월', '화', '수', '목', '금', '토', '일']
      const notSelected = allDays.filter(d => !newSelected.includes(d))
      const newHolidayDay = notSelected.length > 0 ? notSelected[0] : prev.weeklyHolidayDay
      
      return {
        ...prev,
        selectedWorkDays: newSelected,
        workDaysPerWeek: workDaysCount,
        weeklyHolidayDay: newHolidayDay,
        workDaysDetail: newSelected.join(', ')
      }
    })
  }

  const handleSignatureComplete = (signature: string) => {
    if (currentSigner === 'employee') {
      setEmployeeSignature(signature)
      handleInputChange('employeeSignature', signature)
      // 근로자 서명 완료 후 사업주 서명으로 전환
      setTimeout(() => {
        setCurrentSigner('employer')
        // 서명 패드 초기화를 위해 약간의 지연
      }, 100)
    } else {
      // 사업주 서명 완료
      setEmployerSignature(signature)
      handleInputChange('employerSignature', signature)
      // state 업데이트 후 저장 (약간의 지연)
      setTimeout(() => {
        handleSave(signature)
      }, 50)
    }
  }

  const handleSave = async (employerSig?: string) => {
    setLoading(true)
    try {
      // 최신 서명 데이터 사용 (파라미터로 받은 값 우선, 없으면 state 사용)
      const finalEmployerSignature = employerSig || employerSignature
      const finalData = {
        ...formData,
        employeeSignature: employeeSignature || formData.employeeSignature,
        employerSignature: finalEmployerSignature || formData.employerSignature
      }
      
      // 서명 검증
      if (!finalData.employeeSignature) {
        throw new Error('근로자 서명이 필요합니다.')
      }
      if (!finalData.employerSignature) {
        throw new Error('사업주 서명이 필요합니다.')
      }
      
      await onComplete(finalData)
      // 성공한 경우에만 complete 단계로 이동
      setStep('complete')
    } catch (error) {
      console.error('계약서 저장 중 오류:', error)
      // 에러는 이미 ContractTemplateHandler에서 alert로 표시했으므로 여기서는 다시 표시하지 않음
      // step을 'complete'로 변경하지 않아서 사용자가 다시 시도할 수 있도록 함
      setStep('signature') // 서명 단계로 되돌림
    } finally {
      setLoading(false)
    }
  }

  const validateForm = (): boolean => {
    if (!formData.employeeName.trim()) {
      alert('근로자 성명을 입력해주세요.')
      return false
    }
    if (!formData.residentNumber.trim()) {
      alert('주민등록번호를 입력해주세요.')
      return false
    }
    // 주민등록번호 형식 검증 (간단한 형식 체크)
    const residentNumberPattern = /^\d{6}-?\d{7}$/
    if (!residentNumberPattern.test(formData.residentNumber.replace(/-/g, ''))) {
      alert('주민등록번호 형식이 올바르지 않습니다. (예: 000000-0000000)')
      return false
    }
    if (!formData.employeeAddress.trim()) {
      alert('근로자 주소를 입력해주세요.')
      return false
    }
    if (!formData.employeePhone.trim()) {
      alert('근로자 연락처를 입력해주세요.')
      return false
    }
    // 전화번호 형식 검증 (간단한 형식 체크)
    const phonePattern = /^01[0-9]-?\d{3,4}-?\d{4}$/
    if (!phonePattern.test(formData.employeePhone.replace(/-/g, ''))) {
      alert('연락처 형식이 올바르지 않습니다. (예: 010-0000-0000)')
      return false
    }
    if (!formData.salaryAmount || parseFloat(formData.salaryAmount) <= 0) {
      alert('임금을 올바르게 입력해주세요.')
      return false
    }
    if (formData.paymentMethod === 'bank' && (!formData.bankName || !formData.bankAccount)) {
      alert('계좌입금을 선택한 경우 은행명과 계좌번호를 입력해주세요.')
      return false
    }
    return true
  }

  if (step === 'signature') {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          서명 ({currentSigner === 'employee' ? '근로자' : '사업주'})
        </h2>
        {currentSigner === 'employee' && employeeSignature && (
          <div className="mb-4 p-4 bg-green-50 rounded-lg">
            <p className="text-green-700">✓ 근로자 서명이 완료되었습니다. 이제 사업주 서명을 진행해주세요.</p>
          </div>
        )}
        {currentSigner === 'employer' && employeeSignature && (
          <div className="mb-4 p-4 bg-green-50 rounded-lg">
            <p className="text-green-700">✓ 근로자 서명이 완료되었습니다. 이제 사업주 서명을 진행해주세요.</p>
          </div>
        )}
        {loading && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-blue-700">계약서를 저장하는 중입니다...</p>
          </div>
        )}
        <SignaturePad
          key={currentSigner}
          onComplete={handleSignatureComplete}
          onClear={() => {
            if (currentSigner === 'employee') {
              setEmployeeSignature('')
            } else {
              setEmployerSignature('')
            }
          }}
        />
        <div className="mt-4 flex gap-4">
          <button
            onClick={() => {
              setStep('form')
              setCurrentSigner('employee')
              setEmployeeSignature('')
              setEmployerSignature('')
            }}
            disabled={loading}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
          >
            이전
          </button>
        </div>
      </div>
    )
  }

  if (step === 'complete') {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            근로계약서 작성 완료
          </h2>
          <p className="text-gray-600 mb-6">
            근로계약서가 성공적으로 작성되었고 직원관리에 자동으로 등록되었습니다.
          </p>
        </div>

        {contractFileUrl && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              작성된 근로계약서
            </h3>
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <iframe
                src={contractFileUrl}
                className="w-full"
                style={{ height: '800px' }}
                title="근로계약서 PDF"
              />
            </div>
            <div className="mt-4 flex gap-4 justify-center">
              <a
                href={contractFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                새 탭에서 열기
              </a>
              <a
                href={contractFileUrl}
                download
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                PDF 다운로드
              </a>
            </div>
          </div>
        )}
      </div>
    )
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i)
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = ['00', '15', '30', '45']
  const weekDays = ['월', '화', '수', '목', '금', '토', '일']

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="max-w-4xl mx-auto">
        {/* 표준근로계약서 제목 */}
        <h1 className="text-2xl font-bold text-center mb-8">표준근로계약서</h1>
        
        {/* 서문 */}
        <div className="mb-6">
          <p className="text-base leading-relaxed">
            <span className="font-semibold">{branch.ceoName || '대표자'}</span> (이하 "사업주"라 함)과(와) {' '}
            <input
              type="text"
              value={formData.employeeName}
              onChange={(e) => handleInputChange('employeeName', e.target.value)}
              placeholder="근로자 성명"
              className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 inline-block focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm min-w-[120px] text-center"
            />
            {' '}(이하 "근로자"라 함)은 다음과 같이 근로계약을 체결한다.
          </p>
        </div>

        {/* 1. 근로개시일 */}
        <div className="mb-6">
          <p className="text-base mb-2">
            <span className="font-semibold">1. 근로개시일</span> : {' '}
            <select
              value={formData.startDateYear}
              onChange={(e) => handleInputChange('startDateYear', e.target.value)}
              className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {' '}년 {' '}
            <select
              value={formData.startDateMonth}
              onChange={(e) => handleInputChange('startDateMonth', e.target.value)}
              className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
            >
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {' '}월 {' '}
            <select
              value={formData.startDateDay}
              onChange={(e) => handleInputChange('startDateDay', e.target.value)}
              className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
            >
              {days.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {' '}일부터 (필요시 종료일 기재)
          </p>
          {formData.endDateYear && (
            <p className="text-base mb-2">
              종료일 : {' '}
              <select
                value={formData.endDateYear}
                onChange={(e) => handleInputChange('endDateYear', e.target.value)}
                className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {' '}년 {' '}
              <select
                value={formData.endDateMonth}
                onChange={(e) => handleInputChange('endDateMonth', e.target.value)}
                className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
              >
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {' '}월 {' '}
              <select
                value={formData.endDateDay}
                onChange={(e) => handleInputChange('endDateDay', e.target.value)}
                className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
              >
                {days.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {' '}일
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              if (!formData.endDateYear) {
                handleInputChange('endDateYear', formData.startDateYear)
                handleInputChange('endDateMonth', formData.startDateMonth)
                handleInputChange('endDateDay', formData.startDateDay)
              } else {
                handleInputChange('endDateYear', undefined)
                handleInputChange('endDateMonth', undefined)
                handleInputChange('endDateDay', undefined)
              }
            }}
            className="text-sm text-blue-600 hover:underline mb-2"
          >
            {formData.endDateYear ? '종료일 제거' : '종료일 추가'}
          </button>
          <p className="text-base mb-1">
            - 최초 {' '}
            <input
              type="number"
              value={formData.probationPeriod}
              onChange={(e) => handleInputChange('probationPeriod', e.target.value)}
              className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 w-16 text-center focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
              min="0"
            />
            {' '}개월은 수습기간임. 수습기간은 임금의 90% 지급함.
          </p>
          <p className="text-base">
            - 단, 수습기간 중 업무평가결과에 따라 계약을 해지할 수 있음
          </p>
        </div>

        {/* 2. 근무장소 */}
        <div className="mb-6">
          <p className="text-base">
            <span className="font-semibold">2. 근 무 장 소</span> : 청담장어마켓(송파점/동탄점/분당점), 카페드로잉(송파점/홍대점/동탄점), 사업주가 관리하는 신규추가지점
          </p>
        </div>

        {/* 3. 업무의 내용 */}
        <div className="mb-6">
          <p className="text-base">
            <span className="font-semibold">3. 업무의 내용</span> : 고객응대 및 서빙, 음료, 음식제조 및 매장관리 등 사업장이 지정한 업무
          </p>
        </div>

        {/* 4. 소정근로시간 */}
        <div className="mb-6">
          <p className="text-base mb-2">
            <span className="font-semibold">4. 소정근로시간</span> : {' '}
            <select
              value={formData.workStartHour}
              onChange={(e) => handleInputChange('workStartHour', e.target.value)}
              className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
            >
              {hours.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            {' '}시 {' '}
            <select
              value={formData.workStartMinute}
              onChange={(e) => handleInputChange('workStartMinute', e.target.value)}
              className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
            >
              {minutes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {' '}분 ~ {' '}
            <select
              value={formData.workEndHour}
              onChange={(e) => handleInputChange('workEndHour', e.target.value)}
              className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
            >
              {hours.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            {' '}시 {' '}
            <select
              value={formData.workEndMinute}
              onChange={(e) => handleInputChange('workEndMinute', e.target.value)}
              className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
            >
              {minutes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {' '}분 (휴게시간 : {' '}
            {formData.breakStartHour ? (
              <>
                <select
                  value={formData.breakStartHour}
                  onChange={(e) => handleInputChange('breakStartHour', e.target.value)}
                  className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
                >
                  {hours.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                {' '}시 {' '}
                <select
                  value={formData.breakStartMinute}
                  onChange={(e) => handleInputChange('breakStartMinute', e.target.value)}
                  className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
                >
                  {minutes.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {' '}분 ~ {' '}
                <select
                  value={formData.breakEndHour}
                  onChange={(e) => handleInputChange('breakEndHour', e.target.value)}
                  className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
                >
                  {hours.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                {' '}시 {' '}
                <select
                  value={formData.breakEndMinute}
                  onChange={(e) => handleInputChange('breakEndMinute', e.target.value)}
                  className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
                >
                  {minutes.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {' '}분)
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    handleInputChange('breakStartHour', '12')
                    handleInputChange('breakStartMinute', '00')
                    handleInputChange('breakEndHour', '13')
                    handleInputChange('breakEndMinute', '00')
                  }}
                  className="text-blue-600 hover:underline"
                >
                  휴게시간 추가
                </button>
                )
              </>
            )}
          </p>
          <p className="text-base mb-1">
            - (법정휴게시간 준수 : 4시간 근무시마다 30분)
          </p>
          <p className="text-base">
            - (흡연, 식사, 차량출차 같은 업무에 해당하지 않는 시간은 휴게시간으로 본다)
          </p>
        </div>

        {/* 5. 근무일/휴일 */}
        <div className="mb-6">
          <p className="text-base mb-2">
            <span className="font-semibold">5. 근무일/휴일</span> : 매주 {' '}
            <span className="font-semibold text-blue-600">{formData.workDaysPerWeek}</span>
            {' '}일 근무(필요시, 근무요일), 주휴일 매주 {' '}
            <span className="font-semibold text-blue-600">{formData.weeklyHolidayDay}</span>
            {' '}요일
          </p>
          <div className="mb-2">
            <button
              type="button"
              onClick={() => {
                const currentShow = formData.workDaysDetail !== undefined
                if (currentShow) {
                  handleInputChange('workDaysDetail', undefined)
                } else {
                  handleInputChange('workDaysDetail', formData.selectedWorkDays.join(', '))
                }
              }}
              className="text-sm text-blue-600 hover:underline mb-2"
            >
              {formData.workDaysDetail !== undefined ? '근무요일 선택 닫기' : '근무요일 선택'}
            </button>
            {formData.workDaysDetail !== undefined && (
              <div className="mt-2 p-3 border border-gray-300 rounded-lg bg-gray-50">
                <p className="text-sm text-gray-600 mb-2">근무요일을 선택하세요:</p>
                <div className="flex flex-wrap gap-3">
                  {weekDays.map(day => (
                    <label key={day} className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.selectedWorkDays?.includes(day) || false}
                        onChange={() => handleWorkDayToggle(day)}
                        className="w-4 h-4"
                      />
                      <span className="text-base">{day}</span>
                    </label>
                  ))}
                </div>
                {formData.selectedWorkDays && formData.selectedWorkDays.length > 0 && (
                  <p className="text-sm text-gray-600 mt-2">
                    선택된 근무요일: {formData.selectedWorkDays.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
          <p className="text-base">
            - 사업장의 상황이나 근로자 요청에 따라 근무일 또는 휴무일이 변경될 수 있으며, 이 경우 상호 협의하여 조정함
          </p>
        </div>

        {/* 6. 임금 */}
        <div className="mb-6">
          <p className="text-base font-semibold mb-2">6. 임 금</p>
          <p className="text-base mb-2">
            - {' '}
            <label className="inline-flex items-center gap-1 mr-3">
              <input
                type="checkbox"
                checked={formData.salaryType === 'monthly'}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleInputChange('salaryType', 'monthly')
                  }
                }}
                className="w-4 h-4"
              />
              <span>월급</span>
            </label>
            <label className="inline-flex items-center gap-1 mr-3">
              <input
                type="checkbox"
                checked={formData.salaryType === 'daily'}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleInputChange('salaryType', 'daily')
                  }
                }}
                className="w-4 h-4"
              />
              <span>일급</span>
            </label>
            <label className="inline-flex items-center gap-1 mr-3">
              <input
                type="checkbox"
                checked={formData.salaryType === 'hourly'}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleInputChange('salaryType', 'hourly')
                  }
                }}
                className="w-4 h-4"
              />
              <span>시급</span>
            </label>
            {' '}: {' '}
            <input
              type="number"
              value={formData.salaryAmount}
              onChange={(e) => handleInputChange('salaryAmount', e.target.value)}
              className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm min-w-[200px]"
              placeholder="임금액"
            />
            {' '}원 (세전)
          </p>
          {formData.salaryType === 'hourly' && (
            <p className="text-base mb-2">
              - 시급인 경우 확인 : 주휴수당 포함 {' '}
              <input
                type="checkbox"
                checked={formData.includesWeeklyHoliday}
                onChange={(e) => handleInputChange('includesWeeklyHoliday', e.target.checked)}
                className="w-4 h-4"
              />
              {' '}
              <span className="text-xs text-gray-500">(주휴수당 기준은 매주 월~일입니다)</span>
            </p>
          )}
          <p className="text-base mb-2">
            - 임금지급일 : 매월 10일(휴일의 경우는 익일 지급)
          </p>
          <p className="text-base mb-2">
            - 지급방법 : 근로자에게 직접(현금)지급 {' '}
            <label className="inline-flex items-center gap-1 mr-3">
              <input
                type="checkbox"
                checked={formData.paymentMethod === 'cash'}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleInputChange('paymentMethod', 'cash')
                  }
                }}
                className="w-4 h-4"
              />
            </label>
            근로자 명의 계좌에 입금 {' '}
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={formData.paymentMethod === 'bank'}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleInputChange('paymentMethod', 'bank')
                  }
                }}
                className="w-4 h-4"
              />
            </label>
          </p>
          {formData.paymentMethod === 'bank' && (
            <p className="text-base mb-2">
              - 계좌번호 : {' '}
              <select
                value={formData.bankName || ''}
                onChange={(e) => handleInputChange('bankName', e.target.value)}
                className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm mr-2"
              >
                <option value="">은행 선택</option>
                {banks.map(bank => (
                  <option key={bank.id} value={bank.name}>{bank.name}</option>
                ))}
              </select>
              <input
                type="text"
                value={formData.bankAccount || ''}
                onChange={(e) => handleInputChange('bankAccount', e.target.value)}
                className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm min-w-[200px]"
                placeholder="계좌번호 입력"
              />
            </p>
          )}
        </div>

        {/* 7. 근로계약서 교부 */}
        <div className="mb-6">
          <p className="text-base font-semibold mb-2">7. 근로계약서 교부</p>
          <p className="text-base">
            - 사업주는 근로계약을 체결함과 동시에 본 계약서를 사본하여 근로자의 교부 요구와 관계없이 근로자에게 교부함(근로기준법 제17조 이행)
          </p>
        </div>

        {/* 8. 근로계약, 취업규칙 등의 성실한 이행의무 */}
        <div className="mb-6">
          <p className="text-base font-semibold mb-2">8. 근로계약, 취업규칙 등의 성실한 이행의무</p>
          <p className="text-base">
            - 사업주와 근로자는 각자가 근로계약, 취업규칙, 단체협약을 지키고 성실하게 이행하여야 함
          </p>
        </div>

        {/* 9. 그 밖의 사항 */}
        <div className="mb-6">
          <p className="text-base font-semibold mb-2">9. 그 밖의 사항</p>
          <p className="text-base">
            - 이 계약에 정함이 없는 사항은 근로관계법령에 따름
          </p>
        </div>

        {/* 계약일자 */}
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <select
              value={formData.contractDateYear}
              onChange={(e) => handleInputChange('contractDateYear', e.target.value)}
              className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span>년</span>
            <select
              value={formData.contractDateMonth}
              onChange={(e) => handleInputChange('contractDateMonth', e.target.value)}
              className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
            >
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span>월</span>
            <select
              value={formData.contractDateDay}
              onChange={(e) => handleInputChange('contractDateDay', e.target.value)}
              className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
            >
              {days.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <span>일</span>
          </div>
        </div>

        {/* 사업주 정보 */}
        <div className="mb-6">
          <p className="text-base font-semibold mb-2">(사업주)</p>
          <div className="space-y-1">
            <p className="text-base">
              사업체명 : {branch.companyName || branch.name}
            </p>
            <p className="text-base">
              주 소 : {branch.address || ''}
            </p>
            <p className="text-base">
              대 표 자 : {branch.ceoName || ''} {' '}
              {employerSignature ? (
                <img 
                  src={employerSignature} 
                  alt="사업주 서명" 
                  className="inline-block h-8 w-auto ml-2 border border-gray-300"
                />
              ) : (
                '(서명)'
              )}
            </p>
          </div>
        </div>

        {/* 근로자 정보 */}
        <div className="mb-6">
          <p className="text-base font-semibold mb-2">(근로자)</p>
          <div className="space-y-1">
            <p className="text-base">
              주 소 : {' '}
              <input
                type="text"
                value={formData.employeeAddress}
                onChange={(e) => handleInputChange('employeeAddress', e.target.value)}
                className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm min-w-[300px]"
                placeholder="근로자 주소"
                required
              />
            </p>
            <p className="text-base">
              연 락 처 : {' '}
              <input
                type="tel"
                value={formData.employeePhone}
                onChange={(e) => handleInputChange('employeePhone', e.target.value)}
                className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
                placeholder="010-0000-0000"
                required
              />
            </p>
            <p className="text-base">
              성 명 : {' '}
              <input
                type="text"
                value={formData.employeeName}
                onChange={(e) => handleInputChange('employeeName', e.target.value)}
                className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
                placeholder="근로자 성명"
                required
              />
              {' '}
              {employeeSignature ? (
                <img 
                  src={employeeSignature} 
                  alt="근로자 서명" 
                  className="inline-block h-8 w-auto ml-2 border border-gray-300"
                />
              ) : (
                '(서명)'
              )}
            </p>
            <p className="text-base">
              주민등록번호 : {' '}
              <input
                type="text"
                value={formData.residentNumber}
                onChange={(e) => handleInputChange('residentNumber', e.target.value)}
                className="bg-blue-50 border-2 border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:bg-blue-100 focus:shadow-sm"
                placeholder="000000-0000000"
                required
              />
            </p>
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className="flex justify-end gap-4 mt-8">
          <button
            type="button"
            onClick={() => {
              if (confirm('작성 중인 내용이 모두 삭제됩니다. 계속하시겠습니까?')) {
                window.location.reload()
              }
            }}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              if (validateForm()) {
                setStep('signature')
              }
            }}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            다음: 서명하기
          </button>
        </div>
      </div>
    </div>
  )
}

