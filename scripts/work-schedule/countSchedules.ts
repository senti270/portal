import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getCountFromServer } from 'firebase/firestore'
import * as dotenv from 'dotenv'

dotenv.config()

// Portal과 동일한 Firebase 설정 사용
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'portal-fc7ae.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'portal-fc7ae',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'portal-fc7ae.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:abcdef123456',
}

async function main() {
  console.log('🔥 schedules 컬렉션 문서 수 집계 시작...')

  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)

  try {
    const schedulesRef = collection(db, 'schedules')
    const snapshot = await getCountFromServer(schedulesRef)
    const count = snapshot.data().count

    console.log('========================================')
    console.log('📊 schedules 컬렉션 문서 수:')
    console.log(`➡️  총 ${count.toLocaleString('ko-KR')} 건`)
    console.log('========================================')
  } catch (error) {
    console.error('❌ schedules 문서 수 조회 중 오류:', error)
  }
}

main().then(() => {
  console.log('✅ countSchedules 스크립트 종료')
  process.exit(0)
})


