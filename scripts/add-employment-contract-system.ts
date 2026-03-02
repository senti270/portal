import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc } from 'firebase/firestore'
import * as dotenv from 'dotenv'

dotenv.config()

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

async function addEmploymentContractSystem() {
  try {
    const system = {
      id: 'employment-contract',
      title: '근로계약서 작성',
      description: '지점별 근로계약서를 작성하고 서명할 수 있습니다.',
      icon: '📝',
      color: '#10B981',
      category: '업무관리',
      url: '/employment-contract',
      status: 'active',
      tags: ['근로계약서', '계약', '서명', '직원관리'],
      optimization: ['PC 최적화'],
      order: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const systemsRef = collection(db, 'systems')
    const docRef = await addDoc(systemsRef, system)
    console.log('✅ 근로계약서 작성 시스템이 추가되었습니다. ID:', docRef.id)
  } catch (error) {
    console.error('❌ 시스템 추가 중 오류:', error)
  }
}

addEmploymentContractSystem()

