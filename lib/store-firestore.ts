import { db } from './firebase'
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  orderBy,
  query,
  Timestamp 
} from 'firebase/firestore'
import { Store } from '@/types/ranking'

const COLLECTION_NAME = 'stores'

// Store를 Firestore 데이터 형식으로 변환
const storeToFirestore = (store: Store) => ({
  name: store.name,
  address: store.address,
  category: store.category,
  imageUrl: store.imageUrl || '',
  mobileUrl: store.mobileUrl || '',
  pcUrl: store.pcUrl || ''
})

// Firestore 데이터를 Store로 변환
const firestoreToStore = (id: string, data: any): Store => ({
  id,
  name: data.name,
  address: data.address,
  category: data.category,
  imageUrl: data.imageUrl,
  mobileUrl: data.mobileUrl,
  pcUrl: data.pcUrl
})

// 모든 지점 조회
export const getStores = async (): Promise<Store[]> => {
  try {
    const storesRef = collection(db, COLLECTION_NAME)
    const q = query(storesRef, orderBy('name', 'asc'))
    
    const querySnapshot = await getDocs(q)
    const stores: Store[] = []
    
    querySnapshot.forEach((doc) => {
      stores.push(firestoreToStore(doc.id, doc.data()))
    })
    
    return stores
  } catch (error) {
    console.error('Error getting stores:', error)
    throw error
  }
}

// 지점 추가
export const addStore = async (store: Omit<Store, 'id'>): Promise<string> => {
  try {
    const storesRef = collection(db, COLLECTION_NAME)
    const now = Timestamp.now()
    const storeData = {
      ...storeToFirestore(store as Store),
      createdAt: now,
      updatedAt: now
    }
    
    const docRef = await addDoc(storesRef, storeData)
    console.log('Store added successfully with ID:', docRef.id)
    return docRef.id
  } catch (error) {
    console.error('Error adding store:', error)
    throw error
  }
}

// 지점 업데이트
export const updateStore = async (storeId: string, updates: Partial<Store>): Promise<void> => {
  try {
    const storeRef = doc(db, COLLECTION_NAME, storeId)
    const updateData = {
      ...(updates.name && { name: updates.name }),
      ...(updates.address && { address: updates.address }),
      ...(updates.category && { category: updates.category }),
      ...(updates.imageUrl !== undefined && { imageUrl: updates.imageUrl }),
      ...(updates.mobileUrl !== undefined && { mobileUrl: updates.mobileUrl }),
      ...(updates.pcUrl !== undefined && { pcUrl: updates.pcUrl }),
      updatedAt: Timestamp.now()
    }
    
    await updateDoc(storeRef, updateData)
    console.log('Store updated successfully:', storeId)
  } catch (error) {
    console.error('Error updating store:', error)
    throw error
  }
}

// 지점 삭제
export const deleteStore = async (storeId: string): Promise<void> => {
  try {
    const storeRef = doc(db, COLLECTION_NAME, storeId)
    await deleteDoc(storeRef)
    console.log('Store deleted successfully:', storeId)
  } catch (error) {
    console.error('Error deleting store:', error)
    throw error
  }
}


