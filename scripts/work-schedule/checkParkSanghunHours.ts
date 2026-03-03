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

// 근무시간비교 합계 계산에 사용하는 로직과 동일한 방식으로 시간 범위를 시간(소수)로 변환
const parseTimeRangeToHours = (timeRange: string | undefined | null): number => {
  if (!timeRange || timeRange === '-' || !timeRange.includes('-')) {
    return 0
  }

  try {
    const [startTime, endTime] = timeRange.split('-')
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)

    const startMinutes = startHour * 60 + startMinute
    const endMinutes = endHour * 60 + endMinute

    let diffMinutes = endMinutes - startMinutes
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60
    }

    const hours = diffMinutes / 60
    return Math.round(hours * 10000) / 10000
  } catch (error) {
    console.error('parseTimeRangeToHours 오류:', error, 'timeRange:', timeRange)
    return 0
  }
}

async function main() {
  console.log('🔥 박상훈 2026-02 카페드로잉 동탄점 근무시간 비교 vs 급여계산 로직 점검 시작...')

  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)

  // 하드코딩된 값들 (필요하면 수정 가능)
  const month = '2026-02'
  const employeeName = '박상훈 (카페드로잉 동탄점)'

  try {
    // 1. workTimeComparisonResults에서 박상훈(동탄점) 2월 데이터 조회
    const wtcSnap = await getDocs(
      query(
        collection(db, 'workTimeComparisonResults'),
        where('month', '==', month),
        where('employeeName', '==', employeeName)
      )
    )

    if (wtcSnap.empty) {
      console.log('❌ workTimeComparisonResults 에서 데이터를 찾을 수 없습니다.')
      return
    }

    console.log(`\n📁 workTimeComparisonResults "${employeeName}", month=${month} 문서 수: ${wtcSnap.docs.length}`)

    type Row = {
      id: string
      dateStr: string
      branchId: string
      branchName: string
      scheduledHours: number
      actualHours: number
      actualTimeRange: string
      actualBreakTime: number
      actualWorkHoursStored: number
      actualWorkHoursRecalc: number
    }

    const rows: Row[] = []

    wtcSnap.docs.forEach(docSnap => {
      const data: any = docSnap.data()
      const date = data.date?.toDate ? data.date.toDate() : new Date(data.date)
      const dateStr = date.toISOString().split('T')[0]

      const scheduledHours: number = data.scheduledHours || 0
      const actualHours: number = data.actualHours || 0
      const actualTimeRange: string = data.actualTimeRange || data.posTimeRange || ''
      const actualBreakTime: number = data.actualBreakTime ?? data.breakTime ?? 0
      const actualWorkHoursStored: number = data.actualWorkHours || 0

      // 근무시간비교 합계에서 쓰는 방식: actualTimeRange - actualBreakTime
      const timeRangeHours = parseTimeRangeToHours(actualTimeRange)
      const actualWorkHoursRecalc = Math.max(0, timeRangeHours - (actualBreakTime || 0))

      rows.push({
        id: docSnap.id,
        dateStr,
        branchId: data.branchId,
        branchName: data.branchName,
        scheduledHours,
        actualHours,
        actualTimeRange,
        actualBreakTime,
        actualWorkHoursStored,
        actualWorkHoursRecalc,
      })
    })

    // 날짜순 정렬
    rows.sort((a, b) => a.dateStr.localeCompare(b.dateStr))

    console.log('\n📊 일자별 상세 (근무시간비교 기준 vs 급여계산 기준):')
    rows.forEach(r => {
      console.log(
        `- ${r.dateStr} | branch=${r.branchName} | scheduled=${r.scheduledHours.toFixed(2)}h | ` +
        `actualTimeRange="${r.actualTimeRange}" | break=${r.actualBreakTime}h | ` +
        `stored actualWorkHours=${r.actualWorkHoursStored.toFixed(2)}h | ` +
        `recalc=${r.actualWorkHoursRecalc.toFixed(2)}h`
      )
    })

    // 합계 계산
    const totalScheduled = rows.reduce((sum, r) => sum + r.scheduledHours, 0)
    const totalActualTimeRange = rows.reduce((sum, r) => sum + parseTimeRangeToHours(r.actualTimeRange), 0)
    const totalBreak = rows.reduce((sum, r) => sum + (r.actualBreakTime || 0), 0)
    const totalActualWorkStored = rows.reduce((sum, r) => sum + (r.actualWorkHoursStored || 0), 0)
    const totalActualWorkRecalc = rows.reduce((sum, r) => sum + r.actualWorkHoursRecalc, 0)

    const toHHMM = (hours: number) => {
      const h = Math.floor(hours)
      const m = Math.round((hours - h) * 60)
      return `${h}:${m.toString().padStart(2, '0')}`
    }

    console.log('\n===== 합계 비교 =====')
    console.log(`스케줄시간 합계 (A): ${totalScheduled.toFixed(2)}h (${toHHMM(totalScheduled)})`)
    console.log(`실근무시각(B) = actualTimeRange 합계: ${totalActualTimeRange.toFixed(2)}h (${toHHMM(totalActualTimeRange)})`)
    console.log(`실휴게시간(C) = actualBreakTime 합계: ${totalBreak.toFixed(2)}h (${toHHMM(totalBreak)})`)
    console.log(`근무시간비교 D=B-C 기준 재계산 합계: ${totalActualWorkRecalc.toFixed(2)}h (${toHHMM(totalActualWorkRecalc)})`)
    console.log(`DB 저장 actualWorkHours 합계: ${totalActualWorkStored.toFixed(2)}h (${toHHMM(totalActualWorkStored)})`)

    console.log('\n🎯 기대값(근무시간비교 화면 D열 합계)은 totalActualWorkRecalc,')
    console.log('   급여계산에서 쓰이는 값은 totalActualWorkStored 또는 재계산 로직과 비교하면 됩니다.')
  } catch (error) {
    console.error('❌ 점검 중 오류:', error)
  }
}

main().then(() => {
  console.log('\n✅ checkParkSanghunHours 스크립트 종료')
  process.exit(0)
})


