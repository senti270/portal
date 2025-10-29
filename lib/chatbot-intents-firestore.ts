import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore'
import { db } from './firebase'

export type IntentMatchType = 'exact' | 'includes' | 'regex'
export type IntentAction = 'open_menu' | 'search_manuals' | 'call_api' | 'help'
export type IntentMinRole = 'staff' | 'manager' | 'admin'

export interface ChatbotIntent {
  id: string
  keywords: string[]
  matchType: IntentMatchType
  action: IntentAction
  responseTemplate?: string
  variables?: Record<string, string>
  priority: number
  minRole: IntentMinRole
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ChatbotIntentForm {
  keywords: string[]
  matchType: IntentMatchType
  action: IntentAction
  responseTemplate?: string
  variables?: Record<string, string>
  priority?: number
  minRole?: IntentMinRole
  enabled?: boolean
}

const INTENTS_COLLECTION = 'chatbot_intents'

export async function listIntents(): Promise<ChatbotIntent[]> {
  const q = query(collection(db, INTENTS_COLLECTION), orderBy('priority', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data() as any
    return {
      id: d.id,
      keywords: data.keywords || [],
      matchType: data.matchType || 'includes',
      action: data.action || 'help',
      responseTemplate: data.responseTemplate || '',
      variables: data.variables || {},
      priority: typeof data.priority === 'number' ? data.priority : 0,
      minRole: data.minRole || 'staff',
      enabled: data.enabled !== false,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    } as ChatbotIntent
  })
}

export async function getIntent(id: string): Promise<ChatbotIntent | null> {
  const ref = doc(db, INTENTS_COLLECTION, id)
  const s = await getDoc(ref)
  if (!s.exists()) return null
  const data = s.data() as any
  return {
    id: s.id,
    keywords: data.keywords || [],
    matchType: data.matchType || 'includes',
    action: data.action || 'help',
    responseTemplate: data.responseTemplate || '',
    variables: data.variables || {},
    priority: typeof data.priority === 'number' ? data.priority : 0,
    minRole: data.minRole || 'staff',
    enabled: data.enabled !== false,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date()
  }
}

export async function createIntent(data: ChatbotIntentForm): Promise<string> {
  const ref = await addDoc(collection(db, INTENTS_COLLECTION), {
    keywords: data.keywords || [],
    matchType: data.matchType || 'includes',
    action: data.action || 'help',
    responseTemplate: data.responseTemplate || '',
    variables: data.variables || {},
    priority: typeof data.priority === 'number' ? data.priority : 0,
    minRole: data.minRole || 'staff',
    enabled: data.enabled !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return ref.id
}

export async function updateIntent(id: string, data: Partial<ChatbotIntentForm>): Promise<void> {
  const ref = doc(db, INTENTS_COLLECTION, id)
  await updateDoc(ref, {
    ...(data as any),
    updatedAt: serverTimestamp()
  })
}

export async function deleteIntent(id: string): Promise<void> {
  const ref = doc(db, INTENTS_COLLECTION, id)
  await deleteDoc(ref)
}

export function matchIntent(intents: ChatbotIntent[], message: string, userRole: IntentMinRole = 'staff'): ChatbotIntent | null {
  const normalized = message.toLowerCase().trim()
  const roleRank = { staff: 1, manager: 2, admin: 3 } as const
  const allowed = intents.filter(i => i.enabled && roleRank[userRole] >= roleRank[i.minRole])
  // priority desc로 이미 정렬되어 있지만 한 번 더 안전하게
  const sorted = [...allowed].sort((a, b) => b.priority - a.priority)

  for (const intent of sorted) {
    const kws = (intent.keywords || []).map(k => k.toLowerCase())
    if (intent.matchType === 'exact') {
      if (kws.includes(normalized)) return intent
    } else if (intent.matchType === 'includes') {
      if (kws.some(k => normalized.includes(k))) return intent
    } else if (intent.matchType === 'regex') {
      try {
        if (kws.some(k => new RegExp(k, 'i').test(message))) return intent
      } catch {}
    }
  }
  return null
}

export function renderTemplate(template: string, variables?: Record<string, string>): string {
  if (!template) return ''
  return template.replace(/\{(\w+)\}/g, (_m, key) => {
    return variables?.[key] ?? `{${key}}`
  })
}


