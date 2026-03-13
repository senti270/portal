'use client'

import { useState } from 'react'
import { collection, addDoc, getDocs, getDoc, query, where, Timestamp, writeBatch, doc } from 'firebase/firestore'
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

interface MatchedEmployee {
  id: string
  name: string
  phone: string
  residentNumber?: string
}

export default function ContractTemplateHandler({ branchId, branch }: ContractTemplateHandlerProps) {
  const [loading, setLoading] = useState(false)
  const [contractFileUrl, setContractFileUrl] = useState<string | null>(null)
  const [showSamePersonModal, setShowSamePersonModal] = useState(false)
  const [matchedEmployees, setMatchedEmployees] = useState<MatchedEmployee[]>([])
  const [pendingSync, setPendingSync] = useState<{
    contractDataForSave: Omit<EmploymentContract, 'id' | 'createdAt' | 'updatedAt'>
    contractId: string
    pdfUrl: string
    originalContractData: ContractData
  } | null>(null)

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
          salaryAmount: (() => {
            const amount = contractData.salaryAmount ? parseFloat(String(contractData.salaryAmount).replace(/,/g, '')) : 0
            console.log('💰 시급 금액 변환:', {
              원본값: contractData.salaryAmount,
              변환값: amount,
              타입: typeof contractData.salaryAmount
            })
            return isNaN(amount) ? 0 : amount
          })(), // 시급/일급/월급 금액
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
        salaryAmountType: typeof contractDataForSave.contractInfo.salaryAmount,
        employmentType: contractDataForSave.contractInfo.employmentType,
        전체contractInfo: contractDataForSave.contractInfo
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

      // 7. 동명이인 또는 같은 전화번호 직원 검색
      const nameQuery = query(
        collection(db, 'employees'),
        where('name', '==', contractDataForSave.employeeInfo.name)
      )
      const phoneQuery = query(
        collection(db, 'employees'),
        where('phone', '==', contractDataForSave.employeeInfo.phone)
      )
      const [nameSnap, phoneSnap] = await Promise.all([
        getDocs(nameQuery),
        getDocs(phoneQuery)
      ])
      const seenIds = new Set<string>()
      const merged: MatchedEmployee[] = []
      nameSnap.docs.forEach((d) => {
        if (seenIds.has(d.id)) return
        seenIds.add(d.id)
        const ddata = d.data()
        merged.push({
          id: d.id,
          name: ddata.name ?? '',
          phone: ddata.phone ?? '',
          residentNumber: ddata.residentNumber
        })
      })
      phoneSnap.docs.forEach((d) => {
        if (seenIds.has(d.id)) return
        seenIds.add(d.id)
        const ddata = d.data()
        merged.push({
          id: d.id,
          name: ddata.name ?? '',
          phone: ddata.phone ?? '',
          residentNumber: ddata.residentNumber
        })
      })

      const doPostSyncSteps = async () => {
        console.log('📱 카카오톡 전송 시작...')
        try {
          const kakaoResponse = await fetch('/api/employment-contract/send-kakao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phoneNumber: contractData.employeePhone,
              contractUrl: pdfUrl,
              employeeName: contractData.employeeName
            })
          })
          if (!kakaoResponse.ok) {
            const errorText = await kakaoResponse.text()
            console.error('❌ 카카오톡 전송 API 오류:', { status: kakaoResponse.status, body: errorText })
          } else {
            const kakaoResult = await kakaoResponse.json()
            if (kakaoResult.success) console.log('✅ 카카오톡 전송 성공:', kakaoResult.message)
            else console.warn('⚠️ 카카오톡 전송 실패:', kakaoResult.error)
          }
        } catch (error) {
          console.error('❌ 카카오톡 전송 중 오류:', error)
        }
        console.log('🎉 모든 작업 완료!')
        setContractFileUrl(pdfUrl)
        alert('근로계약서가 성공적으로 작성되었습니다!\n직원관리에 자동으로 등록되었습니다.')
      }

      if (merged.length === 0) {
        // 매칭 없음 → 신규 직원 생성 + 계약 연결
        console.log('👤 직원관리 동기화 시작 (신규 직원)...')
        try {
          await syncToEmployeeManagement(contractDataForSave, contractId, pdfUrl, contractData, null)
          console.log('✅ 직원관리 동기화 완료')
          await doPostSyncSteps()
        } catch (error) {
          console.error('❌ 직원관리 동기화 오류:', error)
          alert('⚠️ 계약서는 저장되었지만 직원관리 동기화에 실패했습니다.\n직원관리 화면에서 수동으로 확인해주세요.')
        }
      } else {
        // 매칭 있음 → 같은 사람 확인 모달
        setPendingSync({
          contractDataForSave,
          contractId,
          pdfUrl,
          originalContractData: contractData
        })
        setMatchedEmployees(merged)
        setShowSamePersonModal(true)
        setLoading(false)
        return
      }
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
        max-width: 210mm;
        background: white;
        font-family: 'Malgun Gothic', '맑은 고딕', 'Noto Sans KR', Arial, sans-serif;
        color: black;
        z-index: 9999;
        padding: 15mm;
        font-size: 11pt;
        line-height: 1.5;
        overflow: hidden;
      `
      document.body.appendChild(element)
      
      // HTML을 캔버스로 변환 (A4 한 장에 맞게, 서명 품질 향상)
      const canvas = await html2canvas(element, {
        scale: 2, // 서명 품질 향상을 위해 scale 증가
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794, // 210mm in pixels at 96dpi
        height: 1123, // 297mm in pixels at 96dpi (A4 height)
        windowWidth: 794,
        windowHeight: 1123,
        logging: false,
        imageTimeout: 0
      })
      
      // 임시 div 제거
      document.body.removeChild(element)
      
      // 캔버스를 PDF로 변환 (A4 한 장)
      const imgData = canvas.toDataURL('image/png')
      const doc = new jsPDF('p', 'mm', 'a4')
      
      const imgWidth = 210 // A4 width in mm
      const imgHeight = 297 // A4 height in mm (한 장에 맞춤)
      
      // A4 한 장에 맞게 이미지 추가
      doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      
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
    const salaryAmount = contractData.salaryAmount ? parseFloat(String(contractData.salaryAmount)) : 0
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Malgun Gothic', '맑은 고딕', 'Noto Sans KR', Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.5;
            padding: 15mm;
            margin: 0;
            width: 210mm;
            background: white;
          }
          .title {
            text-align: center;
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 12px;
          }
          .section {
            margin-bottom: 10px;
          }
          .section-title {
            font-weight: bold;
            margin-bottom: 3px;
            font-size: 11pt;
          }
          .section-content {
            font-size: 10pt;
            line-height: 1.4;
            margin-left: 0;
          }
          .signature-area {
            display: inline-block;
            width: 60px;
            height: 25px;
            border: 1px solid #ccc;
            margin-left: 8px;
            vertical-align: middle;
          }
          .contract-date {
            text-align: center;
            margin: 12px 0;
            font-size: 11pt;
          }
          .signature-section {
            margin-top: 15px;
          }
          .signature-section-title {
            font-weight: bold;
            margin-bottom: 5px;
            font-size: 11pt;
          }
          .signature-info {
            font-size: 10pt;
            line-height: 1.4;
            margin-bottom: 2px;
          }
        </style>
      </head>
      <body>
        <div class="title">표준근로계약서</div>
        
        <div class="section">
          <p class="section-content">${branch.ceoName || '대표자'}(이하 "사업주"라 함)과(와) ${contractData.employeeName}(이하 "근로자"라 함)은 다음과 같이 근로계약을 체결한다.</p>
        </div>
        
        <div class="section">
          <div class="section-title">1. 근로개시일</div>
          <div class="section-content">
            <p>${startDateStr}${endDateStr ? ` (필요시 종료일 기재: ${endDateStr})` : ''}</p>
            <p>최초 ${contractData.probationPeriod}개월은 수습기간임. 수습기간은 임금의 90% 지급함.</p>
            <p>단, 수습기간 중 업무평가결과에 따라 계약을 해지할 수 있음</p>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">2. 근무장소</div>
          <div class="section-content">
            <p>${workPlaceText}</p>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">3. 업무의 내용</div>
          <div class="section-content">
            <p>${workContentText}</p>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">4. 소정근로시간</div>
          <div class="section-content">
            <p>${workStartTime} ~ ${workEndTime}</p>
            <p>(휴게시간: ${contractData.breakStartHour && contractData.breakStartMinute ? `${contractData.breakStartHour}:${contractData.breakStartMinute} ~ ${contractData.breakEndHour}:${contractData.breakEndMinute}` : '법정휴게시간 준수'})</p>
            <p>- (법정휴게시간 준수: 4시간 근무시마다 30분)</p>
            <p>- (흡연, 식사, 차량출차 같은 업무에 해당하지 않는 시간은 휴게시간으로 본다)</p>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">5. 근무일/휴일</div>
          <div class="section-content">
            <p>매주 ${contractData.workDaysPerWeek}일 근무${contractData.workDaysDetail ? `(필요시, 근무요일: ${contractData.workDaysDetail})` : ''}</p>
            <p>사업장의 상황이나 근로자 요청에 따라 근무일 또는 휴무일이 변경될 수 있으며, 이 경우 상호 협의하여 조정함</p>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">6. 임금</div>
          <div class="section-content">
            <p>${salaryTypeText}(일, 시간)급: ${salaryAmount.toLocaleString()}원(세전)</p>
            ${contractData.salaryType === 'hourly' ? `<p>시급인 경우 확인: 주휴수당 포함 [${contractData.includesWeeklyHoliday ? '✓' : ' '}]</p>` : ''}
            <p>임금지급일: 매월(매주 또는 매일) ${contractData.paymentDay}일(휴일의 경우는 익일 지급)</p>
            <p>지급방법: 근로자에게 직접(현금)지급 [${contractData.paymentMethod === 'cash' ? '✓' : ' '}], 근로자 명의 계좌에 입금 [${contractData.paymentMethod === 'bank' ? '✓' : ' '}]</p>
            ${contractData.paymentMethod === 'bank' ? `<p>계좌번호: ${contractData.bankName || ''} ${contractData.bankAccount || ''}</p>` : '<p>계좌번호: </p>'}
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">7. 근로계약서 교부</div>
          <div class="section-content">
            <p>사업주는 근로계약을 체결함과 동시에 본 계약서를 사본하여 근로자의 교부 요구와 관계없이 근로자에게 교부함(근로기준법 제17조 이행)</p>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">8. 근로계약, 취업규칙 등의 성실한 이행의무</div>
          <div class="section-content">
            <p>사업주와 근로자는 각자가 근로계약, 취업규칙, 단체협약을 지키고 성실하게 이행하여야 함</p>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">9. 그 밖의 사항</div>
          <div class="section-content">
            <p>이 계약에 정함이 없는 사항은 근로관계법령에 따름</p>
          </div>
        </div>
        
        <div class="contract-date">
          <p>${contractDateStr}</p>
        </div>
        
        <div class="signature-section">
          <div class="signature-section-title">(사업주)</div>
          <div class="signature-info">
            <p>사업체명: ${branch.companyName || branch.name}</p>
            <p>주소: ${branch.address || ''}</p>
            <p>대표자: <span style="display: inline-block; min-width: 80px;">${branch.ceoName || ''}</span> ${contractData.employerSignature ? '<img src="' + contractData.employerSignature + '" style="width: 100px; height: 40px; margin-left: 10px; vertical-align: middle; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; display: inline-block;" />' : '<span class="signature-area"></span>'}</p>
          </div>
        </div>
        
        <div class="signature-section">
          <div class="signature-section-title">(근로자)</div>
          <div class="signature-info">
            <p>주소: ${contractData.employeeAddress}</p>
            <p>연락처: ${contractData.employeePhone}</p>
            <p>성명: <span style="display: inline-block; min-width: 80px;">${contractData.employeeName}</span> ${contractData.employeeSignature ? '<img src="' + contractData.employeeSignature + '" style="width: 100px; height: 40px; margin-left: 10px; vertical-align: middle; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; display: inline-block;" />' : '<span class="signature-area"></span>'}</p>
            <p>주민등록번호: ${contractData.residentNumber}</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  const syncToEmployeeManagement = async (
    contractData: Omit<EmploymentContract, 'id' | 'createdAt' | 'updatedAt'>,
    contractId: string,
    contractFileUrl: string,
    originalContractData: ContractData,
    existingEmployeeId: string | null
  ) => {
    try {
      const batch = writeBatch(db)

      if (!existingEmployeeId) {
        // 새 직원 추가 (근로계약정보는 이미 saveEmploymentContract에서 INSERT됨 → employeeId만 연결)
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
        // 기존 직원 업데이트 (직원 UPDATE + 근로계약정보는 이미 INSERT됨 → employeeId만 연결)
        const existingDoc = await getDoc(doc(db, 'employees', existingEmployeeId))
        if (!existingDoc.exists()) {
          throw new Error('선택한 직원을 찾을 수 없습니다.')
        }
        const existingEmployee = existingDoc
        const employeeRef = doc(db, 'employees', existingEmployee.id)
        const existingData = existingEmployee.data()

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
          employmentType: contractData.contractInfo.employmentType || existingData?.employmentType || '사업소득',
          salaryType: contractData.contractInfo.salaryType,
          salaryAmount: contractData.contractInfo.salaryAmount,
          includesWeeklyHolidayInWage: contractData.contractInfo.includesWeeklyHoliday ?? false,
          weeklyWorkHours: contractData.contractInfo.weeklyWorkHours,
          bankName: originalContractData.bankName || existingData?.bankName || '',
          bankCode: selectedBankCode || existingData?.bankCode || '',
          accountNumber: originalContractData.bankAccount || existingData?.accountNumber || '',
          updatedAt: Timestamp.now()
        })

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

  const handleSamePersonConfirm = async (selectedEmployeeId: string) => {
    if (!pendingSync) return
    setLoading(true)
    setShowSamePersonModal(false)
    try {
      await syncToEmployeeManagement(
        pendingSync.contractDataForSave,
        pendingSync.contractId,
        pendingSync.pdfUrl,
        pendingSync.originalContractData,
        selectedEmployeeId
      )
      console.log('✅ 직원관리 동기화 완료 (기존 직원 연결)')
      // 카카오 + 성공 알림
      try {
        const res = await fetch('/api/employment-contract/send-kakao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: pendingSync.originalContractData.employeePhone,
            contractUrl: pendingSync.pdfUrl,
            employeeName: pendingSync.originalContractData.employeeName
          })
        })
        if (res.ok) {
          const data = await res.json()
          if (data.success) console.log('✅ 카카오톡 전송 성공')
        }
      } catch (e) {
        console.error('카카오톡 전송 오류:', e)
      }
      setContractFileUrl(pendingSync.pdfUrl)
      alert('근로계약서가 성공적으로 작성되었습니다!\n선택한 직원 정보에 연결되었습니다.')
    } catch (error) {
      console.error('❌ 직원관리 동기화 오류:', error)
      alert('⚠️ 직원 연결에 실패했습니다. 직원관리 화면에서 수동으로 확인해주세요.')
    } finally {
      setPendingSync(null)
      setMatchedEmployees([])
      setLoading(false)
    }
  }

  const handleNewEmployeeConfirm = async () => {
    if (!pendingSync) return
    setLoading(true)
    setShowSamePersonModal(false)
    try {
      await syncToEmployeeManagement(
        pendingSync.contractDataForSave,
        pendingSync.contractId,
        pendingSync.pdfUrl,
        pendingSync.originalContractData,
        null
      )
      console.log('✅ 직원관리 동기화 완료 (신규 직원)')
      try {
        const res = await fetch('/api/employment-contract/send-kakao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: pendingSync.originalContractData.employeePhone,
            contractUrl: pendingSync.pdfUrl,
            employeeName: pendingSync.originalContractData.employeeName
          })
        })
        if (res.ok) {
          const data = await res.json()
          if (data.success) console.log('✅ 카카오톡 전송 성공')
        }
      } catch (e) {
        console.error('카카오톡 전송 오류:', e)
      }
      setContractFileUrl(pendingSync.pdfUrl)
      alert('근로계약서가 성공적으로 작성되었습니다!\n직원관리에 새로 등록되었습니다.')
    } catch (error) {
      console.error('❌ 직원관리 동기화 오류:', error)
      alert('⚠️ 직원 등록에 실패했습니다. 직원관리 화면에서 수동으로 확인해주세요.')
    } finally {
      setPendingSync(null)
      setMatchedEmployees([])
      setLoading(false)
    }
  }

  return (
    <>
      <ContractTemplate
        branch={branch}
        onComplete={handleContractComplete}
        contractFileUrl={contractFileUrl}
      />
      {showSamePersonModal && pendingSync && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-2">같은 사람인가요?</h3>
            <p className="text-gray-600 mb-4">
              다음 직원 중 계약서와 동일한 사람이 있나요? 선택하면 해당 직원 정보에 계약이 연결됩니다.
            </p>
            <ul className="space-y-3 mb-6">
              {matchedEmployees.map((emp) => (
                <li key={emp.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                  <div>
                    <span className="font-semibold text-gray-800">{emp.name}</span>
                    <span className="block text-sm text-gray-500">{emp.phone || '(연락처 없음)'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSamePersonConfirm(emp.id)}
                    className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
                  >
                    이 사람으로 연결
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleNewEmployeeConfirm}
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-xl"
              >
                아니오, 새 직원으로 등록
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

