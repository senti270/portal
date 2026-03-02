'use client'

import { useState, useEffect } from 'react'
import TemplateFieldMapper from './TemplateFieldMapper'

export default function TemplateFileUploader() {
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [showMapper, setShowMapper] = useState(false)
  const [templateFileName, setTemplateFileName] = useState<string>('')

  useEffect(() => {
    // 로컬 스토리지에서 저장된 템플릿 정보 불러오기
    const savedTemplate = localStorage.getItem('employmentContractTemplate')
    const savedMapping = localStorage.getItem('employmentContractFieldMapping')
    
    if (savedTemplate) {
      try {
        const templateData = JSON.parse(savedTemplate)
        setTemplateFileName(templateData.fileName || '')
        
        // Base64로 저장된 파일을 File 객체로 변환
        const savedFileBase64 = localStorage.getItem('employmentContractTemplateFile')
        if (savedFileBase64) {
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
          const file = new File([blob], templateData.fileName || 'template.docx', {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          })
          setTemplateFile(file)
        }
      } catch (e) {
        console.error('템플릿 정보 불러오기 실패:', e)
      }
    }
    
    if (savedMapping) {
      try {
        setFieldMapping(JSON.parse(savedMapping))
      } catch (e) {
        console.error('필드 매핑 정보 불러오기 실패:', e)
      }
    }
  }, [])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.docx')) {
      alert('DOCX 파일만 업로드할 수 있습니다.')
      return
    }

    // 파일 크기 체크 (5MB 제한)
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB를 초과할 수 없습니다.')
      return
    }

    // 파일을 Base64로 변환하여 로컬 스토리지에 저장
    try {
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string
          // data:application/vnd...;base64, 부분 제거
          const base64 = result.split(',')[1]
          resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const base64 = await base64Promise
      
      // 로컬 스토리지에 저장
      localStorage.setItem('employmentContractTemplateFile', base64)
      localStorage.setItem('employmentContractTemplate', JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        lastModified: new Date().toISOString()
      }))

      setTemplateFile(file)
      setTemplateFileName(file.name)
      setShowMapper(true)
    } catch (error) {
      console.error('파일 저장 중 오류:', error)
      alert('파일 저장 중 오류가 발생했습니다.')
    }
  }

  const handleMappingComplete = (mapping: Record<string, string>) => {
    setFieldMapping(mapping)
    setShowMapper(false)
    
    // 로컬 스토리지에 저장
    if (templateFile) {
      localStorage.setItem('employmentContractTemplate', JSON.stringify({
        fileName: templateFile.name,
        lastModified: new Date().toISOString()
      }))
    }
    localStorage.setItem('employmentContractFieldMapping', JSON.stringify(mapping))
    
    alert('템플릿 필드 매핑이 저장되었습니다.')
  }

  const handleRemoveTemplate = () => {
    if (confirm('템플릿 파일을 제거하시겠습니까?')) {
      setTemplateFile(null)
      setTemplateFileName('')
      setFieldMapping({})
      setShowMapper(false)
      localStorage.removeItem('employmentContractTemplate')
      localStorage.removeItem('employmentContractTemplateFile')
      localStorage.removeItem('employmentContractFieldMapping')
    }
  }

  if (showMapper && templateFile) {
    return (
      <TemplateFieldMapper
        templateFile={templateFile}
        onMappingComplete={handleMappingComplete}
        onCancel={() => {
          setShowMapper(false)
          setTemplateFile(null)
          setTemplateFileName('')
        }}
      />
    )
  }

  return (
    <div>
      {templateFileName ? (
        <div className="border border-green-300 rounded-lg p-4 bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">
                ✓ 템플릿 파일: {templateFileName}
              </p>
              {Object.keys(fieldMapping).length > 0 && (
                <p className="text-xs text-green-600 mt-1">
                  {Object.keys(fieldMapping).length}개의 필드가 매핑되었습니다.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowMapper(true)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                필드 매핑 수정
              </button>
              <button
                onClick={handleRemoveTemplate}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                제거
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <input
            type="file"
            accept=".docx"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-500 mt-2">
            템플릿 파일을 업로드하면 필드 매핑 설정 화면이 표시됩니다.
          </p>
        </div>
      )}
    </div>
  )
}

