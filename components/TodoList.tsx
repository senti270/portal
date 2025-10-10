'use client'

import { useState, useEffect } from 'react'
import { Todo } from '@/types/todo'

const ADMIN_PASSWORD = '43084308'

interface TodoListProps {
  password: string
}

export default function TodoList({ password }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [filteredTodos, setFilteredTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [filter, setFilter] = useState<'incomplete' | 'completed' | 'all'>('incomplete')
  const [searchTerm, setSearchTerm] = useState('')
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [newTodo, setNewTodo] = useState({
    requester: '',
    task: '',
    dueDate: ''
  })
  
  // 기존 요청자 목록 추출
  const getExistingRequesters = () => {
    const requesters = (todos || []).map(todo => todo.requester)
    const uniqueRequesters = Array.from(new Set(['이진영', '유은서', ...requesters]))
    return uniqueRequesters.filter(r => r.trim() !== '')
  }

  // 할일 목록 가져오기
  const fetchTodos = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/todos?password=${encodeURIComponent(password)}`)
      const data = await response.json()
      
      if (data.success) {
        console.log('할일 목록 가져오기 성공:', data.todos)
        console.log('첫 번째 할일 dueDate:', data.todos[0]?.dueDate)
        setTodos(data.todos)
        // 필터링 로직은 useEffect에서 처리됨
      } else {
        console.error('할일 목록 가져오기 실패:', data.error)
      }
    } catch (error) {
      console.error('할일 목록 가져오기 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 할일 추가
  const addTodo = async () => {
    if (!newTodo.requester.trim() || !newTodo.task.trim()) {
      alert('요청자와 할일을 입력해주세요.')
      return
    }

    try {
      console.log('할일 추가 데이터:', {
        requester: newTodo.requester,
        task: newTodo.task,
        dueDate: newTodo.dueDate,
        dueDateObj: newTodo.dueDate ? new Date(newTodo.dueDate) : null
      })

      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          todo: {
            requester: newTodo.requester,
            task: newTodo.task,
            dueDate: newTodo.dueDate ? new Date(newTodo.dueDate) : null,
            isCompleted: false
          }
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setNewTodo({ requester: '', task: '', dueDate: '' })
        setShowAddForm(false)
        fetchTodos() // 목록 새로고침
        alert('할일이 추가되었습니다!')
      } else {
        alert('할일 추가 실패: ' + data.error)
      }
    } catch (error) {
      console.error('할일 추가 오류:', error)
      alert('할일 추가 중 오류가 발생했습니다.')
    }
  }

  // 할일 완료 상태 변경
  const toggleComplete = async (id: string, isCompleted: boolean) => {
    try {
      const response = await fetch('/api/todos', {
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
        fetchTodos() // 목록 새로고침
      } else {
        alert('상태 변경 실패: ' + data.error)
      }
    } catch (error) {
      console.error('상태 변경 오류:', error)
      alert('상태 변경 중 오류가 발생했습니다.')
    }
  }

  // 할일 편집 시작
  const handleEditTodo = (todo: Todo) => {
    setEditingTodoId(todo.id)
    setNewTodo({
      requester: todo.requester,
      task: todo.task,
      dueDate: todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : ''
    })
  }

  // 할일 수정
  const updateTodo = async () => {
    if (!editingTodoId || !newTodo.requester.trim() || !newTodo.task.trim()) {
      alert('요청자와 할일을 입력해주세요.')
      return
    }

    try {
      console.log('할일 수정 데이터:', {
        id: editingTodoId,
        requester: newTodo.requester,
        task: newTodo.task,
        dueDate: newTodo.dueDate,
        dueDateObj: newTodo.dueDate ? new Date(newTodo.dueDate) : null
      })

      const response = await fetch('/api/todos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          id: editingTodoId,
          updates: {
            requester: newTodo.requester,
            task: newTodo.task,
            dueDate: newTodo.dueDate ? new Date(newTodo.dueDate) : null,
            isCompleted: todos.find(t => t.id === editingTodoId)?.isCompleted || false // 완료 상태는 유지
          }
        })
      })

      const data = await response.json()
      
      if (data.success) {
        console.log('할일 수정 성공, 목록 새로고침 중...')
        setNewTodo({ requester: '', task: '', dueDate: '' })
        setEditingTodoId(null)
        await fetchTodos() // 목록 새로고침
        alert('할일이 수정되었습니다!')
      } else {
        alert('할일 수정 실패: ' + data.error)
      }
    } catch (error) {
      console.error('할일 수정 오류:', error)
      alert('할일 수정 중 오류가 발생했습니다.')
    }
  }

  // 할일 삭제
  const deleteTodo = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const response = await fetch('/api/todos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, id })
      })

      const data = await response.json()
      
      if (data.success) {
        fetchTodos() // 목록 새로고침
        alert('할일이 삭제되었습니다!')
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
    // 페이지 로드 시 저장된 로그인 상태 확인
    const savedAuth = localStorage.getItem('todo-list-auth')
    const savedPassword = localStorage.getItem('todo-list-password')
    
    if (savedAuth === 'true' && savedPassword === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      fetchTodos()
    } else if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      localStorage.setItem('todo-list-auth', 'true')
      localStorage.setItem('todo-list-password', ADMIN_PASSWORD)
      fetchTodos()
    } else {
      setIsAuthenticated(false)
      localStorage.removeItem('todo-list-auth')
      localStorage.removeItem('todo-list-password')
    }
  }, [password])

  // 로그아웃 함수
  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('todo-list-auth')
    localStorage.removeItem('todo-list-password')
    setTodos([])
    setFilteredTodos([])
    setShowAddForm(false)
    setEditingTodoId(null)
    setFilter('incomplete')
    setSearchTerm('')
  }

  // 편집 모드일 때 기존 데이터를 폼에 채우기
  useEffect(() => {
    if (editingTodoId) {
      const todo = todos.find(t => t.id === editingTodoId)
      if (todo) {
        setNewTodo({
          requester: todo.requester,
          task: todo.task,
          dueDate: todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : ''
        })
      }
    } else {
      setNewTodo({ requester: '', task: '', dueDate: '' })
    }
  }, [editingTodoId, todos])

  // 할일 필터링 및 검색
  useEffect(() => {
    let filtered = todos

    // 완료 상태 필터링
    if (filter === 'incomplete') {
      filtered = filtered.filter(todo => !todo.isCompleted)
    } else if (filter === 'completed') {
      filtered = filtered.filter(todo => todo.isCompleted)
    }

    // 검색어 필터링
    if (searchTerm.trim()) {
      filtered = filtered.filter(todo => 
        todo.task.toLowerCase().includes(searchTerm.toLowerCase()) ||
        todo.requester.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredTodos(filtered)
  }, [todos, filter, searchTerm])

  const formatDate = (date: any) => {
    if (!date) return '미설정'
    
    try {
      let dateObj: Date
      
      // Date 객체인 경우
      if (date instanceof Date) {
        dateObj = date
      }
      // Firestore Timestamp인 경우 (seconds와 nanoseconds 속성이 있는 객체)
      else if (date && typeof date === 'object' && date.seconds) {
        dateObj = new Date(date.seconds * 1000)
      }
      // 문자열인 경우
      else if (typeof date === 'string') {
        dateObj = new Date(date)
      }
      // 숫자(타임스탬프)인 경우
      else if (typeof date === 'number') {
        dateObj = new Date(date)
      }
      else {
        console.log('알 수 없는 날짜 형태:', date)
        return '미설정'
      }
      
      // 유효한 날짜인지 확인
      if (isNaN(dateObj.getTime())) {
        console.log('유효하지 않은 날짜:', date)
        return '미설정'
      }
      
      return dateObj.toLocaleDateString('ko-KR')
    } catch (error) {
      console.error('날짜 포맷 오류:', error, date)
      return '미설정'
    }
  }

  const getDueDateStatus = (dueDate: any) => {
    if (!dueDate) return ''
    
    try {
      let dateObj: Date
      
      // Date 객체인 경우
      if (dueDate instanceof Date) {
        dateObj = dueDate
      }
      // Firestore Timestamp인 경우
      else if (dueDate && typeof dueDate === 'object' && dueDate.seconds) {
        dateObj = new Date(dueDate.seconds * 1000)
      }
      // 문자열인 경우
      else if (typeof dueDate === 'string') {
        dateObj = new Date(dueDate)
      }
      // 숫자(타임스탬프)인 경우
      else if (typeof dueDate === 'number') {
        dateObj = new Date(dueDate)
      }
      else {
        return ''
      }
      
      // 유효한 날짜인지 확인
      if (isNaN(dateObj.getTime())) {
        return ''
      }
      
      const today = new Date()
      const diffTime = dateObj.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays < 0) return 'text-red-600 dark:text-red-400' // 지난 날짜
      if (diffDays <= 1) return 'text-orange-600 dark:text-orange-400' // 오늘/내일
      return 'text-green-600 dark:text-green-400' // 여유 있음
    } catch (error) {
      console.error('날짜 상태 계산 오류:', error, dueDate)
      return ''
    }
  }

  // 인증되지 않은 경우 로그인 폼 표시
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          TO DO LIST 시스템
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          접근하려면 비밀번호를 입력하세요.
        </p>
        <input
          type="password"
          className="w-full max-w-xs px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white mb-4"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => {
            // 부모 컴포넌트에서 password를 관리하므로 여기서는 읽기만
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              // Enter 키는 부모 컴포넌트에서 처리
            }
          }}
          disabled
        />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          비밀번호: 43084308
        </p>
      </div>
    )
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
    <div className="space-y-4 md:space-y-6 p-3 md:p-0">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1">
            할 일 관리
          </h2>
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
            {filteredTodos.length}개 표시 중 / 전체 {todos.length}개
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-full sm:w-auto px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-medium text-sm md:text-base"
        >
          {showAddForm ? '취소' : '+ 할일 추가'}
        </button>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3 md:space-y-4">
        {/* 필터 버튼 */}
        <div className="flex flex-wrap gap-2 md:gap-3">
          <button
            onClick={() => setFilter('incomplete')}
            className={`flex-1 min-w-[80px] px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 ${
              filter === 'incomplete'
                ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            미완료 ({todos.filter(t => !t.isCompleted).length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`flex-1 min-w-[80px] px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 ${
              filter === 'completed'
                ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            완료 ({todos.filter(t => t.isCompleted).length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 min-w-[80px] px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 ${
              filter === 'all'
                ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            전체 ({todos.length})
          </button>
        </div>

        {/* 검색 */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 md:px-4 py-2.5 md:py-3 pl-10 md:pl-12 text-sm md:text-base border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
            placeholder="할일 내용이나 요청자로 검색..."
          />
          <div className="absolute inset-y-0 left-0 pl-3 md:pl-4 flex items-center pointer-events-none">
            <svg className="h-4 w-4 md:h-5 md:w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 md:pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 할일 추가/편집 폼 */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3 md:space-y-4">
          <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-3 md:mb-4">
            {editingTodoId ? '할일 수정' : '할일 추가'}
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              요청자 *
            </label>
            <input
              type="text"
              list="requester-options"
              value={newTodo.requester}
              onChange={(e) => setNewTodo({ ...newTodo, requester: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
              placeholder="요청자명을 입력하세요"
            />
            <datalist id="requester-options">
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
                  onClick={() => setNewTodo({ ...newTodo, requester })}
                  className="px-4 py-2 text-sm bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg hover:from-gray-900 hover:to-black transition-all duration-200 shadow-sm"
                >
                  {requester}
                </button>
              ))}
              {getExistingRequesters()
                .filter(req => !['이진영', '유은서'].includes(req))
                .slice(0, 2) // 기존 요청자 중 최대 2개만 표시
                .map((requester) => (
                  <button
                    key={requester}
                    type="button"
                    onClick={() => setNewTodo({ ...newTodo, requester })}
                    className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
                  >
                    {requester}
                  </button>
                ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              할일
            </label>
            <textarea
              value={newTodo.task}
              onChange={(e) => setNewTodo({ ...newTodo, task: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200 resize-none"
              placeholder="할일을 입력하세요"
              rows={3}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              마감일 (선택사항)
            </label>
            <input
              type="date"
              value={newTodo.dueDate}
              onChange={(e) => setNewTodo({ ...newTodo, dueDate: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={editingTodoId ? updateTodo : addTodo}
              className="px-6 py-3 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
            >
              {editingTodoId ? '수정' : '추가'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setEditingTodoId(null)
                setNewTodo({ requester: '', task: '', dueDate: '' })
              }}
              className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 할일 목록 */}
      <div className="space-y-2">
        {filteredTodos.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {todos.length === 0 ? '등록된 할일이 없습니다.' : '검색 결과가 없습니다.'}
          </div>
        ) : (
          filteredTodos.map((todo) => (
            <div
              key={todo.id}
              className={`bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm border transition-all duration-200 ${
                todo.isCompleted 
                  ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50' 
                  : 'border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2 md:gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={todo.isCompleted}
                    onChange={(e) => toggleComplete(todo.id, e.target.checked)}
                    className="mt-0.5 md:mt-1 w-4 h-4 md:w-5 md:h-5 text-gray-800 bg-gray-100 border-gray-300 rounded-lg focus:ring-gray-400 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-800"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <p className={`text-gray-800 dark:text-gray-200 text-sm md:text-lg break-words ${
                      todo.isCompleted ? 'line-through opacity-60' : ''
                    }`}>
                      {todo.task}
                    </p>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-2 text-xs md:text-sm text-gray-500 dark:text-gray-400">
                      <span className="truncate">요청자: {todo.requester}</span>
                      <span className={`truncate ${getDueDateStatus(todo.dueDate)}`}>
                        마감: {formatDate(todo.dueDate)}
                      </span>
                      <span className="truncate">
                        작성: {new Date(todo.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-0.5 md:gap-1 ml-2">
                  <button
                    onClick={() => handleEditTodo(todo)}
                    className="p-1.5 md:p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
                    title="수정"
                  >
                    <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="p-1.5 md:p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                    title="삭제"
                  >
                    <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* 인라인 편집 폼 */}
              {editingTodoId === todo.id && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">할일 수정</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        요청자 *
                      </label>
                      <input
                        type="text"
                        list="inline-requester-options"
                        value={newTodo.requester}
                        onChange={(e) => setNewTodo({ ...newTodo, requester: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-600 dark:text-white transition-all duration-200"
                        placeholder="요청자명을 입력하세요"
                      />
                      <datalist id="inline-requester-options">
                        {getExistingRequesters().map((requester, index) => (
                          <option key={index} value={requester} />
                        ))}
                      </datalist>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        할일 *
                      </label>
                      <textarea
                        value={newTodo.task}
                        onChange={(e) => setNewTodo({ ...newTodo, task: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-600 dark:text-white transition-all duration-200 resize-none"
                        placeholder="할일을 입력하세요"
                        rows={2}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        마감일 (선택사항)
                      </label>
                      <input
                        type="date"
                        value={newTodo.dueDate}
                        onChange={(e) => setNewTodo({ ...newTodo, dueDate: e.target.value })}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-600 dark:text-white transition-all duration-200"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={updateTodo}
                        className="px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white rounded-md shadow-md hover:shadow-lg transition-all duration-200 text-sm font-medium"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => {
                          setEditingTodoId(null)
                          setNewTodo({ requester: '', task: '', dueDate: '' })
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
