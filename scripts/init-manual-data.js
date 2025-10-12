const { initializeApp } = require('firebase/app')
const { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs,
  serverTimestamp 
} = require('firebase/firestore')

// Firebase 설정
const firebaseConfig = {
  // 여기에 실제 Firebase 설정을 추가하세요
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// 기본 지점 데이터
const defaultStores = [
  {
    id: 'all',
    name: '전지점'
  },
  {
    id: 'cheongdam-dongtan',
    name: '청담장어마켓동탄점'
  },
  {
    id: 'cafe-drawing-seokchon',
    name: '카페드로잉 석촌호수점'
  },
  {
    id: 'cafe-drawing-jeongja',
    name: '카페드로잉정자점'
  }
]

async function initDefaultStores() {
  try {
    console.log('기본 지점 데이터 초기화 시작...')
    
    for (const store of defaultStores) {
      const docRef = doc(db, 'stores', store.id)
      await setDoc(docRef, {
        name: store.name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      console.log(`지점 추가됨: ${store.name}`)
    }
    
    console.log('기본 지점 데이터 초기화 완료!')
  } catch (error) {
    console.error('초기화 실패:', error)
  }
}

async function checkExistingStores() {
  try {
    const querySnapshot = await getDocs(collection(db, 'stores'))
    
    if (querySnapshot.empty) {
      console.log('기존 지점 데이터가 없습니다. 초기화를 진행합니다.')
      await initDefaultStores()
    } else {
      console.log('기존 지점 데이터가 있습니다. 초기화를 건너뜁니다.')
      querySnapshot.forEach(doc => {
        console.log(`기존 지점: ${doc.data().name}`)
      })
    }
  } catch (error) {
    console.error('기존 데이터 확인 실패:', error)
  }
}

// 실행
checkExistingStores()
