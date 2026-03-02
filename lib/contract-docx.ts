import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import jsPDF from 'jspdf'

// 기본 DOCX 템플릿 (간단한 버전)
// 실제로는 public/templates/ 폴더에 템플릿 파일을 두고 fetch로 가져와야 합니다
const createDefaultDocxTemplate = () => {
  // 간단한 DOCX 구조 생성 (실제로는 템플릿 파일 사용 권장)
  // 여기서는 기본 구조만 제공하고, 실제 템플릿 파일을 사용하도록 안내
  return null
}

// 필드 매핑을 사용하여 데이터 변환
function mapDataFields(contractData: any, branch: any, fieldMapping: Record<string, string>): Record<string, any> {
  const dataMap: Record<string, any> = {
    // 회사 정보
    companyName: branch.companyName || branch.name,
    ceoName: branch.ceoName || '',
    businessNumber: branch.businessNumber || '',
    branchName: branch.name,
    branchAddress: branch.address || '',
    branchPhone: branch.phone || '',
    
    // 직원 정보
    employeeName: contractData.employeeInfo.name,
    residentNumber: contractData.employeeInfo.residentNumber,
    employeeAddress: contractData.employeeInfo.address,
    employeePhone: contractData.employeeInfo.phone,
    employeeEmail: contractData.employeeInfo.email || '',
    
    // 계약 정보
    startDate: contractData.contractInfo.startDate.toLocaleDateString('ko-KR'),
    endDate: contractData.contractInfo.endDate?.toLocaleDateString('ko-KR') || '',
    workType: contractData.contractInfo.workType,
    workPlace: contractData.contractInfo.workPlace,
    workContent: contractData.contractInfo.workContent || '',
    
    // 급여 정보
    salaryType: contractData.contractInfo.salaryType === 'monthly' ? '월급' : 
                contractData.contractInfo.salaryType === 'hourly' ? '시급' : '일급',
    salaryAmount: contractData.contractInfo.salaryAmount.toLocaleString(),
    weeklyWorkHours: contractData.contractInfo.weeklyWorkHours || '',
    dailyWorkHours: contractData.contractInfo.dailyWorkHours || '',
    
    // 근무 시간
    workDays: contractData.contractInfo.workDays || '',
    workStartTime: contractData.contractInfo.workStartTime || '',
    workEndTime: contractData.contractInfo.workEndTime || '',
    breakTime: contractData.contractInfo.breakTime || '',
    
    // 기타
    probationPeriod: contractData.contractInfo.probationPeriod || '',
    notes: contractData.contractInfo.notes || '',
    signedDate: contractData.signedAt?.toDate ? contractData.signedAt.toDate().toLocaleDateString('ko-KR') : new Date().toLocaleDateString('ko-KR')
  }

  // 필드 매핑을 사용하여 템플릿 데이터 생성
  const templateData: Record<string, any> = {}
  
  // 매핑이 없으면 기본 매핑 사용
  if (Object.keys(fieldMapping).length === 0) {
    return dataMap
  }

  // 필드 매핑에 따라 데이터 변환
  Object.entries(fieldMapping).forEach(([templateField, dataField]) => {
    if (dataField.startsWith('__CUSTOM_VALUE__:')) {
      // 커스텀 값
      templateData[templateField] = dataField.replace('__CUSTOM_VALUE__:', '')
    } else if (dataMap[dataField] !== undefined) {
      // 매핑된 데이터 필드
      templateData[templateField] = dataMap[dataField]
    } else {
      // 매핑되지 않은 필드는 빈 문자열
      templateData[templateField] = ''
    }
  })

  return templateData
}

export async function generateContractDocx(
  contractData: any, 
  branch: any, 
  templateFile?: File,
  fieldMapping?: Record<string, string>
): Promise<Blob> {
  try {
    // 템플릿 파일이 제공된 경우
    if (templateFile) {
      const templateBuffer = await templateFile.arrayBuffer()
      const zip = new PizZip(templateBuffer)
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true
      })

      // 필드 매핑을 사용하여 데이터 준비
      const templateData = fieldMapping 
        ? mapDataFields(contractData, branch, fieldMapping)
        : mapDataFields(contractData, branch, {})

      doc.setData(templateData)
      
      try {
        doc.render()
      } catch (error: any) {
        // 렌더링 오류 처리
        if (error.properties && error.properties.errors instanceof Array) {
          const errorMessages = error.properties.errors
            .map((e: any) => `- ${e.name}: ${e.message}`)
            .join('\n')
          throw new Error(`템플릿 렌더링 오류:\n${errorMessages}`)
        }
        throw error
      }

      const buf = doc.getZip().generate({ 
        type: 'blob', 
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      })
      return buf
    }

    // 템플릿 파일이 없는 경우 빈 파일 생성
    console.warn('DOCX 템플릿 파일이 없어 빈 파일을 생성합니다. 템플릿 파일을 업로드해주세요.')
    const blob = new Blob([], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    return blob
  } catch (error) {
    console.error('DOCX 생성 중 오류:', error)
    throw error
  }
}

export async function generateContractPdf(contractData: any, branch: any): Promise<Blob> {
  try {
    const doc = new jsPDF()
    
    // 한글 폰트 설정 (기본 폰트는 한글을 지원하지 않으므로 주의)
    // 실제로는 한글 폰트를 추가해야 합니다
    doc.setFontSize(16)
    doc.text('근로계약서', 105, 20, { align: 'center' })
    
    doc.setFontSize(12)
    let y = 40
    
    doc.text(`회사명: ${branch.companyName || branch.name}`, 20, y)
    y += 10
    doc.text(`대표자: ${branch.ceoName || ''}`, 20, y)
    y += 10
    doc.text(`사업자등록번호: ${branch.businessNumber || ''}`, 20, y)
    y += 15
    
    doc.text('근로자 정보', 20, y)
    y += 10
    doc.text(`이름: ${contractData.employeeInfo.name}`, 20, y)
    y += 10
    doc.text(`주민등록번호: ${contractData.employeeInfo.residentNumber}`, 20, y)
    y += 10
    doc.text(`주소: ${contractData.employeeInfo.address}`, 20, y)
    y += 10
    doc.text(`전화번호: ${contractData.employeeInfo.phone}`, 20, y)
    y += 15
    
    doc.text('계약 정보', 20, y)
    y += 10
    doc.text(`근로 시작일: ${contractData.contractInfo.startDate.toLocaleDateString('ko-KR')}`, 20, y)
    y += 10
    if (contractData.contractInfo.endDate) {
      doc.text(`근로 종료일: ${contractData.contractInfo.endDate.toLocaleDateString('ko-KR')}`, 20, y)
      y += 10
    }
    doc.text(`고용형태: ${contractData.contractInfo.workType}`, 20, y)
    y += 10
    doc.text(`근무지: ${contractData.contractInfo.workPlace}`, 20, y)
    y += 10
    const salaryTypeText = contractData.contractInfo.salaryType === 'monthly' ? '월급' : 
                           contractData.contractInfo.salaryType === 'hourly' ? '시급' : '일급'
    doc.text(`급여 형태: ${salaryTypeText}`, 20, y)
    y += 10
    doc.text(`급여 금액: ${contractData.contractInfo.salaryAmount.toLocaleString()}원`, 20, y)
    y += 10
    doc.text(`근무 시간: ${contractData.contractInfo.workStartTime} ~ ${contractData.contractInfo.workEndTime}`, 20, y)
    y += 10
    doc.text(`수습기간: ${contractData.contractInfo.probationPeriod}개월`, 20, y)
    y += 15
    
    // 서명 이미지 추가
    if (contractData.signatures.employee.signatureImage) {
      try {
        const employeeSigImg = new Image()
        employeeSigImg.src = contractData.signatures.employee.signatureImage
        await new Promise((resolve) => {
          employeeSigImg.onload = () => {
            doc.addImage(employeeSigImg, 'PNG', 20, y, 60, 30)
            resolve(null)
          }
          employeeSigImg.onerror = () => resolve(null)
        })
        doc.text('근로자 서명', 20, y + 35)
        y += 50
      } catch (error) {
        console.error('근로자 서명 이미지 추가 실패:', error)
      }
    }
    
    if (contractData.signatures.employer.signatureImage) {
      try {
        const employerSigImg = new Image()
        employerSigImg.src = contractData.signatures.employer.signatureImage
        await new Promise((resolve) => {
          employerSigImg.onload = () => {
            doc.addImage(employerSigImg, 'PNG', 120, y - 50, 60, 30)
            resolve(null)
          }
          employerSigImg.onerror = () => resolve(null)
        })
        doc.text('사용자자 서명', 120, y - 15)
      } catch (error) {
        console.error('사용자자 서명 이미지 추가 실패:', error)
      }
    }
    
    const signedAtDate = contractData.signedAt?.toDate ? contractData.signedAt.toDate() : 
                        contractData.signedAt instanceof Date ? contractData.signedAt : new Date()
    doc.text(`서명일: ${signedAtDate.toLocaleDateString('ko-KR')}`, 20, y + 20)
    
    const pdfBlob = doc.output('blob')
    return pdfBlob
  } catch (error) {
    console.error('PDF 생성 중 오류:', error)
    throw error
  }
}

