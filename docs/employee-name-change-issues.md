# 직원 이름 변경 시 발생할 수 있는 문제점

## 현재 상황

`EmployeeManagement.tsx`의 `handleSubmit` 함수에서 직원 정보를 수정할 때, `employees` 컬렉션만 업데이트하고 있습니다. 하지만 `employeeName` 필드는 여러 다른 컬렉션에도 중복 저장(denormalized)되어 있어 데이터 불일치가 발생할 수 있습니다.

## employeeName이 저장되는 컬렉션들

1. **schedules** - 스케줄 데이터
2. **workTimeComparisonResults** - 근무시간 비교 결과
3. **confirmedPayrolls** - 확정된 급여
4. **employeeReviewStatus** - 직원 검토 상태
5. **attendanceRecords** - 출퇴근 기록 (새로 추가)
6. **overtimeRecords** - 초과근무 기록
7. **employeeMemos** - 직원 메모
8. **actualWorkRecords** - 실제 근무 기록

## 발생할 수 있는 문제

1. **데이터 불일치**: `employees` 컬렉션의 이름은 변경되었지만, 다른 컬렉션의 `employeeName` 필드는 오래된 이름으로 남아있음
2. **화면 표시 오류**: 스케줄, 급여, 근무시간 비교 등에서 오래된 이름이 표시될 수 있음
3. **검색/필터링 문제**: `employeeName` 필드로 검색할 때 새로운 이름으로 검색하면 오래된 이름의 데이터가 검색되지 않음
4. **리포트 오류**: 급여명세서, 세무 파일 등에서 오래된 이름이 표시될 수 있음

## 해결 방안

### 옵션 1: 이름 변경 시 관련 컬렉션도 함께 업데이트 (권장)

`handleSubmit` 함수에서 이름이 변경되었는지 확인하고, 변경된 경우 관련 컬렉션들의 `employeeName` 필드도 업데이트합니다.

**장점**:
- 데이터 일관성 유지
- 즉시 모든 데이터가 동기화됨

**단점**:
- 이름 변경 시 많은 문서를 업데이트해야 하므로 성능 이슈 가능
- Firestore 배치 제한(500개) 고려 필요

### 옵션 2: 읽기 시 employees 컬렉션에서 이름 조회

모든 조회에서 `employeeName` 필드 대신 `employeeId`로 `employees` 컬렉션에서 이름을 조회합니다.

**장점**:
- 데이터 중복 제거
- 이름 변경 시 업데이트 불필요

**단점**:
- 모든 조회 로직 수정 필요 (큰 리팩토링)
- 조회 성능 저하 가능 (추가 조회 필요)

### 옵션 3: Cloud Functions를 통한 자동 업데이트

`employees` 컬렉션의 이름이 변경되면 Cloud Functions로 관련 컬렉션들을 자동 업데이트합니다.

**장점**:
- 클라이언트 코드 간소화
- 백그라운드에서 처리 가능

**단점**:
- Cloud Functions 설정 필요
- 추가 비용 발생 가능

## 권장 구현 방식 (옵션 1)

```typescript
// EmployeeManagement.tsx의 handleSubmit 함수에서

if (editingEmployee) {
  const oldName = editingEmployee.name;
  const newName = formData.name;
  
  // employees 컬렉션 업데이트
  await updateDoc(employeeRef, updateData);
  
  // 이름이 변경된 경우 관련 컬렉션도 업데이트
  if (oldName !== newName) {
    await updateEmployeeNameInAllCollections(editingEmployee.id, oldName, newName);
  }
  
  // 직원-지점 관계 업데이트
  await updateEmployeeBranches(editingEmployee.id, selectedBranches);
}
```

## 업데이트해야 할 컬렉션 목록

1. schedules (employeeId 기준)
2. workTimeComparisonResults (employeeId 기준)
3. confirmedPayrolls (employeeId 기준)
4. employeeReviewStatus (employeeId 기준)
5. attendanceRecords (employeeId 기준) - 새로 추가
6. overtimeRecords (employeeId 기준)
7. employeeMemos (employeeId 기준)
8. actualWorkRecords (employeeId 기준)

## 주의사항

1. **배치 업데이트**: Firestore 배치 제한(500개)을 고려하여 배치 단위로 업데이트
2. **트랜잭션**: 가능한 경우 트랜잭션을 사용하여 원자성 보장
3. **에러 처리**: 일부 컬렉션 업데이트 실패 시에도 나머지는 업데이트되도록 처리
4. **성능**: 많은 데이터가 있는 경우 업데이트 시간이 오래 걸릴 수 있음
5. **확정된 급여**: `confirmedPayrolls`의 경우 이미 확정된 데이터이므로 업데이트 여부를 확인해야 함

