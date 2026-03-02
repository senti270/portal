'use client'

import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import PortalAuth from '@/components/PortalAuth'
import ContractForm from '@/components/EmploymentContract/ContractForm'
import TemplateFileUploader from '@/components/EmploymentContract/TemplateFileUploader'

interface Branch {
  id: string
  name: string
  companyName?: string
  ceoName?: string
  businessNumber?: string
  address?: string
  phone?: string
}

export default function EmploymentContractPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBranches()
  }, [])

  const loadBranches = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'branches'))
      const branchesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Branch[]
      setBranches(branchesData.sort((a, b) => a.name.localeCompare(b.name, 'ko')))
    } catch (error) {
      console.error('지점 목록을 불러올 수 없습니다:', error)
      alert('지점 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PortalAuth>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              근로계약서 작성
            </h1>
            <p className="text-gray-600">
              지점을 선택한 후 근로계약서를 작성하세요.
            </p>
          </div>

          {loading ? (
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">지점 목록을 불러오는 중...</p>
            </div>
          ) : (
            <>
              {/* 지점 선택 */}
              <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  지점 선택 *
                </label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">지점을 선택하세요</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 템플릿 파일 업로드 (선택사항) */}
              <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  DOCX 템플릿 파일 설정 (선택사항)
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  근로계약서 DOCX 템플릿 파일을 업로드하면, 템플릿의 필드에 데이터를 자동으로 채워넣습니다.
                  <br />
                  템플릿 파일에는 {'{필드명}'} 형식으로 변수를 사용하세요. (예: {'{employeeName}'}, {'{startDate}'})
                </p>
                <TemplateFileUploader />
              </div>

              {/* 계약서 작성 폼 */}
              {selectedBranchId ? (
                <ContractForm
                  branchId={selectedBranchId}
                  branch={branches.find(b => b.id === selectedBranchId)!}
                />
              ) : (
                <div className="bg-white rounded-lg shadow-lg p-8 text-center text-gray-500">
                  지점을 선택하면 근로계약서 작성 폼이 표시됩니다.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PortalAuth>
  )
}

