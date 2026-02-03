import { collection, getDocs, doc, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';

async function fixSanjitaToGoYoungGeum() {
  try {
    console.log('🔥 "산지타"를 "고영금"으로 변경 시작...');
    
    // "산지타"로 저장된 스케줄 찾기
    const schedulesQuery = query(
      collection(db, 'schedules'),
      where('employeeName', '==', '산지타')
    );
    
    const schedulesSnapshot = await getDocs(schedulesQuery);
    const schedules = schedulesSnapshot.docs.map(doc => ({
      id: doc.id,
      employeeId: doc.data().employeeId,
      employeeName: doc.data().employeeName,
      branchId: doc.data().branchId,
      branchName: doc.data().branchName,
      date: doc.data().date,
      ...doc.data()
    }));
    
    console.log(`🔥 "산지타"로 저장된 스케줄 개수: ${schedules.length}`);
    
    if (schedules.length === 0) {
      console.log('✅ "산지타"로 저장된 스케줄이 없습니다.');
      return;
    }
    
    // employeeId 확인
    const employeeIds = new Set(schedules.map(s => s.employeeId));
    console.log(`🔥 발견된 employeeId 개수: ${employeeIds.size}`);
    console.log(`🔥 employeeId 목록:`, Array.from(employeeIds));
    
    // "고영금"으로 저장된 스케줄도 확인
    const goYoungGeumQuery = query(
      collection(db, 'schedules'),
      where('employeeName', '==', '고영금')
    );
    const goYoungGeumSnapshot = await getDocs(goYoungGeumQuery);
    const goYoungGeumSchedules = goYoungGeumSnapshot.docs.map(doc => ({
      id: doc.id,
      employeeId: doc.data().employeeId,
      employeeName: doc.data().employeeName
    }));
    
    // 같은 employeeId를 가진 "고영금" 스케줄 확인
    const sameEmployeeIdSchedules = goYoungGeumSchedules.filter(s => 
      Array.from(employeeIds).includes(s.employeeId)
    );
    
    console.log(`🔥 같은 employeeId를 가진 "고영금" 스케줄: ${sameEmployeeIdSchedules.length}개`);
    
    if (sameEmployeeIdSchedules.length > 0) {
      console.log('✅ 같은 employeeId를 가진 "고영금" 스케줄이 있습니다. employeeId:', sameEmployeeIdSchedules[0].employeeId);
    }
    
    // 상세 정보 출력
    console.log('\n🔥 수정할 스케줄들:');
    schedules.forEach((schedule, index) => {
      console.log(`${index + 1}. ID: ${schedule.id}`);
      console.log(`   직원ID: ${schedule.employeeId}`);
      console.log(`   현재이름: ${schedule.employeeName}`);
      console.log(`   지점: ${schedule.branchName}`);
      console.log(`   날짜: ${schedule.date}`);
      console.log('   ---');
    });
    
    // 확인 후 업데이트
    console.log(`\n🔥 총 ${schedules.length}개의 스케줄을 "고영금"으로 변경합니다.`);
    
    // 배치 업데이트 (최대 500개씩)
    const batch = writeBatch(db);
    let batchCount = 0;
    
    for (const schedule of schedules) {
      batch.update(doc(db, 'schedules', schedule.id), {
        employeeName: '고영금'
      });
      batchCount++;
      
      // Firestore 배치 제한 (500개)에 도달하면 커밋
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`✅ ${batchCount}개 문서 업데이트 완료`);
        batchCount = 0;
      }
    }
    
    // 남은 문서들 커밋
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ ${batchCount}개 문서 업데이트 완료`);
    }
    
    console.log(`\n🎉 총 ${schedules.length}개의 스케줄이 "고영금"으로 변경되었습니다.`);
    
  } catch (error) {
    console.error('오류 발생:', error);
  }
}

fixSanjitaToGoYoungGeum();

