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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase'
import { PurchaseItem } from '@/types/purchase'

const purchaseCollection = collection(db, 'purchase-items')

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

// 이미지 업로드
export const uploadImage = async (file: File, itemId: string): Promise<string> => {
  try {
    const imageRef = ref(storage, `purchase-items/${itemId}/${file.name}`)
    const snapshot = await uploadBytes(imageRef, file)
    const downloadURL = await getDownloadURL(snapshot.ref)
    return downloadURL
  } catch (error) {
    console.error('Error uploading image:', error)
    throw error
  }
}

// 구매물품 추가
export const addPurchaseItem = async (item: Omit<PurchaseItem, 'id' | 'createdAt' | 'updatedAt'>, imageFile?: File): Promise<string> => {
  try {
    const now = Timestamp.now()
    const itemData = {
      ...item,
      createdAt: now,
      updatedAt: now,
    }

    // Firestore에 먼저 문서 추가
    const docRef = await addDoc(purchaseCollection, itemData)
    
    // 이미지가 있으면 업로드하고 URL 업데이트
    if (imageFile) {
      const imageUrl = await uploadImage(imageFile, docRef.id)
      await updateDoc(docRef, { imageUrl })
    }
    
    return docRef.id
  } catch (error) {
    console.error('Error adding purchase item:', error)
    throw error
  }
}

// 구매물품 수정
export const updatePurchaseItem = async (id: string, item: Partial<PurchaseItem>, imageFile?: File): Promise<void> => {
  try {
    const updateData: any = {
      ...item,
      updatedAt: Timestamp.now(),
    }

    // 이미지가 있으면 기존 이미지 삭제 후 새 이미지 업로드
    if (imageFile) {
      const imageUrl = await uploadImage(imageFile, id)
      updateData.imageUrl = imageUrl
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
