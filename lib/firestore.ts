import { db } from './firebase'
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore'
import { System } from '@/data/systems'

const SYSTEMS_COLLECTION = 'systems'

// 모든 시스템 가져오기
export async function getSystems(): Promise<System[]> {
  try {
    const systemsRef = collection(db, SYSTEMS_COLLECTION)
    const q = query(systemsRef, orderBy('createdAt', 'desc'))
    const querySnapshot = await getDocs(q)
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as System[]
  } catch (error) {
    console.error('Error getting systems:', error)
    return []
  }
}

// 시스템 추가
export async function addSystem(system: Omit<System, 'id'>): Promise<string> {
  try {
    const systemsRef = collection(db, SYSTEMS_COLLECTION)
    const docRef = await addDoc(systemsRef, {
      ...system,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    return docRef.id
  } catch (error) {
    console.error('Error adding system:', error)
    throw error
  }
}

// 시스템 업데이트
export async function updateSystem(id: string, system: Partial<System>): Promise<void> {
  try {
    const systemRef = doc(db, SYSTEMS_COLLECTION, id)
    await updateDoc(systemRef, {
      ...system,
      updatedAt: new Date()
    })
  } catch (error) {
    console.error('Error updating system:', error)
    throw error
  }
}

// 시스템 삭제
export async function deleteSystem(id: string): Promise<void> {
  try {
    const systemRef = doc(db, SYSTEMS_COLLECTION, id)
    await deleteDoc(systemRef)
  } catch (error) {
    console.error('Error deleting system:', error)
    throw error
  }
}

// 모든 시스템 업데이트 (관리자용)
export async function updateAllSystems(systems: System[]): Promise<void> {
  try {
    // 기존 데이터 삭제 후 새로 추가하는 방식
    const existingSystems = await getSystems()
    
    // 기존 시스템들 삭제
    for (const system of existingSystems) {
      await deleteSystem(system.id)
    }
    
    // 새 시스템들 추가
    for (const system of systems) {
      const { id, ...systemData } = system
      await addSystem(systemData)
    }
  } catch (error) {
    console.error('Error updating all systems:', error)
    throw error
  }
}
