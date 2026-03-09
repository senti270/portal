'use client'

import { useState } from 'react'
import { collection, addDoc, getDocs, query, where, Timestamp, writeBatch, doc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { generateContractPdf } from '@/lib/contract-docx'
import { saveEmploymentContract, EmploymentContract } from '@/lib/employment-contract-firestore'
import ContractTemplate, { ContractData } from './ContractTemplate'
import jsPDF from 'jspdf'

interface Branch {
  id: string
  name: string
  companyName?: string
  ceoName?: string
  businessNumber?: string
  address?: string
  phone?: string
}

interface ContractTemplateHandlerProps {
  branchId: string
  branch: Branch
}

export default function ContractTemplateHandler({ branchId, branch }: ContractTemplateHandlerProps) {
  const [loading, setLoading] = useState(false)

  const handleContractComplete = async (contractData: ContractData) => {
    console.log('🚀 계약서 저장 프로세스 시작')
    setLoading(true)
    try {
      // 0. 데이터 검증
      if (!contractData.employeeName?.trim()) {
        throw new Error('근로자 성명을 입력해주세요.')
      }
      if (!contractData.residentNumber?.trim()) {
        throw new Error('주민등록번호를 입력해주세요.')
      }
      if (!contractData.employeeAddress?.trim()) {
        throw new Error('근로자 주소를 입력해주세요.')
      }
      if (!contractData.employeePhone?.trim()) {
        throw new Error('근로자 연락처를 입력해주세요.')
      }
      if (!contractData.salaryAmount || parseFloat(contractData.salaryAmount) <= 0) {
        throw new Error('임금을 올바르게 입력해주세요.')
      }
      if (!contractData.employeeSignature) {
        throw new Error('근로자 서명이 필요합니다.')
      }
      if (!contractData.employerSignature) {
        throw new Error('사업주 서명이 필요합니다.')
      }
      if (contractData.paymentMethod === 'bank' && (!contractData.bankName || !contractData.bankAccount)) {
        throw new Error('계좌입금을 선택한 경우 은행명과 계좌번호를 입력해주세요.')
      }

      // 1. 날짜 변환 및 검증
      const startDate = new Date(
        parseInt(contractData.startDateYear),
        parseInt(contractData.startDateMonth) - 1,
        parseInt(contractData.startDateDay)
      )
      if (isNaN(startDate.getTime())) {
        throw new Error('근로개시일이 올바르지 않습니다.')
      }
      
      const endDate = contractData.endDateYear
        ? new Date(
            parseInt(contractData.endDateYear),
            parseInt(contractData.endDateMonth || '1') - 1,
            parseInt(contractData.endDateDay || '1')
          )
        : undefined
      if (endDate && isNaN(endDate.getTime())) {
        throw new Error('종료일이 올바르지 않습니다.')
      }
      if (endDate && endDate <= startDate) {
        throw new Error('종료일은 근로개시일보다 늦어야 합니다.')
      }
      
      const contractDate = new Date(
        parseInt(contractData.contractDateYear),
        parseInt(contractData.contractDateMonth) - 1,
        parseInt(contractData.contractDateDay)
      )
      if (isNaN(contractDate.getTime())) {
        throw new Error('계약일자가 올바르지 않습니다.')
      }

      // 2. 근무시간 문자열 생성
      const workStartTime = `${contractData.workStartHour}:${contractData.workStartMinute}`
      const workEndTime = `${contractData.workEndHour}:${contractData.workEndMinute}`
      const breakTime = contractData.breakStartHour
        ? `${contractData.breakStartHour}:${contractData.breakStartMinute} ~ ${contractData.breakEndHour}:${contractData.breakEndMinute}`
        : ''

      // 3. 계약서 데이터 준비
      const contractDataForSave: Omit<EmploymentContract, 'id' | 'createdAt' | 'updatedAt'> = {
        branchId,
        branchName: branch.name,
        employeeInfo: {
          name: contractData.employeeName,
          residentNumber: contractData.residentNumber,
          address: contractData.employeeAddress,
          phone: contractData.employeePhone,
          email: contractData.employeeEmail || ''
        },
        contractInfo: {
          startDate,
          endDate,
          workType: '정규직', // 기본값
          workPlace: '청담장어마켓(송파점/동탄점/분당점), 카페드로잉(송파점/홍대점/동탄점), 사업주가 관리하는 신규추가지점',
          workContent: '고객응대 및 서빙, 음료, 음식제조 및 매장관리 등 사업장이 지정한 업무',
          employmentType: contractData.employmentType || '사업소득', // 고용형태
          salaryType: contractData.salaryType,
          salaryAmount: parseFloat(contractData.salaryAmount) || 0, // 시급/일급/월급 금액
          includesWeeklyHoliday: contractData.includesWeeklyHoliday, // 주휴수당 포함 여부
          weeklyWorkHours: parseFloat(contractData.workDaysPerWeek) * 8, // 근사치
          dailyWorkHours: 8, // 근사치
          workDays: contractData.workDaysDetail || `매주 ${contractData.workDaysPerWeek}일`,
          workStartTime,
          workEndTime,
          breakTime: contractData.breakStartHour ? 1 : 0, // 근사치
          probationPeriod: parseFloat(contractData.probationPeriod),
          notes: ''
        },
        signatures: {
          employee: {
            signatureImage: contractData.employeeSignature,
            signedAt: Timestamp.now(),
            signedBy: contractData.employeeName
          },
          employer: {
            signatureImage: contractData.employerSignature,
            signedAt: Timestamp.now(),
            signedBy: branch.ceoName || '대표자'
          }
        },
        status: 'signed',
        signedAt: contractDate
      }

      // 4. PDF 생성
      console.log('📄 PDF 생성 시작...')
      let pdfBlob: Blob
      try {
        pdfBlob = await generateContractPdfFromTemplate(contractData, branch)
        console.log('✅ PDF 생성 완료, 크기:', pdfBlob.size, 'bytes')
      } catch (error) {
        console.error('❌ PDF 생성 오류:', error)
        throw new Error('PDF 생성 중 오류가 발생했습니다. 다시 시도해주세요.')
      }

      // 5. Firebase Storage에 업로드
      console.log('☁️ Storage 업로드 시작...')
      const timestamp = Date.now()
      const pdfFileName = `contracts/${branchId}_${timestamp}.pdf`
      let pdfUrl: string
      try {
        const pdfRef = ref(storage, pdfFileName)
        console.log('📤 파일 업로드 중...', pdfFileName, '크기:', (pdfBlob.size / 1024 / 1024).toFixed(2), 'MB')
        
        // PDF Blob을 Storage에 업로드
        await uploadBytes(pdfRef, pdfBlob, {
          contentType: 'application/pdf'
        })
        console.log('✅ 파일 업로드 완료')
        
        // 다운로드 URL 생성
        pdfUrl = await getDownloadURL(pdfRef)
        console.log('✅ 다운로드 URL 생성 완료:', pdfUrl)
      } catch (error) {
        console.error('❌ Storage 업로드 오류:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorCode = (error as any)?.code || (error as any)?.serverResponse?.status
        
        // 403 Forbidden 오류인 경우 (보안 규칙 문제)
        if (errorCode === 403 || errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
          throw new Error('파일 업로드 권한이 없습니다. Firebase Storage 보안 규칙을 확인해주세요.\n\nFirebase Console → Storage → Rules에서 업로드 권한을 설정해야 합니다.')
        }
        
        // CORS 오류인 경우 명확한 메시지
        if (errorMessage.includes('CORS') || errorMessage.includes('cors')) {
          throw new Error('파일 업로드 중 CORS 오류가 발생했습니다. Firebase Storage 설정을 확인해주세요.')
        }
        
        throw new Error(`파일 업로드 중 오류가 발생했습니다: ${errorMessage}`)
      }

      // 6. Firestore에 저장
      console.log('💾 Firestore 저장 시작...')
      console.log('📊 저장할 계약서 데이터:', {
        salaryType: contractDataForSave.contractInfo.salaryType,
        salaryAmount: contractDataForSave.contractInfo.salaryAmount,
        employmentType: contractDataForSave.contractInfo.employmentType
      })
      let contractId: string
      try {
        contractId = await saveEmploymentContract({
          ...contractDataForSave,
          contractFile: pdfUrl,
          contractFileName: `근로계약서_${contractData.employeeName}_${timestamp}.pdf`
        })
        console.log('✅ Firestore 저장 완료, contractId:', contractId)
      } catch (error) {
        console.error('❌ Firestore 저장 오류:', error)
        throw new Error('계약서 저장 중 오류가 발생했습니다. 다시 시도해주세요.')
      }

      // 7. 직원관리에 자동 업로드
      console.log('👤 직원관리 동기화 시작...')
      try {
        await syncToEmployeeManagement(contractDataForSave, contractId, pdfUrl, contractData)
        console.log('✅ 직원관리 동기화 완료')
      } catch (error) {
        console.error('❌ 직원관리 동기화 오류:', error)
        console.error('오류 상세:', {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          contractData: {
            employeeName: contractData.employeeName,
            residentNumber: contractData.residentNumber
          }
        })
        // 직원관리 동기화 실패해도 계약서는 저장되었으므로 경고만 표시
        alert('⚠️ 계약서는 저장되었지만 직원관리 동기화에 실패했습니다.\n직원관리 화면에서 수동으로 확인해주세요.\n\n브라우저 콘솔(F12)에서 오류 내용을 확인할 수 있습니다.')
      }

      // 8. 카카오톡 전송
      console.log('📱 카카오톡 전송 시작...')
      try {
        const kakaoResponse = await fetch('/api/employment-contract/send-kakao', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phoneNumber: contractData.employeePhone,
            contractUrl: pdfUrl,
            employeeName: contractData.employeeName
          })
        })
        
        if (!kakaoResponse.ok) {
          const errorText = await kakaoResponse.text()
          console.error('❌ 카카오톡 전송 API 오류:', {
            status: kakaoResponse.status,
            statusText: kakaoResponse.statusText,
            body: errorText
          })
          // 카카오톡 전송 실패해도 계약서 저장은 완료되었으므로 계속 진행
        } else {
          const kakaoResult = await kakaoResponse.json()
          if (kakaoResult.success) {
            console.log('✅ 카카오톡 전송 성공:', kakaoResult.message)
          } else {
            console.warn('⚠️ 카카오톡 전송 실패:', kakaoResult.error)
          }
        }
      } catch (error) {
        console.error('❌ 카카오톡 전송 중 오류:', error)
        console.error('오류 상세:', {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined
        })
        // 카카오톡 전송 실패해도 계약서 저장은 완료되었으므로 계속 진행
      }

      console.log('🎉 모든 작업 완료!')
      alert('근로계약서가 성공적으로 작성되었습니다!\n직원관리에 자동으로 등록되었습니다.')
    } catch (error) {
      console.error('❌ 계약서 저장 중 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '계약서 저장 중 오류가 발생했습니다.'
      alert(`❌ ${errorMessage}\n\n브라우저 콘솔(F12)에서 상세 오류 내용을 확인할 수 있습니다.`)
      // 에러를 다시 throw하여 ContractTemplate에서도 에러를 감지할 수 있도록 함
      throw error
    } finally {
      setLoading(false)
    }
  }

  const generateContractPdfFromTemplate = async (contractData: ContractData, branch: Branch): Promise<Blob> => {
    try {
      // html2canvas를 사용하여 HTML을 이미지로 변환 후 PDF 생성 (한글 폰트 문제 해결)
      const html2canvas = (await import('html2canvas')).default
      
      // 계약서 HTML 생성
      const contractHtml = generateContractHtml(contractData, branch)
      
      // 임시 div 생성
      const element = document.createElement('div')
      element.innerHTML = contractHtml
      element.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 210mm;
        background: white;
        font-family: 'Malgun Gothic', '맑은 고딕', 'Noto Sans KR', Arial, sans-serif;
        color: black;
        z-index: 9999;
        padding: 20mm;
        font-size: 12pt;
        line-height: 1.6;
      `
      document.body.appendChild(element)
      
      // HTML을 캔버스로 변환
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794, // 210mm in pixels at 96dpi
        height: element.scrollHeight
      })
      
      // 임시 div 제거
      document.body.removeChild(element)
      
      // 캔버스를 PDF로 변환
      const imgData = canvas.toDataURL('image/png')
      const doc = new jsPDF('p', 'mm', 'a4')
      
      const imgWidth = 210 // A4 width in mm
      const pageHeight = 297 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      
      let position = 0
      
      // 첫 페이지 추가
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      
      // 여러 페이지가 필요한 경우 추가 페이지 생성
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        doc.addPage()
        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      
      const pdfBlob = doc.output('blob')
      return pdfBlob
    } catch (error) {
      console.error('PDF 생성 오류:', error)
      throw new Error('PDF 생성 중 오류가 발생했습니다.')
    }
  }

  const generateContractHtml = (contractData: ContractData, branch: Branch): string => {
    const startDateStr = `${contractData.startDateYear}년 ${contractData.startDateMonth}월 ${contractData.startDateDay}일`
    const endDateStr = contractData.endDateYear 
      ? `${contractData.endDateYear}년 ${contractData.endDateMonth}월 ${contractData.endDateDay}일`
      : ''
    const contractDateStr = `${contractData.contractDateYear}년 ${contractData.contractDateMonth}월 ${contractData.contractDateDay}일`
    const workStartTime = `${contractData.workStartHour}:${contractData.workStartMinute}`
    const workEndTime = `${contractData.workEndHour}:${contractData.workEndMinute}`
    const salaryTypeText = contractData.salaryType === 'monthly' ? '월' : contractData.salaryType === 'daily' ? '일' : '시간'
    const workPlaceText = '청담장어마켓(송파점/동탄점/분당점), 카페드로잉(송파점/홍대점/동탄점), 사업주가 관리하는 신규추가지점'
    const workContentText = '고객응대 및 서빙, 음료, 음식제조 및 매장관리 등 사업장이 지정한 업무'
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Malgun Gothic', '맑은 고딕', 'Noto Sans KR', Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.6;
            padding: 0;
            margin: 0;
          }
          .title {
            text-align: center;
            font-size: 18pt;
            font-weight: bold;
            margin-bottom: 20px;
          }
          .section {
            margin-bottom: 15px;
          }
          .section-title {
            font-weight: bold;
            margin-bottom: 5px;
          }
          .signature-area {
            display: inline-block;
            width: 80px;
            height: 30px;
            border: 1px solid #ccc;
            margin-left: 10px;
            vertical-align: middle;
          }
        </style>
      </head>
      <body>
        <div class="title">표준근로계약서</div>
        
        <div class="section">
          <p>${branch.ceoName || '대표자'}(이하 "사업주"라 함)과(와) ${contractData.employeeName}(이하 "근로자"라 함)은 다음과 같이 근로계약을 체결한다.</p>
        </div>
        
        <div class="section">
          <div class="section-title">1. 근로개시일</div>
          <p>${startDateStr}</p>
          ${endDateStr ? `<p>종료일: ${endDateStr}</p>` : ''}
          <p>수습기간: ${contractData.probationPeriod}개월</p>
        </div>
        
        <div class="section">
          <div class="section-title">2. 근무장소</div>
          <p>${workPlaceText}</p>
        </div>
        
        <div class="section">
          <div class="section-title">3. 업무의 내용</div>
          <p>${workContentText}</p>
        </div>
        
        <div class="section">
          <div class="section-title">4. 소정근로시간</div>
          <p>${workStartTime} ~ ${workEndTime}</p>
        </div>
        
        <div class="section">
          <div class="section-title">5. 근무일/휴일</div>
          <p>매주 ${contractData.workDaysPerWeek}일 근무, 주휴일: ${contractData.weeklyHolidayDay}요일</p>
        </div>
        
        <div class="section">
          <div class="section-title">6. 임금</div>
          <p>${salaryTypeText}급: ${parseFloat(contractData.salaryAmount).toLocaleString()}원</p>
          ${contractData.salaryType === 'hourly' ? `<p>주휴수당 포함: ${contractData.includesWeeklyHoliday ? '예' : '아니오'}</p>` : ''}
          <p>임금지급일: 매월 ${contractData.paymentDay}일</p>
          <p>지급방법: ${contractData.paymentMethod === 'cash' ? '현금' : '계좌입금'}</p>
          ${contractData.paymentMethod === 'bank' && contractData.bankAccount ? `<p>계좌번호: ${contractData.bankAccount}</p>` : ''}
        </div>
        
        <div style="text-align: center; margin: 20px 0;">
          <p>${contractDateStr}</p>
        </div>
        
        <div class="section">
          <div class="section-title">사업주</div>
          <p>사업체명: ${branch.companyName || branch.name}</p>
          <p>주소: ${branch.address || ''}</p>
          <p>대표자: ${branch.ceoName || ''} ${contractData.employerSignature ? '<img src="' + contractData.employerSignature + '" style="width: 80px; height: 30px; margin-left: 10px; vertical-align: middle;" />' : '<span class="signature-area"></span>'}</p>
        </div>
        
        <div class="section">
          <div class="section-title">근로자</div>
          <p>주소: ${contractData.employeeAddress}</p>
          <p>연락처: ${contractData.employeePhone}</p>
          <p>성명: ${contractData.employeeName} ${contractData.employeeSignature ? '<img src="' + contractData.employeeSignature + '" style="width: 80px; height: 30px; margin-left: 10px; vertical-align: middle;" />' : '<span class="signature-area"></span>'}</p>
          <p>주민등록번호: ${contractData.residentNumber}</p>
        </div>
      </body>
      </html>
    `
  }

  const syncToEmployeeManagement = async (
    contractData: Omit<EmploymentContract, 'id' | 'createdAt' | 'updatedAt'>,
    contractId: string,
    contractFileUrl: string,
    originalContractData: ContractData
  ) => {
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
        
        // 은행 코드 찾기
        let selectedBankCode = ''
        if (originalContractData.bankName) {
          try {
            const bankCodesSnapshot = await getDocs(
              query(collection(db, 'bankCodes'), where('name', '==', originalContractData.bankName))
            )
            if (!bankCodesSnapshot.empty) {
              selectedBankCode = bankCodesSnapshot.docs[0].data()?.code || ''
            }
          } catch (error) {
            console.warn('은행 코드 조회 실패:', error)
          }
        }

        const employeeData = {
          name: contractData.employeeInfo.name,
          phone: contractData.employeeInfo.phone,
          email: contractData.employeeInfo.email || '',
          residentNumber: contractData.employeeInfo.residentNumber,
          address: contractData.employeeInfo.address,
          hireDate: Timestamp.fromDate(contractData.contractInfo.startDate),
          status: 'active' as const,
          contractFile: contractFileUrl,
          primaryBranchId: branchId,
          primaryBranchName: branch.name,
          // 계약 정보 동기화
          employmentType: contractData.contractInfo.employmentType || '사업소득',
          salaryType: contractData.contractInfo.salaryType,
          salaryAmount: contractData.contractInfo.salaryAmount,
          includesWeeklyHolidayInWage: contractData.contractInfo.includesWeeklyHoliday || false,
          weeklyWorkHours: contractData.contractInfo.weeklyWorkHours,
          // 은행 정보 (계좌입금인 경우)
          bankName: originalContractData.bankName || '',
          bankCode: selectedBankCode,
          accountNumber: originalContractData.bankAccount || '',
          // 수습기간
          probationStartDate: Timestamp.fromDate(contractData.contractInfo.startDate),
          probationEndDate: contractData.contractInfo.probationPeriod
            ? Timestamp.fromDate(new Date(new Date(contractData.contractInfo.startDate).setMonth(
                new Date(contractData.contractInfo.startDate).getMonth() + contractData.contractInfo.probationPeriod
              )))
            : null,
          probationPeriod: contractData.contractInfo.probationPeriod || 1,
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
          startDate: Timestamp.fromDate(contractData.contractInfo.startDate),
          isActive: true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        })

        // 근로계약서 정보 연결
        const employmentContractRef = doc(db, 'employmentContracts', contractId)
        batch.update(employmentContractRef, {
          employeeId: employeeRef.id
        })

        await batch.commit()
        console.log('✅ 새 직원이 직원관리에 추가되었습니다:', {
          employeeId: employeeRef.id,
          employeeName: contractData.employeeInfo.name,
          residentNumber: contractData.employeeInfo.residentNumber
        })
      } else {
        // 기존 직원 업데이트
        const existingEmployee = employeesSnapshot.docs[0]
        const employeeRef = doc(db, 'employees', existingEmployee.id)
        
        // 은행 코드 찾기
        let selectedBankCode = ''
        if (originalContractData.bankName) {
          try {
            const bankCodesSnapshot = await getDocs(
              query(collection(db, 'bankCodes'), where('name', '==', originalContractData.bankName))
            )
            if (!bankCodesSnapshot.empty) {
              selectedBankCode = bankCodesSnapshot.docs[0].data()?.code || ''
            }
          } catch (error) {
            console.warn('은행 코드 조회 실패:', error)
          }
        }
        
        batch.update(employeeRef, {
          contractFile: contractFileUrl,
          // 계약 정보 업데이트
          employmentType: contractData.contractInfo.employmentType || existingEmployee.data()?.employmentType || '사업소득',
          salaryType: contractData.contractInfo.salaryType,
          salaryAmount: contractData.contractInfo.salaryAmount,
          includesWeeklyHolidayInWage: contractData.contractInfo.includesWeeklyHoliday || false,
          weeklyWorkHours: contractData.contractInfo.weeklyWorkHours,
          // 은행 정보 업데이트 (계좌입금인 경우)
          bankName: originalContractData.bankName || existingEmployee.data()?.bankName || '',
          bankCode: selectedBankCode || existingEmployee.data()?.bankCode || '',
          accountNumber: originalContractData.bankAccount || existingEmployee.data()?.accountNumber || '',
          updatedAt: Timestamp.now()
        })

        // 근로계약서 정보 연결
        const employmentContractRef = doc(db, 'employmentContracts', contractId)
        batch.update(employmentContractRef, {
          employeeId: existingEmployee.id
        })

        await batch.commit()
        console.log('✅ 기존 직원 정보가 업데이트되었습니다:', {
          employeeId: existingEmployee.id,
          employeeName: contractData.employeeInfo.name,
          residentNumber: contractData.employeeInfo.residentNumber
        })
      }
    } catch (error) {
      console.error('❌ 직원관리 동기화 중 오류:', error)
      console.error('오류 상세:', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        contractData: {
          employeeName: contractData.employeeInfo.name,
          residentNumber: contractData.employeeInfo.residentNumber
        }
      })
      // 오류를 다시 throw하여 상위에서 처리할 수 있도록 함
      throw error
    }
  }

  return (
    <ContractTemplate
      branch={branch}
      onComplete={handleContractComplete}
    />
  )
}

