import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
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

const toHHMM = (hours: number) => {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

async function main() {
  console.log('🔥 박상훈 2026-02 confirmedPayrolls 기록 점검 시작...')

  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)

  // 하드코딩된 값들 (필요 시 수정)
  const month = '2026-02'
  const employeeId = 'BeZ3cnz1RylCMjTuUmgx' // 이전 스크립트에서 확인한 박상훈 id

  try {
    const snap = await getDocs(
      query(
        collection(db, 'confirmedPayrolls'),
        where('employeeId', '==', employeeId),
        where('month', '==', month)
      )
    )

    if (snap.empty) {
      console.log('✅ confirmedPayrolls 에는 박상훈 2026-02 데이터가 없습니다.')
      return
    }

    console.log(`⚠️ confirmedPayrolls 에 박상훈 2026-02 문서가 ${snap.docs.length}개 있습니다.`)

    snap.docs.forEach((docSnap, idx) => {
      const data: any = docSnap.data()
      console.log(`\n=== 문서 ${idx + 1} ID: ${docSnap.id} ===`)
      console.log('기본 필드:', {
        employeeId: data.employeeId,
        employeeName: data.employeeName,
        month: data.month,
        branchId: data.branchId,
        branchName: data.branchName,
        totalWorkHours: data.totalWorkHours,
        actualWorkHours: data.actualWorkHours,
        grossPay: data.grossPay,
        netPay: data.netPay,
      })

      const calcs: any[] = data.calculations || []
      console.log(`calculations 배열 길이: ${calcs.length}`)

      calcs.forEach((c, i) => {
        console.log(`  - calc[${i}] 요약:`, {
          employmentType: c.employmentType,
          salaryType: c.salaryType,
          salaryAmount: c.salaryAmount,
          totalWorkHours: c.totalWorkHours,
          actualWorkHours: c.actualWorkHours,
          branches: (c.branches || []).map((b: any) => ({
            branchName: b.branchName,
            workHours: `${b.workHours}h (${toHHMM(b.workHours || 0)})`,
          })),
        })
      })
    })

    console.log('\n🎯 위 값들(especially actualWorkHours / branches.workHours)이 화면 20.5h와 일치하는지 비교해 보면 됩니다.')
  } catch (error) {
    console.error('❌ confirmedPayrolls 점검 중 오류:', error)
  }
}

main().then(() => {
  console.log('\n✅ checkParkSanghunConfirmedPayroll 스크립트 종료')
  process.exit(0)
})


