'use client'

import { useState, useEffect } from 'react'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'

interface TemplateField {
  name: string
  mappedTo: string
  description?: string
}

interface TemplateFieldMapperProps {
  templateFile: File | null
  onMappingComplete: (mapping: Record<string, string>) => void
  onCancel: () => void
}

export default function TemplateFieldMapper({ 
  templateFile, 
  onMappingComplete, 
  onCancel 
}: TemplateFieldMapperProps) {
  const [templateFields, setTemplateFields] = useState<string[]>([])
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [availableDataFields, setAvailableDataFields] = useState<string[]>([])

  // 사용 가능한 데이터 필드 목록
  const dataFields = [
    // 회사 정보
    'companyName',
    'ceoName',
    'businessNumber',
    'branchName',
    'branchAddress',
    'branchPhone',
    
    // 직원 정보
    'employeeName',
    'residentNumber',
    'employeeAddress',
    'employeePhone',
    'employeeEmail',
    
    // 계약 정보
    'startDate',
    'endDate',
    'workType',
    'workPlace',
    'workContent',
    
    // 급여 정보
    'salaryType',
    'salaryAmount',
    'weeklyWorkHours',
    'dailyWorkHours',
    
    // 근무 시간
    'workDays',
    'workStartTime',
    'workEndTime',
    'breakTime',
    
    // 기타
    'probationPeriod',
    'notes',
    'signedDate',
    'employeeSignature',
    'employerSignature'
  ]

  useEffect(() => {
    setAvailableDataFields(dataFields)
  }, [])

  useEffect(() => {
    if (templateFile) {
      extractTemplateFields()
    }
  }, [templateFile])

  const extractTemplateFields = async () => {
    if (!templateFile) return

    setLoading(true)
    try {
      const arrayBuffer = await templateFile.arrayBuffer()
      const zip = new PizZip(arrayBuffer)
      
      // DOCX 파일에서 템플릿 변수 추출
      // docxtemplater는 템플릿 변수를 {변수명} 패턴으로 사용
      // XML에서 {변수명} 패턴을 찾아야 함
      const xmlContent = zip.files['word/document.xml'].asText()
      
      // {변수명} 패턴 찾기 (공백, 줄바꿈 등 제거)
      const fieldPattern = /\{([^}]+)\}/g
      const fields: string[] = []
      let match
      
      while ((match = fieldPattern.exec(xmlContent)) !== null) {
        let fieldName = match[1].trim()
        
        // XML 엔티티 디코딩
        fieldName = fieldName
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
        
        // 공백 정리 및 중복 제거
        fieldName = fieldName.replace(/\s+/g, ' ').trim()
        
        if (fieldName && !fields.includes(fieldName)) {
          fields.push(fieldName)
        }
      }
      
      // 필드가 없으면 docxtemplater로 시도
      if (fields.length === 0) {
        try {
          const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true
          })
          // 빈 데이터로 렌더링 시도하여 필드 추출
          doc.setData({})
          doc.render()
        } catch (error: any) {
          // 렌더링 오류에서 필드 정보 추출 시도
          if (error.properties && error.properties.errors) {
            error.properties.errors.forEach((err: any) => {
              if (err.name && !fields.includes(err.name)) {
                fields.push(err.name)
              }
            })
          }
        }
      }

      setTemplateFields(fields)
      
      // 기본 매핑 설정 (필드명이 같으면 자동 매핑)
      const defaultMapping: Record<string, string> = {}
      fields.forEach(field => {
        const matchingDataField = dataFields.find(df => 
          df.toLowerCase() === field.toLowerCase() ||
          df.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase() === field.toLowerCase()
        )
        if (matchingDataField) {
          defaultMapping[field] = matchingDataField
        }
      })
      setFieldMapping(defaultMapping)
    } catch (error) {
      console.error('템플릿 필드 추출 중 오류:', error)
      alert('템플릿 파일을 읽는 중 오류가 발생했습니다. 파일이 올바른 DOCX 형식인지 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleMappingChange = (templateField: string, dataField: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [templateField]: dataField
    }))
  }

  const handleComplete = () => {
    // 모든 필드가 매핑되었는지 확인
    const unmappedFields = templateFields.filter(field => !fieldMapping[field])
    if (unmappedFields.length > 0) {
      if (!confirm(`${unmappedFields.length}개의 필드가 매핑되지 않았습니다. 계속하시겠습니까?`)) {
        return
      }
    }
    onMappingComplete(fieldMapping)
  }

  const getFieldDisplayName = (fieldName: string): string => {
    const displayNames: Record<string, string> = {
      companyName: '회사명',
      ceoName: '대표자명',
      businessNumber: '사업자등록번호',
      branchName: '지점명',
      branchAddress: '지점 주소',
      branchPhone: '지점 전화번호',
      employeeName: '직원 이름',
      residentNumber: '주민등록번호',
      employeeAddress: '직원 주소',
      employeePhone: '직원 전화번호',
      employeeEmail: '직원 이메일',
      startDate: '근로 시작일',
      endDate: '근로 종료일',
      workType: '고용형태',
      workPlace: '근무지',
      workContent: '업무 내용',
      salaryType: '급여 형태',
      salaryAmount: '급여 금액',
      weeklyWorkHours: '주간 근무시간',
      dailyWorkHours: '일일 근무시간',
      workDays: '근무일',
      workStartTime: '근무 시작 시간',
      workEndTime: '근무 종료 시간',
      breakTime: '휴게 시간',
      probationPeriod: '수습기간',
      notes: '비고',
      signedDate: '서명일',
      employeeSignature: '근로자 서명',
      employerSignature: '사용자자 서명'
    }
    return displayNames[fieldName] || fieldName
  }

  if (!templateFile) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        템플릿 필드 매핑 설정
      </h2>
      <p className="text-gray-600 mb-6">
        템플릿 파일의 각 필드에 어떤 데이터를 넣을지 선택해주세요.
      </p>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">템플릿 파일을 분석하는 중...</p>
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-6">
            {templateFields.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                템플릿 파일에서 필드를 찾을 수 없습니다.
                <br />
                템플릿 파일에 {'{필드명}'} 형식의 변수가 있는지 확인해주세요.
              </div>
            ) : (
              templateFields.map((templateField) => (
                <div key={templateField} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        템플릿 필드: <code className="bg-gray-100 px-2 py-1 rounded">{'{' + templateField + '}'}</code>
                      </label>
                      <select
                        value={fieldMapping[templateField] || ''}
                        onChange={(e) => handleMappingChange(templateField, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">매핑할 데이터 선택...</option>
                        {availableDataFields.map((dataField) => (
                          <option key={dataField} value={dataField}>
                            {getFieldDisplayName(dataField)} ({dataField})
                          </option>
                        ))}
                        <option value="__CUSTOM__">직접 입력...</option>
                      </select>
                      {fieldMapping[templateField] === '__CUSTOM__' && (
                        <input
                          type="text"
                          placeholder="직접 입력할 값"
                          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onChange={(e) => {
                            // 커스텀 값은 별도로 저장
                            setFieldMapping(prev => ({
                              ...prev,
                              [templateField]: `__CUSTOM_VALUE__:${e.target.value}`
                            }))
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end gap-4">
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              취소
            </button>
            <button
              onClick={handleComplete}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              매핑 완료
            </button>
          </div>
        </>
      )}
    </div>
  )
}

