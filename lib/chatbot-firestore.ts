import { 
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  limit as limitDocs
} from 'firebase/firestore'
import { db } from './firebase'

export type ChatRole = 'user' | 'bot'

export interface ChatMessageDoc {
  id: string
  role: ChatRole
  content: string
  createdAt: Date
  sessionId?: string
}

const CHAT_COLLECTION = 'chatbot_messages'

export async function addChatMessage(params: {
  role: ChatRole
  content: string
  sessionId?: string
}): Promise<string> {
  const docRef = await addDoc(collection(db, CHAT_COLLECTION), {
    role: params.role,
    content: params.content,
    sessionId: params.sessionId || null,
    createdAt: serverTimestamp()
  })
  return docRef.id
}

export async function getChatMessages(options?: {
  sessionId?: string
  since?: Date
  limit?: number
}): Promise<ChatMessageDoc[]> {
  const constraints: any[] = []
  if (options?.sessionId) {
    constraints.push(where('sessionId', '==', options.sessionId))
  }
  if (options?.since) {
    constraints.push(where('createdAt', '>=', Timestamp.fromDate(options.since)))
  }
  constraints.push(orderBy('createdAt', 'desc'))
  if (options?.limit && options.limit > 0) {
    constraints.push(limitDocs(options.limit))
  }

  const q = query(collection(db, CHAT_COLLECTION), ...constraints)
  const snapshot = await getDocs(q)
  const items = snapshot.docs.map(d => {
    const data = d.data() as any
    return {
      id: d.id,
      role: data.role as ChatRole,
      content: data.content as string,
      sessionId: data.sessionId || undefined,
      createdAt: data.createdAt?.toDate() || new Date()
    } as ChatMessageDoc
  })
  return items
}


