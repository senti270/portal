export interface Store {
  id: string
  name: string
  address: string
  category: string
  imageUrl?: string
  mobileUrl?: string
  pcUrl?: string
}

export interface Keyword {
  id: string
  keyword: string
  monthlySearchVolume: number
  mobileVolume: number
  pcVolume: number
  storeId: string
  isActive: boolean
}

export interface RankingRecord {
  id: string
  storeId: string
  keywordId: string
  date: string // YYYY-MM-DD 형식
  mobileRank?: number
  pcRank?: number
  isAutoTracked: boolean
  createdAt: Date
}

export interface StoreRankingData {
  store: Store
  keywords: Keyword[]
  rankings: RankingRecord[]
}

export interface RankingFormData {
  keyword: string
  monthlySearchVolume: number
  mobileVolume: number
  pcVolume: number
}

// 5개 지점 기본 데이터
export const defaultStores: Store[] = [
  {
    id: 'store1',
    name: '청담장어마켓 동탄점',
    address: '동탄대로 446 1층 1002호~1006호, 1009호, 1010호',
    category: '장어, 먹장어요리',
    imageUrl: '/images/stores/cheongdam-dongtan.jpg',
    mobileUrl: 'https://m.place.naver.com/place/2056632623/home',
    pcUrl: 'https://map.naver.com/p/entry/place/2056632623'
  },
  {
    id: 'store2',
    name: '청담장어마켓 송파점',
    address: '송파구 주소',
    category: '장어, 먹장어요리',
    imageUrl: '/images/stores/cheongdam-songpa.jpg',
    mobileUrl: 'https://m.place.naver.com/place/1563424767/home',
    pcUrl: 'https://map.naver.com/p/entry/place/1563424767'
  },
  {
    id: 'store3',
    name: '카페드로잉 석촌호수점',
    address: '석촌호수 주소',
    category: '카페, 베이커리',
    imageUrl: '/images/stores/cafe-drawing-seokchon.jpg',
    mobileUrl: 'https://m.place.naver.com/place/1824352254/home',
    pcUrl: 'https://map.naver.com/p/entry/place/1824352254'
  },
  {
    id: 'store4',
    name: '카페드로잉 정자점',
    address: '정자동 주소',
    category: '카페, 베이커리',
    imageUrl: '/images/stores/cafe-drawing-jeongja.jpg',
    mobileUrl: 'https://m.place.naver.com/place/31427861/home',
    pcUrl: 'https://map.naver.com/p/entry/place/31427861'
  },
  {
    id: 'store5',
    name: '카페드로잉 동탄점',
    address: '동탄신도시 주소',
    category: '카페, 베이커리',
    imageUrl: '/images/stores/cafe-drawing-dongtan.jpg',
    mobileUrl: 'https://m.place.naver.com/place/1249653316/home',
    pcUrl: 'https://map.naver.com/p/entry/place/1249653316'
  }
]

// 기본 키워드 데이터 (청담장어마켓 동탄점 기준)
export const defaultKeywords: Keyword[] = [
  {
    id: 'keyword1',
    keyword: '동탄장어',
    monthlySearchVolume: 2200,
    mobileVolume: 1940,
    pcVolume: 260,
    storeId: 'store1',
    isActive: true
  },
  {
    id: 'keyword2',
    keyword: '동탄역장어',
    monthlySearchVolume: 650,
    mobileVolume: 570,
    pcVolume: 80,
    storeId: 'store1',
    isActive: true
  },
  {
    id: 'keyword3',
    keyword: '동탄장어맛집',
    monthlySearchVolume: 1540,
    mobileVolume: 1410,
    pcVolume: 130,
    storeId: 'store1',
    isActive: true
  },
  {
    id: 'keyword4',
    keyword: '동탄역장어맛집',
    monthlySearchVolume: 280,
    mobileVolume: 260,
    pcVolume: 20,
    storeId: 'store1',
    isActive: true
  },
  {
    id: 'keyword5',
    keyword: '동탄민물장어',
    monthlySearchVolume: 40,
    mobileVolume: 30,
    pcVolume: 10,
    storeId: 'store1',
    isActive: true
  }
]
