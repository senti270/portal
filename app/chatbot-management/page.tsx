'use client'

import { useEffect, useMemo, useState } from 'react'

interface ChatMessage {
  id: string
  role: 'user' | 'bot'
  content: string
  createdAt: string
}

interface IntentItem {
  id: string
  keywords: string[]
  matchType: 'exact' | 'includes' | 'regex'
  action: 'open_menu' | 'search_manuals' | 'call_api' | 'help'
  responseTemplate?: string
  variables?: Record<string, string>
  priority: number
  minRole: 'staff' | 'manager' | 'admin'
  enabled: boolean
}

const ADMIN_PASSWORD = '43084308'

export default function ChatbotManagementPage() {
  const [tab, setTab] = useState<'history' | 'intents'>('history')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [intents, setIntents] = useState<IntentItem[]>([])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/chatbot/logs?password=${ADMIN_PASSWORD}&limit=100`)
      const data = await res.json()
      if (data.success) {
        setMessages(data.messages)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadIntents = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/chatbot/intents?password=${ADMIN_PASSWORD}`)
      const data = await res.json()
      if (data.success) {
        setIntents(data.items)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'history') loadHistory()
    if (tab === 'intents') loadIntents()
  }, [tab])

  const handleCreateIntent = async () => {
    const payload = {
      password: ADMIN_PASSWORD,
      data: {
        keywords: ['네이버환불', '네이버 환불'],
        matchType: 'includes',
        action: 'open_menu',
        responseTemplate: '네이버 환불 요청은 아래 메뉴에서 진행해 주세요.\n• 메뉴: {menu}\n• 바로가기: {link}',
        variables: { menu: '네이버 환불 요청', link: '/naver-refund' },
        priority: 90,
        minRole: 'staff',
        enabled: true
      }
    }
    await fetch('/api/chatbot/intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    loadIntents()
  }

  const toggleIntentEnabled = async (id: string, enabled: boolean) => {
    await fetch(`/api/chatbot/intents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ADMIN_PASSWORD, data: { enabled } })
    })
    loadIntents()
  }

  const deleteIntent = async (id: string) => {
    await fetch(`/api/chatbot/intents/${id}?password=${ADMIN_PASSWORD}`, { method: 'DELETE' })
    loadIntents()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">챗봇 관리</h1>
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('history')} className={`px-3 py-2 rounded ${tab==='history'?'bg-blue-600 text-white':'bg-gray-200'}`}>히스토리</button>
        <button onClick={() => setTab('intents')} className={`px-3 py-2 rounded ${tab==='intents'?'bg-blue-600 text-white':'bg-gray-200'}`}>의도-액션 사전</button>
      </div>

      {tab === 'history' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          {loading ? (
            <p>로딩 중…</p>
          ) : (
            <div className="space-y-2">
              {messages.map(m => (
                <div key={m.id} className="border p-3 rounded">
                  <div className="text-xs text-gray-500">{m.role} • {new Date(m.createdAt).toLocaleString('ko-KR')}</div>
                  <div className="mt-1 whitespace-pre-wrap">{m.content}</div>
                </div>
              ))}
              {messages.length === 0 && <p className="text-gray-500">기록이 없습니다.</p>}
            </div>
          )}
        </div>
      )}

      {tab === 'intents' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="mb-4 flex gap-2">
            <button onClick={handleCreateIntent} className="px-3 py-2 bg-blue-600 text-white rounded">샘플 의도 추가</button>
            <button onClick={loadIntents} className="px-3 py-2 bg-gray-200 rounded">새로고침</button>
          </div>
          {loading ? (
            <p>로딩 중…</p>
          ) : (
            <div className="space-y-3">
              {intents.map(it => (
                <div key={it.id} className="border p-3 rounded">
                  <div className="flex justify-between items-center">
                    <div className="font-semibold">[{it.priority}] {it.keywords.join(', ')}</div>
                    <div className="flex gap-2">
                      <button onClick={() => toggleIntentEnabled(it.id, !it.enabled)} className="px-2 py-1 text-sm bg-gray-200 rounded">
                        {it.enabled ? '비활성화' : '활성화'}
                      </button>
                      <button onClick={() => deleteIntent(it.id)} className="px-2 py-1 text-sm bg-red-600 text-white rounded">삭제</button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">match: {it.matchType}, action: {it.action}, role: {it.minRole}</div>
                  {it.responseTemplate && (
                    <div className="mt-2 text-sm whitespace-pre-wrap">{it.responseTemplate}</div>
                  )}
                  {it.variables && Object.keys(it.variables).length > 0 && (
                    <div className="mt-2 text-xs text-gray-600">vars: {Object.entries(it.variables).map(([k,v])=>`${k}=${v}`).join(', ')}</div>
                  )}
                </div>
              ))}
              {intents.length === 0 && <p className="text-gray-500">등록된 의도가 없습니다.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


