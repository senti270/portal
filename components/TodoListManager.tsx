'use client'

import { useState } from 'react'
import TodoList from './TodoList'
import DepositList from './DepositList'

const ADMIN_PASSWORD = '43084308'

export default function TodoListManager() {
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeTab, setActiveTab] = useState<'todo' | 'deposit'>('todo')

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
    } else {
      alert('비밀번호가 틀렸습니다.')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setPassword('')
    setActiveTab('todo')
  }

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
          onChange={(e) => setPassword(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleLogin()
            }
          }}
        />
        <button
          onClick={handleLogin}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          로그인
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          통합 업무 관리 시스템
        </h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          로그아웃
        </button>
      </div>

      {/* 탭 메뉴 */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          className={`py-2 px-4 text-sm font-medium ${
            activeTab === 'todo'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('todo')}
        >
          📝 할 일
        </button>
        <button
          className={`py-2 px-4 text-sm font-medium ${
            activeTab === 'deposit'
              ? 'border-b-2 border-green-500 text-green-600 dark:text-green-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('deposit')}
        >
          💰 입금 리스트
        </button>
      </div>

      {/* 컨텐츠 */}
      {activeTab === 'todo' && (
        <TodoList password={password} />
      )}

      {activeTab === 'deposit' && (
        <DepositList password={password} />
      )}
    </div>
  )
}