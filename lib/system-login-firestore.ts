import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  orderBy, 
  where,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { db } from './firebase'
import { SystemLogin, SystemLoginFormData } from '@/types/system-login'

const COLLECTION_NAME = 'system-logins'

// Firestore 데이터를 SystemLogin로 변환
const firestoreToSystemLogin = (id: string, data: any): SystemLogin => ({
  id,
  storeId: data.storeId,
  storeName: data.storeName || '',
  systemName: data.systemName,
  username: data.username,
  password: data.password,
  note: data.note || '',
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date()
})

// 모든 시스템 로그인 정보 조회
export const getSystemLogins = async (): Promise<SystemLogin[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('storeName', 'asc'),
      orderBy('systemName', 'asc')
    )
    const querySnapshot = await getDocs(q)
    
    return querySnapshot.docs.map(doc => 
      firestoreToSystemLogin(doc.id, doc.data())
    )
  } catch (error) {
    console.error('시스템 로그인 정보 조회 실패:', error)
    throw error
  }
}

// 지점별 시스템 로그인 정보 조회
export const getSystemLoginsByStore = async (storeId: string): Promise<SystemLogin[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('storeId', '==', storeId),
      orderBy('systemName', 'asc')
    )
    const querySnapshot = await getDocs(q)
    
    return querySnapshot.docs.map(doc => 
      firestoreToSystemLogin(doc.id, doc.data())
    )
  } catch (error) {
    console.error('지점별 시스템 로그인 정보 조회 실패:', error)
    throw error
  }
}

// 시스템별 로그인 정보 조회
export const getSystemLoginsBySystem = async (systemName: string): Promise<SystemLogin[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('systemName', '==', systemName),
      orderBy('storeName', 'asc')
    )
    const querySnapshot = await getDocs(q)
    
    return querySnapshot.docs.map(doc => 
      firestoreToSystemLogin(doc.id, doc.data())
    )
  } catch (error) {
    console.error('시스템별 로그인 정보 조회 실패:', error)
    throw error
  }
}

// 지점과 시스템으로 필터링
export const getSystemLoginsByStoreAndSystem = async (
  storeId: string, 
  systemName: string
): Promise<SystemLogin[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('storeId', '==', storeId),
      where('systemName', '==', systemName)
    )
    const querySnapshot = await getDocs(q)
    
    return querySnapshot.docs.map(doc => 
      firestoreToSystemLogin(doc.id, doc.data())
    )
  } catch (error) {
    console.error('필터링된 시스템 로그인 정보 조회 실패:', error)
    throw error
  }
}

// 시스템 로그인 정보 추가
export const addSystemLogin = async (
  data: SystemLoginFormData, 
  storeName: string
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      storeName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return docRef.id
  } catch (error) {
    console.error('시스템 로그인 정보 추가 실패:', error)
    throw error
  }
}

// 시스템 로그인 정보 수정
export const updateSystemLogin = async (
  id: string, 
  data: Partial<SystemLoginFormData>,
  storeName?: string
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    const updateData: any = {
      ...data,
      updatedAt: serverTimestamp()
    }
    if (storeName) {
      updateData.storeName = storeName
    }
    await updateDoc(docRef, updateData)
  } catch (error) {
    console.error('시스템 로그인 정보 수정 실패:', error)
    throw error
  }
}

// 시스템 로그인 정보 삭제
export const deleteSystemLogin = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    await deleteDoc(docRef)
  } catch (error) {
    console.error('시스템 로그인 정보 삭제 실패:', error)
    throw error
  }
}

// 시스템 로그인 정보 조회 (단일)
export const getSystemLogin = async (id: string): Promise<SystemLogin | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return firestoreToSystemLogin(docSnap.id, docSnap.data())
    }
    return null
  } catch (error) {
    console.error('시스템 로그인 정보 조회 실패:', error)
    throw error
  }
}

