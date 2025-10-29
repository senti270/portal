'use client'

import { useState } from 'react'
import { useAdmin } from '@/contexts/AdminContext'

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const { login } = useAdmin()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (login(password)) {
      setShowModal(false)
      setPassword('')
      setError('')
    } else {
      setError('비밀번호가 올바르지 않습니다.')
    }
  }

  return (
    <>
      {/* 로그인 버튼 */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-32 left-6 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-300 z-50"
      >
        관리자 로그인
      </button>

      {/* 로그인 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-hidden">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-96 max-w-[90vw]">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              관리자 로그인
            </h2>
            <form onSubmit={handleSubmit}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                autoFocus
              />
              {error && (
                <p className="text-red-500 text-sm mb-4">{error}</p>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  로그인
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setPassword('')
                    setError('')
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg transition-colors"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
