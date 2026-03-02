'use client'

import { useState, useRef } from 'react'
import { collection, addDoc, getDocs, query, where, Timestamp, writeBatch, doc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import SignaturePad from './SignaturePad'
import { generateContractDocx, generateContractPdf } from '@/lib/contract-docx'
import { saveEmploymentContract } from '@/lib/employment-contract-firestore'

interface Branch {
  id: string
  name: string
  companyName?: string
  ceoName?: string
  businessNumber?: string
  address?: string
  phone?: string
}

interface ContractFormProps {
  branchId: string
  branch: Branch
}

export default function ContractForm({ branchId, branch }: ContractFormProps) {
  const [step, setStep] = useState<'form' | 'signature' | 'complete'>('form')
  const [loading, setLoading] = useState(false)
  const [employeeSignature, setEmployeeSignature] = useState<string>('')
  const [employerSignature, setEmployerSignature] = useState<string>('')
  const [currentSigner, setCurrentSigner] = useState<'employee' | 'employer'>('employee')

  const [formData, setFormData] = useState({
    // 직원 정보
    employeeName: '',
    residentNumber: '',
    address: '',
    phone: '',
    email: '',
    
    // 계약 정보
    startDate: '',
    endDate: '',
    workType: '정규직', // 정규직, 계약직, 일용직 등
    workPlace: branch.name,
    workContent: '',
    
    // 급여 정보
    salaryType: 'monthly' as 'hourly' | 'monthly' | 'daily',
    salaryAmount: '',
    weeklyWorkHours: '40',
    dailyWorkHours: '8',
    
    // 근무 시간
    workDays: '월~금',
    workStartTime: '09:00',
    workEndTime: '18:00',
    breakTime: '1',
    
    // 기타
    probationPeriod: '3', // 수습기간 (개월)
    notes: ''
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const validateForm = (): boolean => {
    if (!formData.employeeName.trim()) {
      alert('직원 이름을 입력해주세요.')
      return false
    }
    if (!formData.residentNumber.trim()) {
      alert('주민등록번호를 입력해주세요.')
      return false
    }
    if (!formData.address.trim()) {
      alert('주소를 입력해주세요.')
      return false
    }
    if (!formData.phone.trim()) {
      alert('전화번호를 입력해주세요.')
      return false
    }
    if (!formData.startDate) {
      alert('근로 시작일을 선택해주세요.')
      return false
    }
    if (!formData.salaryAmount) {
      alert('급여를 입력해주세요.')
      return false
    }
    return true
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      setStep('signature')
    }
  }

  const handleSignatureComplete = (signature: string) => {
    if (currentSigner === 'employee') {
      setEmployeeSignature(signature)
      setCurrentSigner('employer')
    } else {
      setEmployerSignature(signature)
      // 두 서명이 모두 완료되면 저장
      handleSaveContract()
    }
  }

  const handleSaveContract = async () => {
    if (!employeeSignature || !employerSignature) {
      alert('모든 서명이 완료되지 않았습니다.')
      return
    }

    setLoading(true)
    try {
      // 1. 계약서 데이터 준비
      const contractData = {
        branchId,
        branchName: branch.name,
        employeeInfo: {
          name: formData.employeeName,
          residentNumber: formData.residentNumber,
          address: formData.address,
          phone: formData.phone,
          email: formData.email || ''
        },
        contractInfo: {
          startDate: new Date(formData.startDate),
          endDate: formData.endDate ? new Date(formData.endDate) : undefined,
          workType: formData.workType,
          workPlace: formData.workPlace,
          workContent: formData.workContent,
          salaryType: formData.salaryType,
          salaryAmount: parseFloat(formData.salaryAmount),
          weeklyWorkHours: parseFloat(formData.weeklyWorkHours),
          dailyWorkHours: parseFloat(formData.dailyWorkHours),
          workDays: formData.workDays,
          workStartTime: formData.workStartTime,
          workEndTime: formData.workEndTime,
          breakTime: parseFloat(formData.breakTime),
          probationPeriod: parseFloat(formData.probationPeriod),
          notes: formData.notes
        },
        signatures: {
          employee: {
            signatureImage: employeeSignature,
            signedAt: Timestamp.now(),
            signedBy: formData.employeeName
          },
          employer: {
            signatureImage: employerSignature,
            signedAt: Timestamp.now(),
            signedBy: branch.ceoName || '대표자'
          }
        },
        status: 'signed' as const,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        signedAt: Timestamp.now()
      }

      // 2. DOCX 생성 (템플릿 파일 및 필드 매핑 사용)
      const savedTemplate = localStorage.getItem('employmentContractTemplate')
      const savedMapping = localStorage.getItem('employmentContractFieldMapping')
      const savedFileBase64 = localStorage.getItem('employmentContractTemplateFile')
      
      let templateFile: File | undefined = undefined
      let fieldMapping: Record<string, string> | undefined = undefined
      
      // 로컬 스토리지에서 템플릿 파일 및 매핑 정보 불러오기
      if (savedFileBase64 && savedTemplate) {
        try {
          const templateData = JSON.parse(savedTemplate)
          // Base64를 Blob으로 변환
          const byteCharacters = atob(savedFileBase64)
          const byteNumbers = new Array(byteCharacters.length)
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
          }
          const byteArray = new Uint8Array(byteNumbers)
          const blob = new Blob([byteArray], { 
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
          })
          templateFile = new File([blob], templateData.fileName || 'template.docx', {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          })
        } catch (e) {
          console.error('템플릿 파일 불러오기 실패:', e)
        }
      }
      
      if (savedMapping) {
        try {
          fieldMapping = JSON.parse(savedMapping)
        } catch (e) {
          console.error('필드 매핑 정보 불러오기 실패:', e)
        }
      }
      
      const docxBlob = await generateContractDocx(contractData, branch, templateFile, fieldMapping)
      
      // 3. PDF 생성
      const pdfBlob = await generateContractPdf(contractData, branch)

      // 4. Firebase Storage에 업로드
      const timestamp = Date.now()
      const docxFileName = `contracts/${branchId}_${timestamp}.docx`
      const pdfFileName = `contracts/${branchId}_${timestamp}.pdf`
      
      const docxRef = ref(storage, docxFileName)
      const pdfRef = ref(storage, pdfFileName)
      
      await uploadBytes(docxRef, docxBlob)
      await uploadBytes(pdfRef, pdfBlob)
      
      const docxUrl = await getDownloadURL(docxRef)
      const pdfUrl = await getDownloadURL(pdfRef)

      // 5. Firestore에 저장
      const contractId = await saveEmploymentContract({
        branchId: contractData.branchId,
        branchName: contractData.branchName,
        employeeInfo: contractData.employeeInfo,
        contractInfo: contractData.contractInfo,
        signatures: contractData.signatures,
        contractFile: pdfUrl,
        contractDocxFile: docxUrl,
        contractFileName: `근로계약서_${formData.employeeName}_${timestamp}.pdf`,
        status: contractData.status,
        signedAt: contractData.signedAt.toDate()
      })

      // 6. 직원관리에 자동 업로드
      await syncToEmployeeManagement({
        ...contractData,
        contractFile: pdfUrl
      }, contractId)

      setStep('complete')
      alert('근로계약서가 성공적으로 작성되었습니다!\n직원관리에 자동으로 등록되었습니다.')
    } catch (error) {
      console.error('계약서 저장 중 오류:', error)
      alert('계약서 저장 중 오류가 발생했습니다. 콘솔을 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const syncToEmployeeManagement = async (contractData: any, contractId: string) => {
    try {
      // 기존 직원이 있는지 확인
      const employeesQuery = query(
        collection(db, 'employees'),
        where('name', '==', contractData.employeeInfo.name),
        where('residentNumber', '==', contractData.employeeInfo.residentNumber)
      )
      const employeesSnapshot = await getDocs(employeesQuery)

      const batch = writeBatch(db)

      if (employeesSnapshot.empty) {
        // 새 직원 추가
        const employeeRef = doc(collection(db, 'employees'))
        const employeeData = {
          name: contractData.employeeInfo.name,
          phone: contractData.employeeInfo.phone,
          email: contractData.employeeInfo.email || '',
          residentNumber: contractData.employeeInfo.residentNumber,
          address: contractData.employeeInfo.address,
          hireDate: contractData.contractInfo.startDate,
          status: 'active' as const,
          contractFile: contractData.contractFile,
          primaryBranchId: branchId,
          primaryBranchName: branch.name,
          probationStartDate: contractData.contractInfo.startDate,
          probationEndDate: contractData.contractInfo.probationPeriod 
            ? new Date(new Date(contractData.contractInfo.startDate).setMonth(
                new Date(contractData.contractInfo.startDate).getMonth() + contractData.contractInfo.probationPeriod
              ))
            : undefined,
          probationPeriod: contractData.contractInfo.probationPeriod || 3,
          isOnProbation: true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        }
        batch.set(employeeRef, employeeData)

        // 직원-지점 관계 생성
        const employeeBranchRef = doc(collection(db, 'employeeBranches'))
        batch.set(employeeBranchRef, {
          employeeId: employeeRef.id,
          branchId: branchId,
          branchName: branch.name,
          role: 'main' as const,
          startDate: contractData.contractInfo.startDate,
          isActive: true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        })

        // 근로계약서 정보도 employees 컬렉션에 연결
        const employmentContractRef = doc(db, 'employmentContracts', contractId)
        batch.update(employmentContractRef, {
          employeeId: employeeRef.id
        })

        await batch.commit()
        console.log('새 직원이 직원관리에 추가되었습니다:', employeeRef.id)
      } else {
        // 기존 직원 업데이트
        const existingEmployee = employeesSnapshot.docs[0]
        const employeeRef = doc(db, 'employees', existingEmployee.id)
        
        batch.update(employeeRef, {
          contractFile: contractData.contractFile,
          updatedAt: Timestamp.now()
        })

        // 근로계약서 정보 연결
        const employmentContractRef = doc(db, 'employmentContracts', contractId)
        batch.update(employmentContractRef, {
          employeeId: existingEmployee.id
        })

        await batch.commit()
        console.log('기존 직원 정보가 업데이트되었습니다:', existingEmployee.id)
      }
    } catch (error) {
      console.error('직원관리 동기화 중 오류:', error)
      // 오류가 발생해도 계약서는 저장되었으므로 계속 진행
    }
  }

  if (step === 'signature') {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          서명 ({currentSigner === 'employee' ? '근로자' : '사용자자'})
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
        <button
          onClick={() => {
            setStep('form')
            setFormData({
              employeeName: '',
              residentNumber: '',
              address: '',
              phone: '',
              email: '',
              startDate: '',
              endDate: '',
              workType: '정규직',
              workPlace: branch.name,
              workContent: '',
              salaryType: 'monthly',
              salaryAmount: '',
              weeklyWorkHours: '40',
              dailyWorkHours: '8',
              workDays: '월~금',
              workStartTime: '09:00',
              workEndTime: '18:00',
              breakTime: '1',
              probationPeriod: '3',
              notes: ''
            })
            setEmployeeSignature('')
            setEmployerSignature('')
            setCurrentSigner('employee')
          }}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          새 계약서 작성
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleFormSubmit} className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">근로계약서 정보 입력</h2>

      {/* 직원 정보 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">직원 정보</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 *
            </label>
            <input
              type="text"
              name="employeeName"
              value={formData.employeeName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              주민등록번호 *
            </label>
            <input
              type="text"
              name="residentNumber"
              value={formData.residentNumber}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="000000-0000000"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              주소 *
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전화번호 *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="010-0000-0000"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 계약 정보 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">계약 정보</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              근로 시작일 *
            </label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              근로 종료일 (계약직인 경우)
            </label>
            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              고용형태 *
            </label>
            <select
              name="workType"
              value={formData.workType}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="정규직">정규직</option>
              <option value="계약직">계약직</option>
              <option value="일용직">일용직</option>
              <option value="파트타임">파트타임</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              근무지
            </label>
            <input
              type="text"
              name="workPlace"
              value={formData.workPlace}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              업무 내용
            </label>
            <textarea
              name="workContent"
              value={formData.workContent}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="담당 업무를 입력하세요"
            />
          </div>
        </div>
      </div>

      {/* 급여 정보 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">급여 정보</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              급여 형태 *
            </label>
            <select
              name="salaryType"
              value={formData.salaryType}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="monthly">월급</option>
              <option value="hourly">시급</option>
              <option value="daily">일급</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              급여 금액 *
            </label>
            <input
              type="number"
              name="salaryAmount"
              value={formData.salaryAmount}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={formData.salaryType === 'monthly' ? '월급액' : formData.salaryType === 'hourly' ? '시급' : '일급'}
              required
            />
          </div>
          {formData.salaryType === 'hourly' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  주간 근무시간
                </label>
                <input
                  type="number"
                  name="weeklyWorkHours"
                  value={formData.weeklyWorkHours}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 근무 시간 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">근무 시간</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              근무일
            </label>
            <input
              type="text"
              name="workDays"
              value={formData.workDays}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="월~금"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              근무 시작 시간
            </label>
            <input
              type="time"
              name="workStartTime"
              value={formData.workStartTime}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              근무 종료 시간
            </label>
            <input
              type="time"
              name="workEndTime"
              value={formData.workEndTime}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              휴게 시간 (시간)
            </label>
            <input
              type="number"
              name="breakTime"
              value={formData.breakTime}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              step="0.5"
            />
          </div>
        </div>
      </div>

      {/* 기타 정보 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">기타 정보</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              수습기간 (개월)
            </label>
            <input
              type="number"
              name="probationPeriod"
              value={formData.probationPeriod}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비고
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="추가 사항을 입력하세요"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4">
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
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          다음: 서명하기
        </button>
      </div>
    </form>
  )
}

