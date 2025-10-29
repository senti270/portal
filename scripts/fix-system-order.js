const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

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

async function fixSystemOrder() {
  try {
    console.log('🔍 Firebase에서 시스템 조회 중...');
    const systemsRef = collection(db, 'systems');
    const snapshot = await getDocs(systemsRef);
    
    console.log(`📊 총 ${snapshot.size}개의 시스템 발견\n`);
    
    const systems = [];
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      systems.push({
        id: docSnapshot.id,
        title: data.title,
        order: data.order,
        status: data.status,
        createdAt: data.createdAt
      });
    });

    // order가 없는 시스템 찾기
    const systemsWithoutOrder = systems.filter(s => s.order === undefined || s.order === null);
    const systemsWithOrder = systems.filter(s => s.order !== undefined && s.order !== null);

    console.log('✅ order가 있는 시스템:', systemsWithOrder.length, '개');
    console.log('❌ order가 없는 시스템:', systemsWithoutOrder.length, '개\n');

    if (systemsWithoutOrder.length === 0) {
      console.log('🎉 모든 시스템에 order가 있습니다!');
      process.exit(0);
    }

    // 현재 상태 출력
    console.log('📋 현재 시스템 목록:');
    systems.forEach((s, index) => {
      console.log(`  ${index + 1}. ${s.title} - order: ${s.order ?? 'MISSING'} - status: ${s.status}`);
    });

    console.log('\n🔧 order 수정 시작...\n');

    // order가 있는 시스템들을 order 기준으로 정렬
    systemsWithOrder.sort((a, b) => a.order - b.order);

    // 모든 시스템을 createdAt 기준으로 정렬 (order가 없는 것들의 순서 결정)
    systems.sort((a, b) => {
      // order가 둘 다 있으면 order로 정렬
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      // a만 order가 있으면 a를 앞으로
      if (a.order !== undefined) return -1;
      // b만 order가 있으면 b를 앞으로
      if (b.order !== undefined) return 1;
      // 둘 다 없으면 생성일 기준
      if (a.createdAt && b.createdAt) {
        return a.createdAt.seconds - b.createdAt.seconds;
      }
      return 0;
    });

    // 모든 시스템에 순차적으로 order 부여
    for (let i = 0; i < systems.length; i++) {
      const system = systems[i];
      const newOrder = i;
      
      if (system.order !== newOrder) {
        const systemRef = doc(db, 'systems', system.id);
        await updateDoc(systemRef, { order: newOrder });
        console.log(`✅ ${system.title}: order ${system.order ?? 'NONE'} → ${newOrder}`);
      } else {
        console.log(`⏭️  ${system.title}: order ${newOrder} (변경 없음)`);
      }
    }

    console.log('\n🎉 모든 시스템의 order가 수정되었습니다!');
    console.log('\n📋 최종 순서:');
    systems.forEach((s, index) => {
      console.log(`  ${index + 1}. ${s.title} - order: ${index}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

fixSystemOrder();





