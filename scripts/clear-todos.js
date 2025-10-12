const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDIE3u9br03vyv7mi8ijfiGMF9i2j5pZf8",
  authDomain: "cdcdcd-portal.firebaseapp.com",
  projectId: "cdcdcd-portal",
  storageBucket: "cdcdcd-portal.firebasestorage.app",
  messagingSenderId: "1061692551278",
  appId: "1:1061692551278:web:a5c0a8c8f1084bb6eb7869"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearTodos() {
  try {
    console.log('🗑️  TODO 컬렉션 삭제 시작...');
    const todosRef = collection(db, 'todos');
    const snapshot = await getDocs(todosRef);
    
    console.log(`📊 삭제할 문서 개수: ${snapshot.size}`);
    
    const deletePromises = [];
    snapshot.forEach((doc) => {
      console.log(`🗑️  삭제 중: ${doc.id}`);
      deletePromises.push(deleteDoc(doc.ref));
    });
    
    await Promise.all(deletePromises);
    console.log('✅ 모든 TODO가 삭제되었습니다!');
    process.exit(0);
  } catch (error) {
    console.error('❌ 삭제 오류:', error);
    process.exit(1);
  }
}

clearTodos();


