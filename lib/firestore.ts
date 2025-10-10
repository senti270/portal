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
    console.log('🔍 Firebase에서 시스템 조회 시작...')
    const systemsRef = collection(db, SYSTEMS_COLLECTION)
    
    // 먼저 order 없이 전체 조회해서 개수 확인
    const allDocsSnapshot = await getDocs(systemsRef)
    console.log('📊 Firebase 전체 문서 개수:', allDocsSnapshot.docs.length, '개')
    
    // 각 문서 상세 정보 출력
    allDocsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data()
      console.log(`📄 문서 ${index + 1}:`, {
        id: doc.id,
        title: data.title,
        order: data.order,
        status: data.status,
        hasOrder: data.order !== undefined && data.order !== null
      })
    })
    
    // order 필드가 있는 문서들만 orderBy로 조회
    let querySnapshot = allDocsSnapshot
    try {
      const q = query(systemsRef, orderBy('order', 'asc'))
      const orderedSnapshot = await getDocs(q)
      if (orderedSnapshot.docs.length > 0) {
        querySnapshot = orderedSnapshot
        console.log('✅ orderBy로 정렬된 데이터 사용')
      } else {
        console.log('⚠️ orderBy 결과가 비어있음, 전체 문서 사용')
      }
    } catch (error) {
      console.log('⚠️ orderBy 쿼리 실패, 전체 문서 사용:', error)
    }
    
    console.log('📊 임시 전체 쿼리 결과:', querySnapshot.docs.length, '개 문서')
    
    const systems = querySnapshot.docs.map((doc, index) => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        order: data.order !== undefined && data.order !== null ? data.order : index // order가 없으면 배열 인덱스 사용
      }
    }) as System[]
    
    // 클라이언트에서 order로 정렬 (오름차순)
    systems.sort((a, b) => (a.order || 0) - (b.order || 0))
    
    console.log('🔢 정렬 후 시스템 order 값들:', systems.map(s => `${s.title}: ${s.order}`))
    console.log('🔍 Firebase에서 가져온 원본 데이터:')
    allDocsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data()
      console.log(`  ${index + 1}. ${data.title} - order: ${data.order}`)
    })
    
    console.log('✅ 최종 시스템 배열:', systems.length, '개')
    console.log('📋 시스템 제목 목록:', systems.map(s => s.title))
    return systems
  } catch (error) {
    console.error('❌ Firebase 시스템 조회 오류:', error)
    console.error('오류 상세:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code,
      stack: (error as any)?.stack
    })
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

// 모든 시스템 업데이트 (관리자용) - 안전한 방식
export async function updateAllSystems(systems: System[]): Promise<void> {
  try {
    console.log('🔄 시스템 업데이트 시작...', systems.length, '개 시스템')
    
    // 기존 모든 시스템 삭제 (orderBy 없이 직접 조회)
    const systemsRef = collection(db, SYSTEMS_COLLECTION)
    const allDocsSnapshot = await getDocs(systemsRef)
    console.log('🗑️ 기존 시스템 삭제 중...', allDocsSnapshot.docs.length, '개')
    
    for (const docSnapshot of allDocsSnapshot.docs) {
      try {
        await deleteDoc(docSnapshot.ref)
        console.log('✅ 삭제됨:', docSnapshot.data().title)
      } catch (error) {
        console.warn('⚠️ 삭제 실패:', docSnapshot.id, error)
      }
    }
    
    // 새 시스템들 추가
    console.log('➕ 새 시스템 추가 중...')
    for (const system of systems) {
      try {
        const { id, ...systemData } = system
        const newId = await addSystem(systemData)
        console.log('✅ 추가됨:', system.title, 'ID:', newId)
      } catch (error) {
        console.error('❌ 추가 실패:', system.title, error)
        throw error
      }
    }
    
    console.log('✅ 모든 시스템 업데이트 완료!')
  } catch (error) {
    console.error('❌ 시스템 업데이트 오류:', error)
    throw error
  }
}
