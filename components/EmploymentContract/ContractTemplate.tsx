'use client'

import { useState } from 'react'
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
  
  // 근무장소
  workPlace: string
  
  // 업무 내용
  workContent: string
  
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
  weeklyHolidayDay: string // 주휴일 요일
  
  // 임금
  salaryType: 'monthly' | 'daily' | 'hourly'
  salaryAmount: string
  includesWeeklyHoliday: boolean // 주휴수당 포함 여부
  paymentDay: string // 임금지급일
  paymentMethod: 'cash' | 'bank' // 지급방법
  bankAccount?: string // 계좌번호
  
  // 계약일자
  contractDateYear: string
  contractDateMonth: string
  contractDateDay: string
  
  // 서명
  employeeSignature: string
  employerSignature: string
}

export default function ContractTemplate({ branch, onComplete }: ContractTemplateProps) {
  const [step, setStep] = useState<'form' | 'signature' | 'complete'>('form')
  const [currentSigner, setCurrentSigner] = useState<'employee' | 'employer'>('employee')
  const [employeeSignature, setEmployeeSignature] = useState<string>('')
  const [employerSignature, setEmployerSignature] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState<ContractData>({
    employeeName: '',
    residentNumber: '',
    employeeAddress: '',
    employeePhone: '',
    employeeEmail: '',
    startDateYear: new Date().getFullYear().toString(),
    startDateMonth: String(new Date().getMonth() + 1).padStart(2, '0'),
    startDateDay: String(new Date().getDate()).padStart(2, '0'),
    probationPeriod: '3',
    workPlace: branch.name,
    workContent: '고객응대 및 서빙, 음료, 음식제조 및 매장관리 등 사업장이 지정한 업무',
    workStartHour: '09',
    workStartMinute: '00',
    workEndHour: '18',
    workEndMinute: '00',
    workDaysPerWeek: '5',
    weeklyHolidayDay: '일',
    salaryType: 'hourly',
    salaryAmount: '',
    includesWeeklyHoliday: false,
    paymentDay: '5',
    paymentMethod: 'bank',
    contractDateYear: new Date().getFullYear().toString(),
    contractDateMonth: String(new Date().getMonth() + 1).padStart(2, '0'),
    contractDateDay: String(new Date().getDate()).padStart(2, '0'),
    employeeSignature: '',
    employerSignature: ''
  })

  const handleInputChange = (field: keyof ContractData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSignatureComplete = (signature: string) => {
    if (currentSigner === 'employee') {
      setEmployeeSignature(signature)
      handleInputChange('employeeSignature', signature)
      setCurrentSigner('employer')
    } else {
      setEmployerSignature(signature)
      handleInputChange('employerSignature', signature)
      handleSave()
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const finalData = {
        ...formData,
        employeeSignature,
        employerSignature
      }
      await onComplete(finalData)
      setStep('complete')
    } catch (error) {
      console.error('계약서 저장 중 오류:', error)
      alert('계약서 저장 중 오류가 발생했습니다.')
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
    if (!formData.employeeAddress.trim()) {
      alert('근로자 주소를 입력해주세요.')
      return false
    }
    if (!formData.employeePhone.trim()) {
      alert('근로자 연락처를 입력해주세요.')
      return false
    }
    if (!formData.salaryAmount) {
      alert('임금을 입력해주세요.')
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
        {currentSigner === 'employer' && employeeSignature && (
          <div className="mb-4 p-4 bg-green-50 rounded-lg">
            <p className="text-green-700">✓ 근로자 서명이 완료되었습니다.</p>
          </div>
        )}
        {loading && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-blue-700">계약서를 저장하는 중입니다...</p>
          </div>
        )}
        <SignaturePad
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
      <div className="bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          근로계약서 작성 완료
        </h2>
        <p className="text-gray-600 mb-6">
          근로계약서가 성공적으로 작성되었고 직원관리에 자동으로 등록되었습니다.
        </p>
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
              className="border-b-2 border-gray-300 px-2 py-1 inline-block focus:outline-none focus:border-blue-500 min-w-[120px] text-center"
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
              className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {' '}년 {' '}
            <select
              value={formData.startDateMonth}
              onChange={(e) => handleInputChange('startDateMonth', e.target.value)}
              className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
            >
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {' '}월 {' '}
            <select
              value={formData.startDateDay}
              onChange={(e) => handleInputChange('startDateDay', e.target.value)}
              className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
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
                className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {' '}년 {' '}
              <select
                value={formData.endDateMonth}
                onChange={(e) => handleInputChange('endDateMonth', e.target.value)}
                className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
              >
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {' '}월 {' '}
              <select
                value={formData.endDateDay}
                onChange={(e) => handleInputChange('endDateDay', e.target.value)}
                className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
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
              className="border-b-2 border-gray-300 px-2 py-1 w-16 text-center focus:outline-none focus:border-blue-500"
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
            <span className="font-semibold">2. 근 무 장 소</span> : {' '}
            <input
              type="text"
              value={formData.workPlace}
              onChange={(e) => handleInputChange('workPlace', e.target.value)}
              className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500 flex-1 min-w-[300px]"
              placeholder="청담장어마켓(송파점/동탄점), 카페드로잉(송파점/분당점/동탄점), 사업주가 관리하는 신규추가지점"
            />
          </p>
        </div>

        {/* 3. 업무의 내용 */}
        <div className="mb-6">
          <p className="text-base">
            <span className="font-semibold">3. 업무의 내용</span> : {' '}
            <textarea
              value={formData.workContent}
              onChange={(e) => handleInputChange('workContent', e.target.value)}
              className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500 w-full mt-1"
              rows={2}
              placeholder="고객응대 및 서빙, 음료, 음식제조 및 매장관리 등 사업장이 지정한 업무"
            />
          </p>
        </div>

        {/* 4. 소정근로시간 */}
        <div className="mb-6">
          <p className="text-base mb-2">
            <span className="font-semibold">4. 소정근로시간</span> : {' '}
            <select
              value={formData.workStartHour}
              onChange={(e) => handleInputChange('workStartHour', e.target.value)}
              className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
            >
              {hours.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            {' '}시 {' '}
            <select
              value={formData.workStartMinute}
              onChange={(e) => handleInputChange('workStartMinute', e.target.value)}
              className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
            >
              {minutes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {' '}분 ~ {' '}
            <select
              value={formData.workEndHour}
              onChange={(e) => handleInputChange('workEndHour', e.target.value)}
              className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
            >
              {hours.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            {' '}시 {' '}
            <select
              value={formData.workEndMinute}
              onChange={(e) => handleInputChange('workEndMinute', e.target.value)}
              className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
            >
              {minutes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {' '}분 (휴게시간 : {' '}
            {formData.breakStartHour ? (
              <>
                <select
                  value={formData.breakStartHour}
                  onChange={(e) => handleInputChange('breakStartHour', e.target.value)}
                  className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
                >
                  {hours.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                {' '}시 {' '}
                <select
                  value={formData.breakStartMinute}
                  onChange={(e) => handleInputChange('breakStartMinute', e.target.value)}
                  className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
                >
                  {minutes.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {' '}분 ~ {' '}
                <select
                  value={formData.breakEndHour}
                  onChange={(e) => handleInputChange('breakEndHour', e.target.value)}
                  className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
                >
                  {hours.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                {' '}시 {' '}
                <select
                  value={formData.breakEndMinute}
                  onChange={(e) => handleInputChange('breakEndMinute', e.target.value)}
                  className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
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
            <input
              type="number"
              value={formData.workDaysPerWeek}
              onChange={(e) => handleInputChange('workDaysPerWeek', e.target.value)}
              className="border-b-2 border-gray-300 px-2 py-1 w-16 text-center focus:outline-none focus:border-blue-500"
              min="1"
              max="7"
            />
            {' '}일 근무(필요시, 근무요일), 주휴일 매주 {' '}
            <select
              value={formData.weeklyHolidayDay}
              onChange={(e) => handleInputChange('weeklyHolidayDay', e.target.value)}
              className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
            >
              {weekDays.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {' '}요일
          </p>
          {formData.workDaysDetail && (
            <p className="text-base mb-2">
              근무요일 : {' '}
              <input
                type="text"
                value={formData.workDaysDetail}
                onChange={(e) => handleInputChange('workDaysDetail', e.target.value)}
                className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
                placeholder="예: 월, 화, 수, 목, 금"
              />
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              if (!formData.workDaysDetail) {
                handleInputChange('workDaysDetail', '')
              } else {
                handleInputChange('workDaysDetail', undefined)
              }
            }}
            className="text-sm text-blue-600 hover:underline mb-2"
          >
            {formData.workDaysDetail ? '근무요일 제거' : '근무요일 추가'}
          </button>
          <p className="text-base">
            - 사업장의 상황이나 근로자 요청에 따라 근무일 또는 휴무일이 변경될 수 있으며, 이 경우 상호 협의하여 조정함
          </p>
        </div>

        {/* 6. 임금 */}
        <div className="mb-6">
          <p className="text-base font-semibold mb-2">6. 임 금</p>
          <p className="text-base mb-2">
            - <select
              value={formData.salaryType}
              onChange={(e) => handleInputChange('salaryType', e.target.value as 'monthly' | 'daily' | 'hourly')}
              className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
            >
              <option value="monthly">월</option>
              <option value="daily">일</option>
              <option value="hourly">시간</option>
            </select>
            (일, 시간)급 : {' '}
            <input
              type="number"
              value={formData.salaryAmount}
              onChange={(e) => handleInputChange('salaryAmount', e.target.value)}
              className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500 min-w-[200px]"
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
              {' '}[ ]
            </p>
          )}
          <p className="text-base mb-2">
            - 임금지급일 : 매월(매주 또는 매일) {' '}
            <input
              type="number"
              value={formData.paymentDay}
              onChange={(e) => handleInputChange('paymentDay', e.target.value)}
              className="border-b-2 border-gray-300 px-2 py-1 w-16 text-center focus:outline-none focus:border-blue-500"
              min="1"
              max="31"
            />
            {' '}일(휴일의 경우는 익일 지급)
          </p>
          <p className="text-base mb-2">
            - 지급방법 : 근로자에게 직접(현금)지급 {' '}
            <input
              type="radio"
              name="paymentMethod"
              value="cash"
              checked={formData.paymentMethod === 'cash'}
              onChange={(e) => handleInputChange('paymentMethod', e.target.value as 'cash' | 'bank')}
              className="w-4 h-4"
            />
            {' '}[ ], 근로자 명의 계좌에 입금 {' '}
            <input
              type="radio"
              name="paymentMethod"
              value="bank"
              checked={formData.paymentMethod === 'bank'}
              onChange={(e) => handleInputChange('paymentMethod', e.target.value as 'cash' | 'bank')}
              className="w-4 h-4"
            />
            {' '}[ ]
          </p>
          {formData.paymentMethod === 'bank' && (
            <p className="text-base mb-2">
              - 계좌번호 : {' '}
              <input
                type="text"
                value={formData.bankAccount || ''}
                onChange={(e) => handleInputChange('bankAccount', e.target.value)}
                className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500 min-w-[200px]"
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
              className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span>년</span>
            <select
              value={formData.contractDateMonth}
              onChange={(e) => handleInputChange('contractDateMonth', e.target.value)}
              className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
            >
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span>월</span>
            <select
              value={formData.contractDateDay}
              onChange={(e) => handleInputChange('contractDateDay', e.target.value)}
              className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
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
              대 표 자 : {branch.ceoName || ''} (서명)
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
                className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500 min-w-[300px]"
                placeholder="근로자 주소"
              />
            </p>
            <p className="text-base">
              연 락 처 : {' '}
              <input
                type="tel"
                value={formData.employeePhone}
                onChange={(e) => handleInputChange('employeePhone', e.target.value)}
                className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
                placeholder="010-0000-0000"
              />
            </p>
            <p className="text-base">
              성 명 : {' '}
              <input
                type="text"
                value={formData.employeeName}
                onChange={(e) => handleInputChange('employeeName', e.target.value)}
                className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
                placeholder="근로자 성명"
              />
              {' '}(서명)
            </p>
            <p className="text-base">
              주민등록번호 : {' '}
              <input
                type="text"
                value={formData.residentNumber}
                onChange={(e) => handleInputChange('residentNumber', e.target.value)}
                className="border-b-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
                placeholder="000000-0000000"
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

