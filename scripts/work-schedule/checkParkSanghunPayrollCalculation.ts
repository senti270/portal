import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import * as dotenv from 'dotenv'
// @ts-ignore - TypeScript 모듈 해석 문제 우회
import { PayrollCalculator, PayrollResult } from '../../utils/work-schedule/PayrollCalculator'

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

// PayrollCalculation과 동일한 로직: "HH:MM-HH:MM" 형태의 문자열을 시간(소수)로 변환
const parseTimeRangeToHoursForPayroll = (timeRange: string): number => {
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
      // 익일 근무 (예: 22:00-06:00)
      diffMinutes += 24 * 60
    }

    const hours = diffMinutes / 60
    // 소수점 4자리까지 유지해 부동소수점 오차 최소화
    return Math.round(hours * 10000) / 10000
  } catch (error) {
    console.error('parseTimeRangeToHoursForPayroll 오류:', error, 'timeRange:', timeRange)
    return 0
  }
}

async function main() {
  console.log('🔥 박상훈 2026-02 카페드로잉 동탄점 급여계산 로직 점검 시작...')

  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)

  // 하드코딩된 값들
  const month = '2026-02'
  const employeeId = 'BeZ3cnz1RylCMjTuUmgx' // 박상훈
  const branchName = '카페드로잉 동탄점'

  try {
    // 1. branchId 찾기
    const branchesSnap = await getDocs(collection(db, 'branches'))
    const branch = branchesSnap.docs.find(doc => doc.data().name === branchName)
    if (!branch) {
      console.log(`❌ 지점을 찾을 수 없습니다: ${branchName}`)
      return
    }
    const branchId = branch.id
    console.log(`\n📍 지점 정보: ${branchName} (branchId: ${branchId})`)

    // 2. employee 정보 찾기
    const employeesSnap = await getDocs(collection(db, 'employees'))
    const employee = employeesSnap.docs.find(doc => doc.id === employeeId)
    if (!employee) {
      console.log(`❌ 직원을 찾을 수 없습니다: ${employeeId}`)
      return
    }
    const employeeData = employee.data()
    console.log(`\n👤 직원 정보: ${employeeData.name} (${employeeId})`)
    console.log(`   - 급여타입: ${employeeData.salaryType}`)
    console.log(`   - 급여액: ${employeeData.salaryAmount}`)
    console.log(`   - 고용형태: ${employeeData.employmentType}`)

    // 3. workTimeComparisonResults에서 데이터 조회 (selectedBranchId 필터링 포함)
    const comparisonConstraints: any[] = [
      where('month', '==', month),
      where('employeeId', '==', employeeId),
      where('branchId', '==', branchId), // 🔥 selectedBranchId 필터링
    ]

    const comparisonQuery = query(
      collection(db, 'workTimeComparisonResults'),
      ...comparisonConstraints
    )
    const comparisonSnapshot = await getDocs(comparisonQuery)
    console.log(`\n📁 workTimeComparisonResults 조회 결과: ${comparisonSnapshot.docs.length}건`)
    console.log(`   조회 조건: month=${month}, employeeId=${employeeId}, branchId=${branchId}`)

    if (comparisonSnapshot.empty) {
      console.log('❌ workTimeComparisonResults 에서 데이터를 찾을 수 없습니다.')
      return
    }

    // 4. PayrollCalculation과 동일한 로직으로 데이터 처리
    const [year, monthNum] = month.split('-').map(Number)
    const monthStart = new Date(year, monthNum - 1, 1)
    const monthEnd = new Date(year, monthNum, 0, 23, 59, 59)

    // employeeId와 month로 필터링 후, 실제 날짜로도 필터링 (month 필드 오류 대비)
    const allSchedules = comparisonSnapshot.docs
      .map(doc => {
        const data = doc.data()
        const date = data.date?.toDate ? data.date.toDate() : new Date(data.date)

        // 근무시간비교 합계(138:16 등)와 동일하게 실근무시간을 재계산
        const rawActualWorkHours = data.actualWorkHours || 0
        const actualTimeRange = data.actualTimeRange || data.posTimeRange || ''
        const actualBreakTime = data.actualBreakTime ?? data.breakTime ?? 0

        let computedActualWorkHours = rawActualWorkHours
        if ((!computedActualWorkHours || computedActualWorkHours === 0) && actualTimeRange) {
          const rangeHours = parseTimeRangeToHoursForPayroll(actualTimeRange)
          computedActualWorkHours = Math.max(0, rangeHours - (actualBreakTime || 0))
        }

        return {
          employeeId: data.employeeId,
          date: date,
          actualWorkHours: computedActualWorkHours || 0,
          branchId: data.branchId,
          branchName: data.branchName,
          breakTime: actualBreakTime || 0,
          posTimeRange: data.posTimeRange || '',
          isManual: data.isManual || false,
          docId: doc.id
        }
      })
      .filter(schedule => {
        // 실제 날짜가 해당 월에 속하는지 확인
        const scheduleDate = new Date(schedule.date)
        const isInMonth = scheduleDate >= monthStart && scheduleDate <= monthEnd
        return isInMonth
      })

    console.log(`\n📊 날짜 필터링 후 스케줄 데이터: ${allSchedules.length}건`)
    const totalBeforeMerge = allSchedules.reduce((sum, s) => sum + (s.actualWorkHours || 0), 0)
    console.log(`   필터링 후 총 근무시간: ${totalBeforeMerge.toFixed(2)}h`)

    // 5. 같은 날짜/지점 기준으로 합산 (근무시간비교와 동일한 로직)
    const mergedByDateBranch = new Map<string, typeof allSchedules[number]>()

    for (const row of allSchedules) {
      const dateStr = row.date.toISOString().split('T')[0]
      const key = `${dateStr}|${row.branchId || ''}`

      const existing = mergedByDateBranch.get(key)
      if (!existing) {
        mergedByDateBranch.set(key, { ...row })
      } else {
        existing.actualWorkHours = (existing.actualWorkHours || 0) + (row.actualWorkHours || 0)
        existing.breakTime = (existing.breakTime || 0) + (row.breakTime || 0)
        if (row.isManual) {
          existing.isManual = true
        }
      }
    }

    const schedulesToUse = Array.from(mergedByDateBranch.values()).map(({ docId, posTimeRange, isManual, ...rest }) => rest)

    console.log(`\n📊 중복 합산 후 스케줄 데이터: ${schedulesToUse.length}건`)
    const totalAfterMerge = schedulesToUse.reduce((sum, s) => sum + (s.actualWorkHours || 0), 0)
    console.log(`   합산 후 총 근무시간: ${totalAfterMerge.toFixed(2)}h`)
    if (allSchedules.length !== schedulesToUse.length) {
      console.log(`   중복 데이터 합산: ${allSchedules.length}건 → ${schedulesToUse.length}건`)
    }

    // 6. PayrollCalculator에 전달할 scheduleData 형식으로 변환
    const scheduleData = schedulesToUse.map(schedule => ({
      date: schedule.date,
      actualWorkHours: schedule.actualWorkHours,
      branchId: schedule.branchId,
      branchName: schedule.branchName
    }))

    console.log(`\n📊 PayrollCalculator에 전달되는 scheduleData: ${scheduleData.length}건`)
    const totalScheduleData = scheduleData.reduce((sum, s) => sum + (s.actualWorkHours || 0), 0)
    console.log(`   총 근무시간: ${totalScheduleData.toFixed(2)}h`)
    console.log(`   일자별 상세:`)
    scheduleData.forEach(s => {
      console.log(`     - ${s.date.toISOString().split('T')[0]}: ${s.actualWorkHours.toFixed(2)}h (${s.branchName})`)
    })

    // 7. employmentContracts 로드 (중도 계약 변경 처리)
    const contractsSnapshot = await getDocs(
      query(collection(db, 'employmentContracts'), where('employeeId', '==', employeeId))
    )

    const allContracts = contractsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((c: any) => c.startDate)
      .map((c: any) => {
        let startDate: Date
        if (c.startDate?.toDate) {
          const date = c.startDate.toDate()
          startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
        } else if (c.startDate instanceof Date) {
          startDate = new Date(c.startDate.getFullYear(), c.startDate.getMonth(), c.startDate.getDate(), 0, 0, 0, 0)
        } else {
          const date = new Date(c.startDate)
          startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
        }
        return { ...c, startDate }
      })
      .sort((a: any, b: any) => a.startDate.getTime() - b.startDate.getTime())

    const contracts = allContracts.filter((c: any, index: number) => {
      const contractStart = c.startDate
      const contractEnd = index < allContracts.length - 1
        ? new Date(allContracts[index + 1].startDate.getTime() - 1)
        : monthEnd
      return contractStart <= monthEnd && contractEnd >= monthStart
    })

    console.log(`\n📄 employmentContracts: ${contracts.length}건 (선택된 월: ${month})`)
    if (contracts.length > 0) {
      contracts.forEach((c: any, idx: number) => {
        const contractEnd = idx < contracts.length - 1
          ? new Date(contracts[idx + 1].startDate.getTime() - 1)
          : monthEnd
        console.log(`   [${idx}] ${c.startDate.toISOString().split('T')[0]} ~ ${contractEnd.toISOString().split('T')[0]}, 급여타입: ${c.salaryType}, 급여액: ${c.salaryAmount}`)
      })
    }

    // 8. PayrollCalculator 실행
    const contract = contracts.length > 0 ? contracts[contracts.length - 1] : null

    const employeeDataForCalc = {
      id: employeeId,
      name: employeeData.name,
      employmentType: contract?.employmentType || employeeData.employmentType,
      salaryType: contract?.salaryType || employeeData.salaryType,
      salaryAmount: contract?.salaryAmount || employeeData.salaryAmount,
      probationStartDate: employeeData.probationStartDate?.toDate ? employeeData.probationStartDate.toDate() : employeeData.probationStartDate,
      probationEndDate: employeeData.probationEndDate?.toDate ? employeeData.probationEndDate.toDate() : employeeData.probationEndDate,
      includesWeeklyHolidayInWage: contract?.includeHolidayAllowance ?? employeeData.includesWeeklyHolidayInWage,
      weeklyWorkHours: contract?.weeklyWorkHours || employeeData.weeklyWorkHours || 40
    }

    const contractDataForCalc = {
      employmentType: contract?.employmentType || employeeData.employmentType,
      salaryType: contract?.salaryType || employeeData.salaryType || 'hourly',
      salaryAmount: contract?.salaryAmount || employeeData.salaryAmount || 0,
      weeklyWorkHours: contract?.weeklyWorkHours || employeeData.weeklyWorkHours || 40,
      includeHolidayAllowance: contract?.includeHolidayAllowance ?? employeeData.includesWeeklyHolidayInWage
    }

    console.log(`\n🔧 PayrollCalculator 입력 데이터:`)
    console.log(`   employeeData:`, employeeDataForCalc)
    console.log(`   contractData:`, contractDataForCalc)
    console.log(`   scheduleData: ${scheduleData.length}건, 총 ${totalScheduleData.toFixed(2)}h`)

    const calculator = new PayrollCalculator(employeeDataForCalc, contractDataForCalc, scheduleData)
    const result = calculator.calculate()

    console.log(`\n✅ PayrollCalculator 계산 결과:`)
    console.log(`   - totalWorkHours: ${result.totalWorkHours.toFixed(2)}h`)
    console.log(`   - actualWorkHours: ${result.actualWorkHours.toFixed(2)}h`)
    console.log(`   - grossPay: ${result.grossPay.toLocaleString()}원`)
    console.log(`   - netPay: ${result.netPay.toLocaleString()}원`)
    console.log(`   - branches:`)
    result.branches.forEach(branch => {
      console.log(`     * ${branch.branchName} (${branch.branchId}): ${branch.workHours.toFixed(2)}h`)
    })

    console.log(`\n🎯 핵심 비교:`)
    console.log(`   - workTimeComparisonResults 총합: ${totalAfterMerge.toFixed(2)}h (${(totalAfterMerge * 60).toFixed(0)}분)`)
    console.log(`   - PayrollCalculator.actualWorkHours: ${result.actualWorkHours.toFixed(2)}h (${(result.actualWorkHours * 60).toFixed(0)}분)`)
    console.log(`   - PayrollCalculator.branches[0].workHours: ${result.branches[0]?.workHours.toFixed(2)}h (${(result.branches[0]?.workHours * 60 || 0).toFixed(0)}분)`)
    console.log(`   - 화면에 표시되는 값 (예상): ${result.branches[0]?.workHours.toFixed(2)}h`)

    if (Math.abs(result.branches[0]?.workHours - 20.5) < 0.1) {
      console.log(`\n⚠️  발견! branches[0].workHours가 20.5h와 유사합니다.`)
      console.log(`   이 값이 화면에 표시되는 20.5h의 원인일 가능성이 높습니다.`)
    }

  } catch (error) {
    console.error('❌ 점검 중 오류:', error)
    if (error instanceof Error) {
      console.error('   에러 메시지:', error.message)
      console.error('   스택:', error.stack)
    }
  }
}

main().then(() => {
  console.log('\n✅ checkParkSanghunPayrollCalculation 스크립트 종료')
  process.exit(0)
})

