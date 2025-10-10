// Firebase에 네이버 순위 추적 시스템 추가 스크립트
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore'

// Firebase 설정 (환경변수에서 가져오기)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function addRankingSystem() {
  try {
    const newSystem = {
      id: 'ranking-tracker',
      title: '네이버 순위 추적',
      description: '스마트 플레이스 키워드별 노출 순위를 자동으로 추적하고 기록합니다.',
      icon: '📈',
      color: '#10B981',
      category: '마케팅',
      url: '/ranking-tracker',
      status: 'active',
      tags: ['SEO', '순위', '자동추적', '키워드'],
      optimization: ['PC 최적화', '모바일 최적화'],
      order: 6
    }

    await setDoc(doc(db, 'systems', 'ranking-tracker'), newSystem)
    console.log('✅ 네이버 순위 추적 시스템이 성공적으로 추가되었습니다!')
  } catch (error) {
    console.error('❌ 시스템 추가 실패:', error)
  }
}

addRankingSystem()
