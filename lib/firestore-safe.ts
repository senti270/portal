import { db } from './firebase'
import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc,
} from 'firebase/firestore'
import { System } from '@/data/systems'

const SYSTEMS_COLLECTION = 'systems'

// 안전한 시스템 업데이트 - 삭제 없이 개별 업데이트만
export async function updateSystemsSafely(systems: System[]): Promise<void> {
  try {
    console.log('🔄 안전한 시스템 업데이트 시작...', systems.length, '개 시스템')
    
    // 각 시스템을 개별적으로 업데이트 (삭제 없음)
    for (const system of systems) {
      try {
        const systemRef = doc(db, SYSTEMS_COLLECTION, system.id)
        
        // 업데이트할 데이터 준비
        const updateData: any = {
          title: system.title,
          description: system.description,
          icon: system.icon,
          color: system.color,
          category: system.category,
          url: system.url || '',
          status: system.status,
          tags: system.tags || [],
          optimization: system.optimization || [],
          order: system.order ?? 0,
          updatedAt: new Date()
        }
        
        // createdAt이 있으면 유지
        if (system.createdAt) {
          updateData.createdAt = system.createdAt
        }
        
        await updateDoc(systemRef, updateData)
        console.log(`✅ 업데이트됨: ${system.title} (order: ${system.order})`)
      } catch (error) {
        console.warn(`⚠️ 업데이트 실패: ${system.id}`, error)
        // 개별 업데이트 실패해도 계속 진행
      }
    }
    
    console.log('✅ 안전한 시스템 업데이트 완료!')
  } catch (error) {
    console.error('❌ 시스템 업데이트 오류:', error)
    throw error
  }
}









