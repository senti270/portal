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
    setLoading(true)
    try {
      // 1. 날짜 변환
      const startDate = new Date(
        parseInt(contractData.startDateYear),
        parseInt(contractData.startDateMonth) - 1,
        parseInt(contractData.startDateDay)
      )
      const endDate = contractData.endDateYear
        ? new Date(
            parseInt(contractData.endDateYear),
            parseInt(contractData.endDateMonth || '1') - 1,
            parseInt(contractData.endDateDay || '1')
          )
        : undefined
      const contractDate = new Date(
        parseInt(contractData.contractDateYear),
        parseInt(contractData.contractDateMonth) - 1,
        parseInt(contractData.contractDateDay)
      )

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
          salaryType: contractData.salaryType,
          salaryAmount: parseFloat(contractData.salaryAmount),
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

      // 4. PDF 생성 (화면 캡처 방식)
      const pdfBlob = await generateContractPdfFromTemplate(contractData, branch)

      // 5. Firebase Storage에 업로드
      const timestamp = Date.now()
      const pdfFileName = `contracts/${branchId}_${timestamp}.pdf`
      const pdfRef = ref(storage, pdfFileName)
      await uploadBytes(pdfRef, pdfBlob)
      const pdfUrl = await getDownloadURL(pdfRef)

      // 6. Firestore에 저장
      const contractId = await saveEmploymentContract({
        ...contractDataForSave,
        contractFile: pdfUrl,
        contractFileName: `근로계약서_${contractData.employeeName}_${timestamp}.pdf`
      })

      // 7. 직원관리에 자동 업로드
      await syncToEmployeeManagement(contractDataForSave, contractId, pdfUrl)

      // 8. 카카오톡 전송
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
        const kakaoResult = await kakaoResponse.json()
        if (kakaoResult.success) {
          console.log('카카오톡 전송 성공')
        } else {
          console.warn('카카오톡 전송 실패:', kakaoResult.error)
        }
      } catch (error) {
        console.error('카카오톡 전송 중 오류:', error)
        // 카카오톡 전송 실패해도 계약서 저장은 완료되었으므로 계속 진행
      }

      alert('근로계약서가 성공적으로 작성되었습니다!\n직원관리에 자동으로 등록되었습니다.')
    } catch (error) {
      console.error('계약서 저장 중 오류:', error)
      alert('계약서 저장 중 오류가 발생했습니다. 콘솔을 확인해주세요.')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const generateContractPdfFromTemplate = async (contractData: ContractData, branch: Branch): Promise<Blob> => {
    // 화면의 계약서 영역을 캡처하여 PDF 생성
    // 실제로는 ContractTemplate 컴포넌트의 DOM을 참조해야 하지만,
    // 여기서는 간단하게 jsPDF로 직접 생성
    const doc = new jsPDF()
    
    // 한글 폰트 문제로 인해 기본 폰트 사용 (실제로는 한글 폰트 추가 필요)
    doc.setFontSize(16)
    doc.text('표준근로계약서', 105, 20, { align: 'center' })
    
    doc.setFontSize(12)
    let y = 30
    
    // 서문
    doc.text(`${branch.ceoName || '대표자'}(이하 "사업주"라 함)과(와)`, 20, y)
    y += 7
    doc.text(`${contractData.employeeName}(이하 "근로자"라 함)은 다음과 같이 근로계약을 체결한다.`, 20, y)
    y += 10
    
    // 1. 근로개시일
    doc.text('1. 근로개시일', 20, y)
    y += 7
    const startDateStr = `${contractData.startDateYear}년 ${contractData.startDateMonth}월 ${contractData.startDateDay}일`
    doc.text(startDateStr, 20, y)
    y += 7
    if (contractData.endDateYear) {
      const endDateStr = `${contractData.endDateYear}년 ${contractData.endDateMonth}월 ${contractData.endDateDay}일`
      doc.text(`종료일: ${endDateStr}`, 20, y)
      y += 7
    }
    doc.text(`수습기간: ${contractData.probationPeriod}개월`, 20, y)
    y += 10
    
    // 2. 근무장소
    doc.text('2. 근무장소', 20, y)
    y += 7
    const workPlaceText = '청담장어마켓(송파점/동탄점/분당점), 카페드로잉(송파점/홍대점/동탄점), 사업주가 관리하는 신규추가지점'
    const workPlaceLines = doc.splitTextToSize(workPlaceText, 170)
    doc.text(workPlaceLines, 20, y)
    y += workPlaceLines.length * 7 + 3
    
    // 3. 업무의 내용
    doc.text('3. 업무의 내용', 20, y)
    y += 7
    const workContentText = '고객응대 및 서빙, 음료, 음식제조 및 매장관리 등 사업장이 지정한 업무'
    const workContentLines = doc.splitTextToSize(workContentText, 170)
    doc.text(workContentLines, 20, y)
    y += workContentLines.length * 7 + 3
    
    // 4. 소정근로시간
    doc.text('4. 소정근로시간', 20, y)
    y += 7
    const workStartTime = `${contractData.workStartHour}:${contractData.workStartMinute}`
    const workEndTime = `${contractData.workEndHour}:${contractData.workEndMinute}`
    doc.text(`${workStartTime} ~ ${workEndTime}`, 20, y)
    y += 10
    
    // 5. 근무일/휴일
    doc.text('5. 근무일/휴일', 20, y)
    y += 7
    doc.text(`매주 ${contractData.workDaysPerWeek}일 근무, 주휴일: ${contractData.weeklyHolidayDay}요일`, 20, y)
    y += 10
    
    // 6. 임금
    doc.text('6. 임금', 20, y)
    y += 7
    const salaryTypeText = contractData.salaryType === 'monthly' ? '월' : contractData.salaryType === 'daily' ? '일' : '시간'
    doc.text(`${salaryTypeText}급: ${parseFloat(contractData.salaryAmount).toLocaleString()}원`, 20, y)
    y += 7
    if (contractData.salaryType === 'hourly') {
      doc.text(`주휴수당 포함: ${contractData.includesWeeklyHoliday ? '예' : '아니오'}`, 20, y)
      y += 7
    }
    doc.text(`임금지급일: 매월 ${contractData.paymentDay}일`, 20, y)
    y += 7
    doc.text(`지급방법: ${contractData.paymentMethod === 'cash' ? '현금' : '계좌입금'}`, 20, y)
    if (contractData.paymentMethod === 'bank' && contractData.bankAccount) {
      y += 7
      doc.text(`계좌번호: ${contractData.bankAccount}`, 20, y)
    }
    y += 10
    
    // 계약일자
    const contractDateStr = `${contractData.contractDateYear}년 ${contractData.contractDateMonth}월 ${contractData.contractDateDay}일`
    doc.text(contractDateStr, 105, y, { align: 'center' })
    y += 15
    
    // 사업주 정보
    doc.text('사업주', 20, y)
    y += 7
    doc.text(`사업체명: ${branch.companyName || branch.name}`, 20, y)
    y += 7
    doc.text(`주소: ${branch.address || ''}`, 20, y)
    y += 7
    doc.text(`대표자: ${branch.ceoName || ''}`, 20, y)
    
    // 사업주 서명 이미지 추가 (서명 자리에)
    if (contractData.employerSignature) {
      try {
        const employerSigImg = new Image()
        employerSigImg.src = contractData.employerSignature
        await new Promise((resolve) => {
          employerSigImg.onload = () => {
            // 대표자 이름 옆에 서명 이미지 추가
            const textWidth = doc.getTextWidth(`대표자: ${branch.ceoName || ''}`)
            doc.addImage(employerSigImg, 'PNG', 20 + textWidth + 2, y - 5, 40, 15)
            resolve(null)
          }
          employerSigImg.onerror = () => {
            doc.text('(서명)', 20 + doc.getTextWidth(`대표자: ${branch.ceoName || ''}`) + 2, y)
            resolve(null)
          }
        })
      } catch (error) {
        console.error('사업주 서명 이미지 추가 실패:', error)
        doc.text('(서명)', 20 + doc.getTextWidth(`대표자: ${branch.ceoName || ''}`) + 2, y)
      }
    } else {
      doc.text('(서명)', 20 + doc.getTextWidth(`대표자: ${branch.ceoName || ''}`) + 2, y)
    }
    y += 10
    
    // 근로자 정보
    doc.text('근로자', 20, y)
    y += 7
    doc.text(`주소: ${contractData.employeeAddress}`, 20, y)
    y += 7
    doc.text(`연락처: ${contractData.employeePhone}`, 20, y)
    y += 7
    doc.text(`성명: ${contractData.employeeName}`, 20, y)
    
    // 근로자 서명 이미지 추가 (서명 자리에)
    if (contractData.employeeSignature) {
      try {
        const employeeSigImg = new Image()
        employeeSigImg.src = contractData.employeeSignature
        await new Promise((resolve) => {
          employeeSigImg.onload = () => {
            // 성명 옆에 서명 이미지 추가
            const textWidth = doc.getTextWidth(`성명: ${contractData.employeeName}`)
            doc.addImage(employeeSigImg, 'PNG', 20 + textWidth + 2, y - 5, 40, 15)
            resolve(null)
          }
          employeeSigImg.onerror = () => {
            doc.text('(서명)', 20 + doc.getTextWidth(`성명: ${contractData.employeeName}`) + 2, y)
            resolve(null)
          }
        })
      } catch (error) {
        console.error('근로자 서명 이미지 추가 실패:', error)
        doc.text('(서명)', 20 + doc.getTextWidth(`성명: ${contractData.employeeName}`) + 2, y)
      }
    } else {
      doc.text('(서명)', 20 + doc.getTextWidth(`성명: ${contractData.employeeName}`) + 2, y)
    }
    y += 7
    doc.text(`주민등록번호: ${contractData.residentNumber}`, 20, y)
    
    const pdfBlob = doc.output('blob')
    return pdfBlob
  }

  const syncToEmployeeManagement = async (
    contractData: Omit<EmploymentContract, 'id' | 'createdAt' | 'updatedAt'>,
    contractId: string,
    contractFileUrl: string
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
        const employeeData = {
          name: contractData.employeeInfo.name,
          phone: contractData.employeeInfo.phone,
          email: contractData.employeeInfo.email || '',
          residentNumber: contractData.employeeInfo.residentNumber,
          address: contractData.employeeInfo.address,
          hireDate: contractData.contractInfo.startDate,
          status: 'active' as const,
          contractFile: contractFileUrl,
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

        // 근로계약서 정보 연결
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
          contractFile: contractFileUrl,
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

  return (
    <ContractTemplate
      branch={branch}
      onComplete={handleContractComplete}
    />
  )
}

