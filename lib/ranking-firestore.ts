import { db } from './firebase'
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore'
import { RankingRecord } from '@/types/ranking'

const COLLECTION_NAME = 'rankings'

// RankingRecord를 Firestore 데이터 형식으로 변환
const rankingToFirestore = (ranking: RankingRecord) => ({
  storeId: ranking.storeId,
  keywordId: ranking.keywordId,
  date: ranking.date,
  mobileRank: ranking.mobileRank,
  pcRank: ranking.pcRank,
  isAutoTracked: ranking.isAutoTracked || false
})

// Firestore 데이터를 RankingRecord로 변환
const firestoreToRanking = (id: string, data: any): RankingRecord => ({
  id,
  storeId: data.storeId,
  keywordId: data.keywordId,
  date: data.date,
  mobileRank: data.mobileRank,
  pcRank: data.pcRank,
  isAutoTracked: data.isAutoTracked || false,
  createdAt: data.createdAt?.toDate() || new Date()
})

// 특정 지점의 순위 기록 조회
export const getRankings = async (storeId: string): Promise<RankingRecord[]> => {
  try {
    const rankingsRef = collection(db, COLLECTION_NAME)
    const q = query(
      rankingsRef, 
      where('storeId', '==', storeId),
      orderBy('date', 'desc') // 날짜순 정렬 (최신순)
    )
    
    const querySnapshot = await getDocs(q)
    const rankings: RankingRecord[] = []
    
    querySnapshot.forEach((doc) => {
      rankings.push(firestoreToRanking(doc.id, doc.data()))
    })
    
    return rankings
  } catch (error) {
    console.error('Error getting rankings:', error)
    throw error
  }
}

// 특정 키워드의 순위 기록 조회
export const getRankingsByKeyword = async (keywordId: string): Promise<RankingRecord[]> => {
  try {
    const rankingsRef = collection(db, COLLECTION_NAME)
    const q = query(
      rankingsRef, 
      where('keywordId', '==', keywordId),
      orderBy('date', 'desc')
    )
    
    const querySnapshot = await getDocs(q)
    const rankings: RankingRecord[] = []
    
    querySnapshot.forEach((doc) => {
      rankings.push(firestoreToRanking(doc.id, doc.data()))
    })
    
    return rankings
  } catch (error) {
    console.error('Error getting rankings by keyword:', error)
    throw error
  }
}

// 순위 기록 추가
export const addRanking = async (ranking: Omit<RankingRecord, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const rankingsRef = collection(db, COLLECTION_NAME)
    const now = Timestamp.now()
    const rankingData = {
      ...rankingToFirestore(ranking as RankingRecord),
      createdAt: now
    }
    
    const docRef = await addDoc(rankingsRef, rankingData)
    console.log('Ranking added successfully with ID:', docRef.id)
    return docRef.id
  } catch (error) {
    console.error('Error adding ranking:', error)
    throw error
  }
}

// 여러 순위 기록을 한 번에 추가
export const addRankings = async (rankings: Omit<RankingRecord, 'id' | 'createdAt'>[]): Promise<string[]> => {
  try {
    const ids: string[] = []
    const addPromises = rankings.map(async (ranking) => {
      const id = await addRanking(ranking)
      ids.push(id)
      return id
    })
    
    await Promise.all(addPromises)
    console.log(`${ids.length} rankings added successfully`)
    return ids
  } catch (error) {
    console.error('Error adding rankings batch:', error)
    throw error
  }
}

// 특정 날짜의 순위 기록 삭제
export const deleteRankingsByDate = async (storeId: string, date: string): Promise<void> => {
  try {
    const rankingsRef = collection(db, COLLECTION_NAME)
    const q = query(
      rankingsRef, 
      where('storeId', '==', storeId),
      where('date', '==', date)
    )
    
    const querySnapshot = await getDocs(q)
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref))
    
    await Promise.all(deletePromises)
    console.log(`Rankings deleted for date: ${date}`)
  } catch (error) {
    console.error('Error deleting rankings by date:', error)
    throw error
  }
}

// 순위 기록 삭제 (단일)
export const deleteRanking = async (rankingId: string): Promise<void> => {
  try {
    const rankingRef = doc(db, COLLECTION_NAME, rankingId)
    await deleteDoc(rankingRef)
    console.log('Ranking deleted successfully:', rankingId)
  } catch (error) {
    console.error('Error deleting ranking:', error)
    throw error
  }
}

