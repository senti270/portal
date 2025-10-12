export interface Store {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export interface Manual {
  id: string
  title: string
  content: string
  storeTags: string[]
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

export interface ManualFormData {
  title: string
  content: string
  storeTags: string[]
}

export interface StoreFormData {
  name: string
}

// 기본 지점 목록
export const defaultStores: Store[] = [
  {
    id: 'all',
    name: '전지점',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'cheongdam-dongtan',
    name: '청담장어마켓동탄점',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'cafe-drawing-seokchon',
    name: '카페드로잉 석촌호수점',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'cafe-drawing-jeongja',
    name: '카페드로잉정자점',
    createdAt: new Date(),
    updatedAt: new Date()
  }
]
