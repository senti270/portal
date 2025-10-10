import { db } from './firebase'
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore'
import { Keyword } from '@/types/ranking'

const COLLECTION_NAME = 'keywords'

// 키워드 데이터를 Firestore에 저장하기 위한 인터페이스
interface KeywordFirestoreData {
  keyword: string
  monthlySearchVolume: number
  mobileVolume: number
  pcVolume: number
  storeId: string
  isActive: boolean
  order: number
  createdAt: any
  updatedAt: any
}

// Keyword를 Firestore 데이터로 변환
const keywordToFirestore = (keyword: Keyword): Omit<KeywordFirestoreData, 'createdAt' | 'updatedAt'> => ({
  keyword: keyword.keyword,
  monthlySearchVolume: keyword.monthlySearchVolume,
  mobileVolume: keyword.mobileVolume,
  pcVolume: keyword.pcVolume,
  storeId: keyword.storeId,
  isActive: keyword.isActive,
  order: keyword.order || 0
})

// Firestore 데이터를 Keyword로 변환
const firestoreToKeyword = (id: string, data: any): Keyword => ({
  id,
  keyword: data.keyword,
  monthlySearchVolume: data.monthlySearchVolume,
  mobileVolume: data.mobileVolume,
  pcVolume: data.pcVolume,
  storeId: data.storeId,
  isActive: data.isActive,
  order: data.order
})

// 특정 지점의 키워드 목록 조회
export const getKeywords = async (storeId: string): Promise<Keyword[]> => {
  try {
    const keywordsRef = collection(db, COLLECTION_NAME)
    const q = query(
      keywordsRef, 
      where('storeId', '==', storeId),
      orderBy('order', 'asc')
    )
    
    const querySnapshot = await getDocs(q)
    const keywords: Keyword[] = []
    
    querySnapshot.forEach((doc) => {
      keywords.push(firestoreToKeyword(doc.id, doc.data()))
    })
    
    return keywords
  } catch (error) {
    console.error('Error getting keywords:', error)
    throw error
  }
}

// 키워드 추가
export const addKeyword = async (keyword: Omit<Keyword, 'id'>): Promise<string> => {
  try {
    const keywordsRef = collection(db, COLLECTION_NAME)
    const now = Timestamp.now()
    const keywordData = {
      ...keywordToFirestore(keyword as Keyword),
      createdAt: now,
      updatedAt: now
    }
    
    const docRef = await addDoc(keywordsRef, keywordData)
    return docRef.id
  } catch (error) {
    console.error('Error adding keyword:', error)
    throw error
  }
}

// 키워드 업데이트
export const updateKeyword = async (keywordId: string, updates: Partial<Keyword>): Promise<void> => {
  try {
    const keywordRef = doc(db, COLLECTION_NAME, keywordId)
    const updateData = {
      ...(updates.keyword && { keyword: updates.keyword }),
      ...(updates.monthlySearchVolume !== undefined && { monthlySearchVolume: updates.monthlySearchVolume }),
      ...(updates.mobileVolume !== undefined && { mobileVolume: updates.mobileVolume }),
      ...(updates.pcVolume !== undefined && { pcVolume: updates.pcVolume }),
      ...(updates.isActive !== undefined && { isActive: updates.isActive }),
      ...(updates.order !== undefined && { order: updates.order }),
      updatedAt: Timestamp.now()
    }
    
    await updateDoc(keywordRef, updateData)
  } catch (error) {
    console.error('Error updating keyword:', error)
    throw error
  }
}

// 키워드 삭제
export const deleteKeyword = async (keywordId: string): Promise<void> => {
  try {
    const keywordRef = doc(db, COLLECTION_NAME, keywordId)
    await deleteDoc(keywordRef)
  } catch (error) {
    console.error('Error deleting keyword:', error)
    throw error
  }
}

// 키워드 순서 업데이트 (드래그 앤 드롭)
export const updateKeywordOrder = async (keywords: Keyword[]): Promise<void> => {
  try {
    const updatePromises = keywords.map((keyword, index) => 
      updateKeyword(keyword.id, { order: index + 1 })
    )
    
    await Promise.all(updatePromises)
  } catch (error) {
    console.error('Error updating keyword order:', error)
    throw error
  }
}

// 여러 키워드 일괄 저장
export const saveKeywords = async (storeId: string, keywords: Keyword[]): Promise<void> => {
  try {
    // 기존 키워드들 삭제
    const existingKeywords = await getKeywords(storeId)
    const deletePromises = existingKeywords.map(keyword => deleteKeyword(keyword.id))
    await Promise.all(deletePromises)
    
    // 새로운 키워드들 추가
    const addPromises = keywords.map((keyword, index) => 
      addKeyword({
        ...keyword,
        storeId,
        order: index + 1
      })
    )
    
    await Promise.all(addPromises)
  } catch (error) {
    console.error('Error saving keywords:', error)
    throw error
  }
}
