// Firebase에 매뉴얼 관리 시스템 추가 스크립트
const { initializeApp } = require('firebase/app')
const { getFirestore, doc, setDoc } = require('firebase/firestore')

const firebaseConfig = {
  apiKey: "AIzaSyDIE3u9br03vyv7mi8ijfiGMF9i2j5pZf8",
  authDomain: "cdcdcd-portal.firebaseapp.com",
  projectId: "cdcdcd-portal",
  storageBucket: "cdcdcd-portal.firebasestorage.app",
  messagingSenderId: "1061692551278",
  appId: "1:1061692551278:web:a5c0a8c8f1084bb6eb7869"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function addManualSystem() {
  try {
    console.log('🚀 매뉴얼 관리 시스템 추가 시작...')
    
    const newSystem = {
      id: 'manual-management',
      title: '매뉴얼 관리',
      description: '매장별 매뉴얼을 관리하고 조회할 수 있습니다.',
      icon: '📚',
      color: '#8B5CF6',
      category: '업무관리',
      url: '/manual-viewer',
      status: 'active',
      tags: ['매뉴얼', '가이드', '도움말'],
      optimization: ['PC 최적화', '모바일 최적화'],
      order: 7,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    console.log('📝 시스템 데이터 준비 완료:', newSystem.title)
    console.log('🔥 Firestore에 저장 중...')
    
    await setDoc(doc(db, 'systems', 'manual-management'), newSystem)
    
    console.log('✅ 매뉴얼 관리 시스템이 성공적으로 추가되었습니다!')
    console.log('📊 시스템 정보:')
    console.log('  - ID:', newSystem.id)
    console.log('  - 제목:', newSystem.title)
    console.log('  - URL:', newSystem.url)
    console.log('  - 순서:', newSystem.order)
    console.log('  - 상태:', newSystem.status)
    
    process.exit(0)
  } catch (error) {
    console.error('❌ 시스템 추가 실패:', error)
    process.exit(1)
  }
}

addManualSystem()
