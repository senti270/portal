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
  const [editing, setEditing] = useState<IntentItem | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({
    keywords: '',
    matchType: 'includes' as IntentItem['matchType'],
    action: 'open_menu' as IntentItem['action'],
    responseTemplate: '',
    variablesText: '',
    priority: 50,
    minRole: 'staff' as IntentItem['minRole'],
    enabled: true,
  })

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

  const openCreateForm = () => {
    setEditing(null)
    setForm({
      keywords: '',
      matchType: 'includes',
      action: 'open_menu',
      responseTemplate: '',
      variablesText: '',
      priority: 50,
      minRole: 'staff',
      enabled: true,
    })
    setFormOpen(true)
  }

  const openEditForm = (item: IntentItem) => {
    setEditing(item)
    setForm({
      keywords: (item.keywords || []).join(', '),
      matchType: item.matchType,
      action: item.action,
      responseTemplate: item.responseTemplate || '',
      variablesText: item.variables ? JSON.stringify(item.variables, null, 2) : '',
      priority: item.priority,
      minRole: item.minRole,
      enabled: item.enabled,
    })
    setFormOpen(true)
  }

  const saveForm = async () => {
    const payload = {
      keywords: form.keywords.split(',').map(s => s.trim()).filter(Boolean),
      matchType: form.matchType,
      action: form.action,
      responseTemplate: form.responseTemplate,
      variables: (() => { try { return form.variablesText ? JSON.parse(form.variablesText) : {} } catch { return {} } })(),
      priority: Number(form.priority) || 0,
      minRole: form.minRole,
      enabled: form.enabled,
    }

    if (editing) {
      await fetch(`/api/chatbot/intents/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: ADMIN_PASSWORD, data: payload })
      })
    } else {
      await fetch('/api/chatbot/intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: ADMIN_PASSWORD, data: payload })
      })
    }
    setFormOpen(false)
    setEditing(null)
    await loadIntents()
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
            <button onClick={handleCreateIntent} className="px-3 py-2 bg-gray-200 rounded">샘플 의도 추가</button>
            <button onClick={openCreateForm} className="px-3 py-2 bg-blue-600 text-white rounded">의도 추가</button>
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
                      <button onClick={() => openEditForm(it)} className="px-2 py-1 text-sm bg-blue-600 text-white rounded">편집</button>
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

          {formOpen && (
            <div className="mt-6 border rounded p-4 space-y-3">
              <div className="font-semibold mb-2">{editing ? '의도 수정' : '의도 추가'}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">키워드(콤마로 구분)</label>
                  <input value={form.keywords} onChange={e=>setForm(f=>({...f, keywords:e.target.value}))} className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="text-sm text-gray-600">매치 방식</label>
                  <select value={form.matchType} onChange={e=>setForm(f=>({...f, matchType:e.target.value as any}))} className="w-full px-3 py-2 border rounded">
                    <option value="exact">exact</option>
                    <option value="includes">includes</option>
                    <option value="regex">regex</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600">액션</label>
                  <select value={form.action} onChange={e=>setForm(f=>({...f, action:e.target.value as any}))} className="w-full px-3 py-2 border rounded">
                    <option value="open_menu">open_menu</option>
                    <option value="search_manuals">search_manuals</option>
                    <option value="call_api">call_api</option>
                    <option value="help">help</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600">최소 권한</label>
                  <select value={form.minRole} onChange={e=>setForm(f=>({...f, minRole:e.target.value as any}))} className="w-full px-3 py-2 border rounded">
                    <option value="staff">staff</option>
                    <option value="manager">manager</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600">우선순위</label>
                  <input type="number" value={form.priority} onChange={e=>setForm(f=>({...f, priority:Number(e.target.value)}))} className="w-full px-3 py-2 border rounded" />
                </div>
                <div className="flex items-end gap-2">
                  <label className="text-sm text-gray-600">활성화</label>
                  <input type="checkbox" checked={form.enabled} onChange={e=>setForm(f=>({...f, enabled:e.target.checked}))} />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600">응답 템플릿</label>
                <textarea value={form.responseTemplate} onChange={e=>setForm(f=>({...f, responseTemplate:e.target.value}))} className="w-full px-3 py-2 border rounded h-24" />
              </div>
              <div>
                <label className="text-sm text-gray-600">variables (JSON)</label>
                <textarea value={form.variablesText} onChange={e=>setForm(f=>({...f, variablesText:e.target.value}))} className="w-full px-3 py-2 border rounded h-24 font-mono" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveForm} className="px-4 py-2 bg-blue-600 text-white rounded">저장</button>
                <button onClick={()=>{setFormOpen(false); setEditing(null)}} className="px-4 py-2 bg-gray-200 rounded">취소</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


