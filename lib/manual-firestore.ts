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
import { Manual, Store, ManualFormData, StoreFormData } from '@/types/manual'

const MANUALS_COLLECTION = 'manuals'
const STORES_COLLECTION = 'stores'

// 매뉴얼 관련 함수들
export const getManuals = async (): Promise<Manual[]> => {
  try {
    const q = query(
      collection(db, MANUALS_COLLECTION),
      orderBy('createdAt', 'desc')
    )
    const querySnapshot = await getDocs(q)
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    })) as Manual[]
  } catch (error) {
    console.error('매뉴얼 목록 조회 실패:', error)
    throw error
  }
}

export const getManual = async (id: string): Promise<Manual | null> => {
  try {
    const docRef = doc(db, MANUALS_COLLECTION, id)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as Manual
    }
    return null
  } catch (error) {
    console.error('매뉴얼 조회 실패:', error)
    throw error
  }
}

export const addManual = async (data: ManualFormData, createdBy: string): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, MANUALS_COLLECTION), {
      ...data,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return docRef.id
  } catch (error) {
    console.error('매뉴얼 추가 실패:', error)
    throw error
  }
}

export const updateManual = async (id: string, data: Partial<ManualFormData>): Promise<void> => {
  try {
    const docRef = doc(db, MANUALS_COLLECTION, id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('매뉴얼 수정 실패:', error)
    throw error
  }
}

export const deleteManual = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, MANUALS_COLLECTION, id)
    await deleteDoc(docRef)
  } catch (error) {
    console.error('매뉴얼 삭제 실패:', error)
    throw error
  }
}

// 지점 관련 함수들
export const getStores = async (): Promise<Store[]> => {
  try {
    const q = query(
      collection(db, STORES_COLLECTION),
      orderBy('name', 'asc')
    )
    const querySnapshot = await getDocs(q)
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    })) as Store[]
  } catch (error) {
    console.error('지점 목록 조회 실패:', error)
    throw error
  }
}

export const getStore = async (id: string): Promise<Store | null> => {
  try {
    const docRef = doc(db, STORES_COLLECTION, id)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as Store
    }
    return null
  } catch (error) {
    console.error('지점 조회 실패:', error)
    throw error
  }
}

export const addStore = async (data: StoreFormData): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, STORES_COLLECTION), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return docRef.id
  } catch (error) {
    console.error('지점 추가 실패:', error)
    throw error
  }
}

export const updateStore = async (id: string, data: Partial<StoreFormData>): Promise<void> => {
  try {
    const docRef = doc(db, STORES_COLLECTION, id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('지점 수정 실패:', error)
    throw error
  }
}

export const deleteStore = async (id: string): Promise<void> => {
  try {
    // 해당 지점을 사용하는 매뉴얼이 있는지 확인
    const q = query(
      collection(db, MANUALS_COLLECTION),
      where('storeTags', 'array-contains', id)
    )
    const querySnapshot = await getDocs(q)
    
    if (!querySnapshot.empty) {
      throw new Error('해당 지점을 사용하는 매뉴얼이 있어서 삭제할 수 없습니다.')
    }
    
    const docRef = doc(db, STORES_COLLECTION, id)
    await deleteDoc(docRef)
  } catch (error) {
    console.error('지점 삭제 실패:', error)
    throw error
  }
}

// 검색 함수들
export const searchManuals = async (searchTerm: string): Promise<Manual[]> => {
  try {
    const manuals = await getManuals()
    
    if (!searchTerm.trim()) {
      return manuals
    }
    
    const lowerSearchTerm = searchTerm.toLowerCase()
    return manuals.filter(manual => 
      manual.title.toLowerCase().includes(lowerSearchTerm) ||
      manual.content.toLowerCase().includes(lowerSearchTerm)
    )
  } catch (error) {
    console.error('매뉴얼 검색 실패:', error)
    throw error
  }
}

export const filterManualsByStore = async (storeId: string): Promise<Manual[]> => {
  try {
    const manuals = await getManuals()
    
    if (!storeId || storeId === 'all') {
      return manuals
    }
    
    return manuals.filter(manual => 
      manual.storeTags.includes(storeId)
    )
  } catch (error) {
    console.error('지점별 매뉴얼 필터링 실패:', error)
    throw error
  }
}
