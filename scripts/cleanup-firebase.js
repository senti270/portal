// Firebase 컬렉션 정리 스크립트
// 이 스크립트는 Node.js에서 실행하여 Firebase 컬렉션을 정리합니다.

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  // 여기에 실제 Firebase 설정을 입력하세요
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanupSystems() {
  try {
    console.log('🔍 Systems 컬렉션 정리 시작...');
    
    const systemsRef = collection(db, 'systems');
    const snapshot = await getDocs(systemsRef);
    
    console.log(`📊 총 ${snapshot.docs.length}개의 문서 발견`);
    
    // 모든 문서 삭제
    for (const docSnapshot of snapshot.docs) {
      await deleteDoc(doc(db, 'systems', docSnapshot.id));
      console.log(`🗑️ 삭제됨: ${docSnapshot.id}`);
    }
    
    console.log('✅ Systems 컬렉션 정리 완료!');
  } catch (error) {
    console.error('❌ 정리 중 오류:', error);
  }
}

// 스크립트 실행
cleanupSystems();




