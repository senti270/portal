import { initializeApp } from 'firebase/app'
import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore'
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
  console.log('🔥 박상훈 employeeId 일관성 점검 시작...')

  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)

  try {
    // 1. employees 컬렉션에서 박상훈 찾기
    const employeesSnap = await getDocs(
      query(collection(db, 'employees'), where('name', '==', '박상훈'))
    )

    if (employeesSnap.empty) {
      console.log('❌ employees 컬렉션에서 "박상훈"을 찾을 수 없습니다.')
      return
    }

    const employeeIds = employeesSnap.docs.map(doc => doc.id)
    console.log('✅ employees 컬렉션 "박상훈" 문서들:')
    employeesSnap.docs.forEach(doc => {
      console.log(`  - id: ${doc.id}, branchId: ${doc.data().primaryBranchId || doc.data().branchId || '없음'}`)
    })

    // 2. employmentContracts 에서 박상훈 계약 확인
    console.log('\n📁 employmentContracts 컬렉션 확인...')
    const contractsSnap = await getDocs(
      query(collection(db, 'employmentContracts'), where('employeeName', '==', '박상훈'))
    )
    if (contractsSnap.empty) {
      console.log('  ⚠️ employeeName=="박상훈" 계약 없음')
    } else {
      contractsSnap.docs.forEach(doc => {
        const data = doc.data() as any
        console.log(`  - id: ${doc.id}, employeeId: ${data.employeeId || '없음'}, salaryType: ${data.salaryType}, startDate: ${data.startDate?.toDate?.().toISOString().split('T')[0] || data.startDate}`)
      })
    }

    // 3. workTimeComparisonResults 에서 박상훈 데이터 확인
    console.log('\n📁 workTimeComparisonResults 컬렉션 확인 (employeeName / employeeId 기준)...')
    const wtcByNameSnap = await getDocs(
      query(collection(db, 'workTimeComparisonResults'), where('employeeName', '>=', '박상훈'), where('employeeName', '<=', '박상훈\uffff'))
    )
    console.log(`  - employeeName에 "박상훈" 포함 문서 수: ${wtcByNameSnap.docs.length}`)
    wtcByNameSnap.docs.slice(0, 20).forEach(doc => {
      const data = doc.data() as any
      console.log(`    • id: ${doc.id}, employeeId: ${data.employeeId || '없음'}, employeeName: ${data.employeeName}, branchId: ${data.branchId}, month: ${data.month}, date: ${data.date?.toDate?.().toISOString().split('T')[0] || data.date}`)
    })

    // 4. schedules 에서 employeeId 매칭 여부 확인
    console.log('\n📁 schedules 컬렉션 확인 (employees 의 id 기준)...')
    for (const empId of employeeIds) {
      const schedulesSnap = await getDocs(
        query(collection(db, 'schedules'), where('employeeId', '==', empId))
      )
      console.log(`  - employeeId=${empId} 인 schedules 문서 수: ${schedulesSnap.docs.length}`)
      const sample = schedulesSnap.docs.slice(0, 5)
      sample.forEach(doc => {
        const data = doc.data() as any
        console.log(`    • id: ${doc.id}, date: ${data.date?.toDate?.().toISOString().split('T')[0] || data.date}, branchId: ${data.branchId}`)
      })
    }

    console.log('\n🎉 박상훈 관련 employeeId 점검 완료')
  } catch (error) {
    console.error('❌ 점검 중 오류:', error)
  }
}

main().then(() => {
  console.log('✅ checkParkSanghunIds 스크립트 종료')
  process.exit(0)
})


