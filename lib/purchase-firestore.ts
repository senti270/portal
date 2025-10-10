import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  orderBy,
  query,
  Timestamp
} from 'firebase/firestore'
import { db } from './firebase'
import { PurchaseItem } from '@/types/purchase'

const purchaseCollection = collection(db, 'purchase-items')

// 이미지 압축
export const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.7): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      // 비율 계산
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height)
      canvas.width = img.width * ratio
      canvas.height = img.height * ratio
      
      // 이미지 그리기
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
      
      // Blob으로 변환
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], file.name, { type: 'image/jpeg' }))
        } else {
          reject(new Error('이미지 압축 실패'))
        }
      }, 'image/jpeg', quality)
    }
    
    img.onerror = () => reject(new Error('이미지 로드 실패'))
    img.src = URL.createObjectURL(file)
  })
}

// 이미지를 Base64로 변환 (압축 후)
export const convertImageToBase64 = async (file: File): Promise<string> => {
  try {
    // 먼저 이미지 압축
    const compressedFile = await compressImage(file, 600, 0.6)
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(compressedFile)
    })
  } catch (error) {
    throw new Error('이미지 처리 실패: ' + error)
  }
}

// 구매물품 목록 조회
export const getPurchaseItems = async (): Promise<PurchaseItem[]> => {
  try {
    const q = query(purchaseCollection, orderBy('createdAt', 'desc'))
    const querySnapshot = await getDocs(q)
    const items: PurchaseItem[] = []
    
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      items.push({
        id: doc.id,
        name: data.name,
        category: data.category || [],
        purchaseSource: data.purchaseSource,
        url: data.url,
        purchaseUnit: data.purchaseUnit,
        imageUrl: data.imageUrl,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      })
    })
    
    return items
  } catch (error) {
    console.error('Error getting purchase items:', error)
    throw error
  }
}

// 구매물품 추가
export const addPurchaseItem = async (item: Omit<PurchaseItem, 'id' | 'createdAt' | 'updatedAt'>, imageFile?: File): Promise<string> => {
  try {
    const now = Timestamp.now()
    
    // File 객체를 제외한 데이터만 저장
    const { imageFile: _, ...itemWithoutFile } = item as any
    const itemData: any = {
      ...itemWithoutFile,
      createdAt: now,
      updatedAt: now,
    }

    // 이미지가 있으면 Base64로 변환해서 저장
    if (imageFile) {
      try {
        const base64Image = await convertImageToBase64(imageFile)
        itemData.imageUrl = base64Image // Base64 문자열을 imageUrl에 저장
      } catch (error) {
        console.warn('이미지 처리 실패, 이미지 없이 저장:', error)
      }
    }

    // Firestore에 문서 추가
    const docRef = await addDoc(purchaseCollection, itemData)
    
    return docRef.id
  } catch (error) {
    console.error('Error adding purchase item:', error)
    throw error
  }
}

// 구매물품 수정
export const updatePurchaseItem = async (id: string, item: Partial<PurchaseItem>, imageFile?: File): Promise<void> => {
  try {
    // File 객체를 제외한 데이터만 저장
    const { imageFile: _, ...itemWithoutFile } = item as any
    const updateData: any = {
      ...itemWithoutFile,
      updatedAt: Timestamp.now(),
    }

    // 이미지가 있으면 Base64로 변환해서 저장
    if (imageFile) {
      try {
        const base64Image = await convertImageToBase64(imageFile)
        updateData.imageUrl = base64Image // Base64 문자열을 imageUrl에 저장
      } catch (error) {
        console.warn('이미지 처리 실패, 이미지 없이 저장:', error)
      }
    }

    await updateDoc(doc(db, 'purchase-items', id), updateData)
  } catch (error) {
    console.error('Error updating purchase item:', error)
    throw error
  }
}

// 구매물품 삭제
export const deletePurchaseItem = async (id: string): Promise<void> => {
  try {
    // Firestore에서 삭제
    await deleteDoc(doc(db, 'purchase-items', id))
    
    // TODO: 스토리지에서 이미지도 삭제 (필요시)
  } catch (error) {
    console.error('Error deleting purchase item:', error)
    throw error
  }
}
