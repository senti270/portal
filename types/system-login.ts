export interface SystemLogin {
  id: string
  storeId: string
  storeName: string
  systemName: string
  username: string
  password: string
  note?: string
  createdAt: Date
  updatedAt: Date
}

export interface SystemLoginFormData {
  storeId: string
  systemName: string
  username: string
  password: string
  note?: string
}

