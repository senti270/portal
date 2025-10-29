export interface PurchaseItem {
  id: string
  name: string
  category: string[]
  purchaseSource: string
  url?: string
  purchaseUnit?: string
  imageUrl?: string
  createdAt: Date
  updatedAt: Date
}

export interface PurchaseItemFormData {
  name: string
  category: string[]
  purchaseSource: string
  url: string
  purchaseUnit: string
  imageFile?: File
}




