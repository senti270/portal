// Firebase에 시스템 로그인 정보 메뉴 추가 스크립트
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'
import dotenv from 'dotenv'

// 환경변수 로드
dotenv.config({ path: '.env.local' })

// Firebase 설정
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

async function addSystemLoginMenu() {
  try {
    const newSystem = {
      id: 'system-login',
      title: '시스템 로그인 정보',
      description: '각 지점별 시스템 로그인 정보를 관리합니다.',
      icon: '🔐',
      color: '#EF4444',
      category: '운영',
      url: '/system-login',
      status: 'active',
      tags: ['로그인', '계정', '비밀번호'],
      optimization: ['PC 최적화', '모바일 최적화'],
      order: 8,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await setDoc(doc(db, 'systems', 'system-login'), newSystem)
    console.log('✅ 시스템 로그인 정보 메뉴가 성공적으로 추가되었습니다!')
    console.log('📋 추가된 시스템:', newSystem)
  } catch (error) {
    console.error('❌ 시스템 추가 실패:', error)
    process.exit(1)
  }
}

addSystemLoginMenu()
  .then(() => {
    console.log('✅ 완료!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 오류 발생:', error)
    process.exit(1)
  })

