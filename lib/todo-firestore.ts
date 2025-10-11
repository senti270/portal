import { 
  db 
} from './firebase'
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  Timestamp 
} from 'firebase/firestore'
import { TodoItem, DepositItem } from '@/types/todo'

// TODO 컬렉션명
const TODO_COLLECTION = 'todos'
const DEPOSIT_COLLECTION = 'deposits'

// TodoItem을 Firestore 데이터 형식으로 변환
const todoToFirestore = (todo: Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt'>) => {
  let dueDateTimestamp = null
  
  if (todo.dueDate) {
    // Date 객체, 문자열, 숫자 모두 처리
    const dateObj = todo.dueDate instanceof Date ? todo.dueDate : new Date(todo.dueDate)
    dueDateTimestamp = Timestamp.fromDate(dateObj)
  }
  
  return {
    requester: todo.requester,
    task: todo.task,
    dueDate: dueDateTimestamp,
    isCompleted: todo.isCompleted
  }
}

// Firestore 데이터를 TodoItem으로 변환
const firestoreToTodo = (id: string, data: any): TodoItem => ({
  id,
  requester: data.requester,
  task: data.task,
  dueDate: data.dueDate,
  isCompleted: data.isCompleted,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date()
})

// DepositItem을 Firestore 데이터 형식으로 변환
const depositToFirestore = (deposit: Omit<DepositItem, 'id' | 'createdAt' | 'updatedAt'>) => {
  let requestDateTimestamp = null
  
  if (deposit.requestDate) {
    const dateObj = deposit.requestDate instanceof Date ? deposit.requestDate : new Date(deposit.requestDate)
    requestDateTimestamp = Timestamp.fromDate(dateObj)
  }
  
  return {
    requester: deposit.requester,
    companyName: deposit.companyName,
    amount: deposit.amount,
    bank: deposit.bank,
    accountNumber: deposit.accountNumber,
    requestDate: requestDateTimestamp,
    taxInvoiceAttached: deposit.taxInvoiceAttached,
    attachedFiles: deposit.attachedFiles || [],
    isCompleted: deposit.isCompleted
  }
}

// Firestore 데이터를 DepositItem으로 변환
const firestoreToDeposit = (id: string, data: any): DepositItem => ({
  id,
  requester: data.requester,
  companyName: data.companyName,
  amount: data.amount,
  bank: data.bank,
  accountNumber: data.accountNumber,
  requestDate: data.requestDate,
  taxInvoiceAttached: data.taxInvoiceAttached || false,
  attachedFiles: data.attachedFiles || [],
  isCompleted: data.isCompleted,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date()
})

// TODO 목록 조회
export const getTodos = async (): Promise<TodoItem[]> => {
  try {
    console.log('🔍 Firebase에서 TODO 조회 시작...')
    const todosRef = collection(db, TODO_COLLECTION)
    const q = query(todosRef, orderBy('createdAt', 'desc'))
    const querySnapshot = await getDocs(q)
    const todos: TodoItem[] = []
    
    console.log('📊 Firebase 문서 개수:', querySnapshot.docs.length)
    
    querySnapshot.forEach((doc) => {
      console.log('📄 문서 데이터:', doc.id, doc.data())
      todos.push(firestoreToTodo(doc.id, doc.data()))
    })
    
    console.log('✅ 최종 TODO 목록:', todos.length, '개')
    return todos
  } catch (error) {
    console.error('❌ Error getting todos:', error)
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code,
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}

// TODO 추가
export const addTodo = async (todo: Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const todosRef = collection(db, TODO_COLLECTION)
    const now = Timestamp.now()
    const todoData = {
      ...todoToFirestore(todo),
      createdAt: now,
      updatedAt: now
    }
    
    const docRef = await addDoc(todosRef, todoData)
    return docRef.id
  } catch (error) {
    console.error('Error adding todo:', error)
    throw error
  }
}

// TODO 업데이트
export const updateTodo = async (todoId: string, updates: Partial<TodoItem>): Promise<void> => {
  try {
    console.log('updateTodo 호출 - ID:', todoId, 'Updates:', updates)
    
    const todoRef = doc(db, TODO_COLLECTION, todoId)
    const updateData: any = {
      updatedAt: Timestamp.now()
    }
    
    // 각 필드를 명시적으로 처리
    if (updates.requester !== undefined) updateData.requester = updates.requester
    if (updates.task !== undefined) updateData.task = updates.task
    if (updates.isCompleted !== undefined) updateData.isCompleted = updates.isCompleted
    
    // dueDate 처리 - Date 객체나 문자열을 Timestamp로 변환
    if (updates.dueDate !== undefined) {
      if (updates.dueDate === null) {
        updateData.dueDate = null
      } else {
        const dateObj = updates.dueDate instanceof Date ? updates.dueDate : new Date(updates.dueDate)
        updateData.dueDate = Timestamp.fromDate(dateObj)
        console.log('dueDate 변환:', updates.dueDate, '->', dateObj, '->', updateData.dueDate)
      }
    }
    
    console.log('Firestore 업데이트 데이터:', updateData)
    
    await updateDoc(todoRef, updateData)
  } catch (error) {
    console.error('Error updating todo:', error)
    throw error
  }
}

// TODO 삭제
export const deleteTodo = async (todoId: string): Promise<void> => {
  try {
    const todoRef = doc(db, TODO_COLLECTION, todoId)
    await deleteDoc(todoRef)
  } catch (error) {
    console.error('Error deleting todo:', error)
    throw error
  }
}

// 입금 목록 조회
export const getDeposits = async (): Promise<DepositItem[]> => {
  try {
    const depositsRef = collection(db, DEPOSIT_COLLECTION)
    const q = query(depositsRef, orderBy('createdAt', 'desc'))
    const querySnapshot = await getDocs(q)
    const deposits: DepositItem[] = []
    
    querySnapshot.forEach((doc) => {
      deposits.push(firestoreToDeposit(doc.id, doc.data()))
    })
    
    return deposits
  } catch (error) {
    console.error('Error getting deposits:', error)
    throw error
  }
}

// 입금 추가
export const addDeposit = async (deposit: Omit<DepositItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const depositsRef = collection(db, DEPOSIT_COLLECTION)
    const now = Timestamp.now()
    const depositData = {
      ...depositToFirestore(deposit),
      createdAt: now,
      updatedAt: now
    }
    
    const docRef = await addDoc(depositsRef, depositData)
    return docRef.id
  } catch (error) {
    console.error('Error adding deposit:', error)
    throw error
  }
}

// 입금 업데이트
export const updateDeposit = async (depositId: string, updates: Partial<DepositItem>): Promise<void> => {
  try {
    const depositRef = doc(db, DEPOSIT_COLLECTION, depositId)
    const updateData: any = {
      updatedAt: Timestamp.now()
    }
    
    if (updates.requester !== undefined) updateData.requester = updates.requester
    if (updates.companyName !== undefined) updateData.companyName = updates.companyName
    if (updates.amount !== undefined) updateData.amount = updates.amount
    if (updates.bank !== undefined) updateData.bank = updates.bank
    if (updates.accountNumber !== undefined) updateData.accountNumber = updates.accountNumber
    if (updates.taxInvoiceAttached !== undefined) updateData.taxInvoiceAttached = updates.taxInvoiceAttached
    if (updates.isCompleted !== undefined) updateData.isCompleted = updates.isCompleted
    
    // requestDate 처리 - Timestamp로 변환
    if (updates.requestDate !== undefined) {
      if (updates.requestDate === null) {
        updateData.requestDate = null
      } else {
        const dateObj = updates.requestDate instanceof Date ? updates.requestDate : new Date(updates.requestDate)
        updateData.requestDate = Timestamp.fromDate(dateObj)
      }
    }
    
    await updateDoc(depositRef, updateData)
  } catch (error) {
    console.error('Error updating deposit:', error)
    throw error
  }
}

// 입금 삭제
export const deleteDeposit = async (depositId: string): Promise<void> => {
  try {
    const depositRef = doc(db, DEPOSIT_COLLECTION, depositId)
    await deleteDoc(depositRef)
  } catch (error) {
    console.error('Error deleting deposit:', error)
    throw error
  }
}
