'use client'

import { useState, useRef, useEffect } from 'react'
import { linkifyUrls, sanitizeHtmlContent } from '@/lib/url-linkify'

interface Message {
  id: string
  type: 'user' | 'bot'
  content: string
  timestamp: Date
}

interface ChatBotProps {
  isOpen: boolean
  onToggle: () => void
}

export default function ChatBot({ isOpen, onToggle }: ChatBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: '안녕하세요! 포털 챗봇입니다. 무엇을 도와드릴까요? 😊',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 마지막 대화목록 로드 (로컬 스토리지)
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('portal-chatbot-messages') : null
      if (saved) {
        const parsed = JSON.parse(saved) as Array<Omit<Message, 'timestamp'> & { timestamp: string }>
        const restored = parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) })) as Message[]
        if (Array.isArray(restored) && restored.length > 0) {
          setMessages(restored)
        }
      }
    } catch {}
  }, [])

  // 대화목록 저장 (로컬 스토리지)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('portal-chatbot-messages', JSON.stringify(messages))
      }
    } catch {}
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const addMessage = (type: 'user' | 'bot', content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newMessage])
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage = inputValue.trim()
    setInputValue('')
    addMessage('user', userMessage)
    setIsLoading(true)

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          password: '43084308' // 관리자 비밀번호
        })
      })

      const data = await response.json()
      
      if (data.success) {
        addMessage('bot', data.response)
      } else {
        addMessage('bot', `죄송합니다. 오류가 발생했습니다: ${data.error}`)
      }
    } catch (error) {
      console.error('챗봇 오류:', error)
      addMessage('bot', '죄송합니다. 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const renderMessageHtml = (text: string) => {
    // 1) 외부 URL 링크화
    let html = linkifyUrls(text)
    // 2) 내부 경로(/manual-viewer?... 등)도 링크화
    html = html.replace(/(^|\s)(\/manual-viewer\?[^\s]+)/g, (_m, prefix, path) => {
      const href = path
      return `${prefix}<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline">${path}</a>`
    })
    return { __html: sanitizeHtmlContent(html) }
  }

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[1000] bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
        aria-label="챗봇 열기"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <span className="text-xl">🤖</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[1000] w-[92vw] max-w-sm sm:w-96 h-[70vh] sm:h-[500px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-blue-600 text-white rounded-t-lg">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🤖</span>
          <span className="font-semibold">포털 챗봇</span>
        </div>
        <button
          onClick={onToggle}
          className="text-white hover:text-gray-200 transition-colors text-xl"
          aria-label="챗봇 닫기"
        >
          ✕
        </button>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`flex max-w-[80%] ${
                message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
              } items-end space-x-2`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                {message.type === 'user' ? (
                  <span className="text-sm">👤</span>
                ) : (
                  <span className="text-sm">🤖</span>
                )}
              </div>
              <div
                className={`px-4 py-2 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}
              >
                {message.type === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <div className="text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={renderMessageHtml(message.content)} />
                )}
                <p className="text-xs mt-1 opacity-70">
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-end space-x-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                <span className="text-sm">🤖</span>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg">
                <div className="flex items-center space-x-1">
                  <span className="animate-spin">⏳</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">답변 중...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="메시지를 입력하세요..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center justify-center"
          >
            <span>📤</span>
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          💡 "주차", "아몬드", "네이버환불" 등으로 질문해보세요!
        </p>
      </div>
    </div>
  )
}