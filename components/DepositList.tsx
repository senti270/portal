'use client'

import { useState, useEffect } from 'react'
import { Deposit } from '@/types/todo'

const ADMIN_PASSWORD = '43084308'

interface DepositListProps {
  password: string
}

export default function DepositList({ password }: DepositListProps) {
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [filteredDeposits, setFilteredDeposits] = useState<Deposit[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [filter, setFilter] = useState<'incomplete' | 'completed' | 'all'>('incomplete')
  const [searchTerm, setSearchTerm] = useState('')
  const [editingDepositId, setEditingDepositId] = useState<string | null>(null)
  const [newDeposit, setNewDeposit] = useState({
    requester: '',
    companyName: '',
    amount: '',
    bank: '',
    accountNumber: '',
    requestDate: '',
    taxInvoiceAttached: false
  })
  
  // 기존 요청자 목록 추출
  const getExistingRequesters = () => {
    const requesters = (deposits || []).map(deposit => deposit.requester)
    const uniqueRequesters = Array.from(new Set(['이진영', '유은서', ...requesters]))
    return uniqueRequesters.filter(r => r.trim() !== '')
  }

  // 입금 목록 가져오기
  const fetchDeposits = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/deposits?password=${encodeURIComponent(password)}`)
      const data = await response.json()
      
      if (data.success) {
        setDeposits(data.deposits)
        // 필터링 로직은 useEffect에서 처리됨
      } else {
        console.error('입금 목록 가져오기 실패:', data.error)
      }
    } catch (error) {
      console.error('입금 목록 가져오기 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 입금 항목 추가
  // 입금 수정 시작
  const handleEditDeposit = (deposit: Deposit) => {
    setEditingDepositId(deposit.id)
    
    // requestDate 변환 처리
    let requestDateStr = ''
    if (deposit.requestDate) {
      let dateObj: Date
      
      // Firestore Timestamp인 경우
      if (typeof deposit.requestDate === 'object' && (deposit.requestDate as any).seconds) {
        dateObj = new Date((deposit.requestDate as any).seconds * 1000)
      }
      // Date 객체인 경우
      else if (deposit.requestDate instanceof Date) {
        dateObj = deposit.requestDate
      }
      // 문자열인 경우
      else {
        dateObj = new Date(deposit.requestDate)
      }
      
      if (!isNaN(dateObj.getTime())) {
        requestDateStr = dateObj.toISOString().split('T')[0]
      }
    }
    
    setNewDeposit({
      requester: deposit.requester,
      companyName: deposit.companyName,
      amount: deposit.amount.toString(),
      bank: deposit.bank || '',
      accountNumber: deposit.accountNumber || '',
      requestDate: requestDateStr,
      taxInvoiceAttached: deposit.taxInvoiceAttached
    })
    setShowAddForm(false)
  }

  // 입금 수정
  const updateDeposit = async () => {
    if (!newDeposit.requester || !newDeposit.companyName || !newDeposit.amount) {
      alert('요청자, 업체명, 금액은 필수 입력입니다.')
      return
    }

    try {
      const response = await fetch('/api/deposits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          id: editingDepositId,
          updates: {
            requester: newDeposit.requester,
            companyName: newDeposit.companyName,
            amount: parseFloat(newDeposit.amount),
            bank: newDeposit.bank,
            accountNumber: newDeposit.accountNumber,
            requestDate: newDeposit.requestDate ? new Date(newDeposit.requestDate) : null,
            taxInvoiceAttached: newDeposit.taxInvoiceAttached
          }
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setNewDeposit({
          requester: '',
          companyName: '',
          amount: '',
          bank: '',
          accountNumber: '',
          requestDate: '',
          taxInvoiceAttached: false
        })
        setEditingDepositId(null)
        fetchDeposits()
        alert('입금 정보가 수정되었습니다!')
      } else {
        alert(`입금 수정 실패: ${data.error}`)
      }
    } catch (error) {
      console.error('입금 수정 오류:', error)
      alert('입금 수정 중 오류가 발생했습니다.')
    }
  }

  const addDeposit = async () => {
    if (!newDeposit.requester.trim() || !newDeposit.companyName.trim() || !newDeposit.amount.trim()) {
      alert('요청자, 업체명, 금액을 입력해주세요.')
      return
    }

    if (isNaN(Number(newDeposit.amount))) {
      alert('금액은 숫자로 입력해주세요.')
      return
    }

    try {
      const response = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          deposit: {
            requester: newDeposit.requester,
            companyName: newDeposit.companyName,
            amount: Number(newDeposit.amount),
            bank: newDeposit.bank,
            accountNumber: newDeposit.accountNumber,
            requestDate: newDeposit.requestDate ? new Date(newDeposit.requestDate) : null,
            taxInvoiceAttached: newDeposit.taxInvoiceAttached,
            isCompleted: false
          }
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setNewDeposit({
          requester: '',
          companyName: '',
          amount: '',
          bank: '',
          accountNumber: '',
          requestDate: '',
          taxInvoiceAttached: false
        })
        setShowAddForm(false)
        fetchDeposits() // 목록 새로고침
        alert('입금 항목이 추가되었습니다!')
      } else {
        alert('입금 항목 추가 실패: ' + data.error)
      }
    } catch (error) {
      console.error('입금 항목 추가 오류:', error)
      alert('입금 항목 추가 중 오류가 발생했습니다.')
    }
  }

  // 입금 완료 상태 변경
  const toggleComplete = async (id: string, isCompleted: boolean) => {
    try {
      const response = await fetch('/api/deposits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          id,
          updates: { isCompleted }
        })
      })

      const data = await response.json()
      
      if (data.success) {
        fetchDeposits() // 목록 새로고침
      } else {
        alert('상태 변경 실패: ' + data.error)
      }
    } catch (error) {
      console.error('상태 변경 오류:', error)
      alert('상태 변경 중 오류가 발생했습니다.')
    }
  }

  // 세금계산서 첨부 상태 변경
  const toggleTaxInvoice = async (id: string, taxInvoiceAttached: boolean) => {
    try {
      const response = await fetch('/api/deposits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          id,
          updates: { taxInvoiceAttached }
        })
      })

      const data = await response.json()
      
      if (data.success) {
        fetchDeposits() // 목록 새로고침
      } else {
        alert('세금계산서 상태 변경 실패: ' + data.error)
      }
    } catch (error) {
      console.error('세금계산서 상태 변경 오류:', error)
      alert('세금계산서 상태 변경 중 오류가 발생했습니다.')
    }
  }

  // 입금 항목 삭제
  const deleteDeposit = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const response = await fetch('/api/deposits', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, id })
      })

      const data = await response.json()
      
      if (data.success) {
        fetchDeposits() // 목록 새로고침
        alert('입금 항목이 삭제되었습니다!')
      } else {
        alert('삭제 실패: ' + data.error)
      }
    } catch (error) {
      console.error('삭제 오류:', error)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  // 로그인 상태 확인 및 유지
  useEffect(() => {
    const savedAuth = localStorage.getItem('deposit-list-auth')
    const savedPassword = localStorage.getItem('deposit-list-password')
    
    if (savedAuth === 'true' && savedPassword === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      fetchDeposits()
    } else if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      localStorage.setItem('deposit-list-auth', 'true')
      localStorage.setItem('deposit-list-password', ADMIN_PASSWORD)
      fetchDeposits()
    } else {
      setIsAuthenticated(false)
      localStorage.removeItem('deposit-list-auth')
      localStorage.removeItem('deposit-list-password')
    }
  }, [password])

  // 로그아웃 함수
  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('deposit-list-auth')
    localStorage.removeItem('deposit-list-password')
    setDeposits([])
    setFilteredDeposits([])
    setShowAddForm(false)
    setEditingDepositId(null)
    setFilter('incomplete')
    setSearchTerm('')
  }

  // 입금 필터링 및 검색
  useEffect(() => {
    let filtered = deposits

    // 완료 상태 필터링
    if (filter === 'incomplete') {
      filtered = filtered.filter(deposit => !deposit.isCompleted)
    } else if (filter === 'completed') {
      filtered = filtered.filter(deposit => deposit.isCompleted)
    }

    // 검색어 필터링
    if (searchTerm.trim()) {
      filtered = filtered.filter(deposit => 
        deposit.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deposit.requester.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredDeposits(filtered)
  }, [deposits, filter, searchTerm])

  const formatDate = (date: any) => {
    if (!date) return '미설정'
    
    try {
      let dateObj: Date
      
      // Date 객체인 경우
      if (date instanceof Date) {
        dateObj = date
      }
      // Firestore Timestamp인 경우
      else if (date && typeof date === 'object' && date.seconds) {
        dateObj = new Date(date.seconds * 1000)
      }
      // 문자열인 경우
      else if (typeof date === 'string') {
        dateObj = new Date(date)
      }
      // 숫자인 경우
      else if (typeof date === 'number') {
        dateObj = new Date(date)
      }
      else {
        return '미설정'
      }
      
      if (isNaN(dateObj.getTime())) {
        return '미설정'
      }
      
      return dateObj.toLocaleDateString('ko-KR')
    } catch (error) {
      console.error('날짜 포맷 오류:', error, date)
      return '미설정'
    }
  }

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ko-KR') + '원'
  }

  const getRequestDateStatus = (requestDate: Date | null) => {
    if (!requestDate) return ''
    const today = new Date()
    const request = new Date(requestDate)
    const diffTime = request.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return 'text-red-600 dark:text-red-400' // 지난 날짜
    if (diffDays <= 1) return 'text-orange-600 dark:text-orange-400' // 오늘/내일
    return 'text-green-600 dark:text-green-400' // 여유 있음
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-300">로딩 중...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            입금 리스트
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filteredDeposits.length}건 / 전체 {deposits.length}건
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-5 py-2.5 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-medium"
          >
            {showAddForm ? '취소' : '+ 입금 추가'}
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* 필터 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('incomplete')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              filter === 'incomplete'
                ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            미완료 ({deposits.filter(d => !d.isCompleted).length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              filter === 'completed'
                ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            완료 ({deposits.filter(d => d.isCompleted).length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              filter === 'all'
                ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            전체 ({deposits.length})
          </button>
        </div>

        {/* 검색 */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="업체명 또는 요청자로 검색..."
            className="w-full px-4 py-2 pl-10 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 입금 추가 폼 */}
      {showAddForm && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                요청자 *
              </label>
              <input
                type="text"
                list="deposit-requester-options"
                value={newDeposit.requester}
                onChange={(e) => setNewDeposit({ ...newDeposit, requester: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                placeholder="요청자명을 입력하세요"
              />
              <datalist id="deposit-requester-options">
                {getExistingRequesters().map((requester, index) => (
                  <option key={index} value={requester} />
                ))}
              </datalist>
              
              {/* 미리 설정된 요청자 버튼들 */}
              <div className="flex flex-wrap gap-2 mt-3">
                {['이진영', '유은서'].map((requester) => (
                  <button
                    key={requester}
                    type="button"
                    onClick={() => setNewDeposit({ ...newDeposit, requester })}
                    className="px-4 py-2 text-sm bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg hover:from-gray-900 hover:to-black transition-all duration-200 shadow-sm"
                  >
                    {requester}
                  </button>
                ))}
                {getExistingRequesters()
                  .filter(req => !['이진영', '유은서'].includes(req))
                  .slice(0, 2)
                  .map((requester) => (
                    <button
                      key={requester}
                      type="button"
                      onClick={() => setNewDeposit({ ...newDeposit, requester })}
                      className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
                    >
                      {requester}
                    </button>
                  ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                업체명 *
              </label>
              <input
                type="text"
                value={newDeposit.companyName}
                onChange={(e) => setNewDeposit({ ...newDeposit, companyName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                placeholder="업체명을 입력하세요"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                금액 * (숫자만)
              </label>
              <input
                type="number"
                value={newDeposit.amount}
                onChange={(e) => setNewDeposit({ ...newDeposit, amount: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                placeholder="금액을 입력하세요"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                은행
              </label>
              <input
                type="text"
                value={newDeposit.bank}
                onChange={(e) => setNewDeposit({ ...newDeposit, bank: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                placeholder="은행명을 입력하세요"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                계좌번호
              </label>
              <input
                type="text"
                value={newDeposit.accountNumber}
                onChange={(e) => setNewDeposit({ ...newDeposit, accountNumber: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                placeholder="계좌번호를 입력하세요"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                입금요청일 (선택사항)
              </label>
              <input
                type="date"
                value={newDeposit.requestDate}
                onChange={(e) => setNewDeposit({ ...newDeposit, requestDate: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
              />
            </div>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="taxInvoice"
              checked={newDeposit.taxInvoiceAttached}
              onChange={(e) => setNewDeposit({ ...newDeposit, taxInvoiceAttached: e.target.checked })}
              className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 dark:focus:ring-green-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="taxInvoice" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              세금계산서 첨부됨
            </label>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={addDeposit}
              className="px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white rounded-md shadow-md hover:shadow-lg transition-all duration-200 text-sm font-medium"
            >
              추가
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 transition-all duration-200 text-sm font-medium"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 입금 목록 */}
      <div className="space-y-3">
        {filteredDeposits.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {searchTerm || filter !== 'all' ? '검색 결과가 없습니다.' : '등록된 입금 항목이 없습니다.'}
          </div>
        ) : (
          filteredDeposits.map((deposit) => (
            <div key={deposit.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={deposit.isCompleted}
                    onChange={(e) => toggleComplete(deposit.id, e.target.checked)}
                    className="mt-1.5 w-5 h-5 text-gray-800 bg-gray-100 border-gray-300 rounded focus:ring-gray-500 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                  />
                  
                  <div className="flex-1">
                    <p className={`text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 ${
                      deposit.isCompleted ? 'line-through opacity-60' : ''
                    }`}>
                      {deposit.companyName}
                      <span className="text-xl font-bold text-gray-800 dark:text-gray-200 ml-3">
                        {formatAmount(deposit.amount)}
                      </span>
                    </p>
                    
                    {deposit.bank && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {deposit.bank} {deposit.accountNumber}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>요청자: {deposit.requester}</span>
                      <span className={`${getRequestDateStatus(deposit.requestDate)}`}>
                        요청일: {formatDate(deposit.requestDate)}
                      </span>
                      <span>
                        등록: {new Date(deposit.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                      {deposit.taxInvoiceAttached && (
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                          계산서 첨부
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditDeposit(deposit)}
                      className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
                      title="수정"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteDeposit(deposit.id)}
                      className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                      title="삭제"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* 인라인 수정 폼 */}
              {editingDepositId === deposit.id && (
                <div className="px-5 pb-5">
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">입금 정보 수정</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          요청자 *
                        </label>
                        <input
                          type="text"
                          list="edit-requester-options"
                          value={newDeposit.requester}
                          onChange={(e) => setNewDeposit({ ...newDeposit, requester: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                          placeholder="요청자명을 입력하세요"
                        />
                        <datalist id="edit-requester-options">
                          {getExistingRequesters().map((requester, index) => (
                            <option key={index} value={requester} />
                          ))}
                        </datalist>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          업체명 *
                        </label>
                        <input
                          type="text"
                          value={newDeposit.companyName}
                          onChange={(e) => setNewDeposit({ ...newDeposit, companyName: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                          placeholder="업체명을 입력하세요"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          금액 * (숫자만)
                        </label>
                        <input
                          type="number"
                          value={newDeposit.amount}
                          onChange={(e) => setNewDeposit({ ...newDeposit, amount: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                          placeholder="금액을 입력하세요"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          은행
                        </label>
                        <input
                          type="text"
                          value={newDeposit.bank}
                          onChange={(e) => setNewDeposit({ ...newDeposit, bank: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                          placeholder="은행명을 입력하세요"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          계좌번호
                        </label>
                        <input
                          type="text"
                          value={newDeposit.accountNumber}
                          onChange={(e) => setNewDeposit({ ...newDeposit, accountNumber: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                          placeholder="계좌번호를 입력하세요"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          입금 요청일
                        </label>
                        <input
                          type="date"
                          value={newDeposit.requestDate}
                          onChange={(e) => setNewDeposit({ ...newDeposit, requestDate: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center mb-3">
                      <input
                        type="checkbox"
                        id="editTaxInvoice"
                        checked={newDeposit.taxInvoiceAttached}
                        onChange={(e) => setNewDeposit({ ...newDeposit, taxInvoiceAttached: e.target.checked })}
                        className="w-4 h-4 text-gray-600 bg-gray-100 border-gray-300 rounded focus:ring-gray-500 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <label htmlFor="editTaxInvoice" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        세금계산서 첨부됨
                      </label>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={updateDeposit}
                        className="px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white rounded-md shadow-md hover:shadow-lg transition-all duration-200 text-sm font-medium"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => {
                          setEditingDepositId(null)
                          setNewDeposit({
                            requester: '',
                            companyName: '',
                            amount: '',
                            bank: '',
                            accountNumber: '',
                            requestDate: '',
                            taxInvoiceAttached: false
                          })
                        }}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 transition-all duration-200 text-sm font-medium"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
