# 근로계약서 작성 기능 테스트 가이드

## 테스트 전 확인사항

### 1. 환경 설정
- [ ] Vercel 배포 완료 확인
- [ ] Firebase Storage 권한 확인
- [ ] Firestore 권한 확인

### 2. 테스트 데이터 준비
- [ ] 테스트용 지점 선택
- [ ] 테스트용 근로자 정보 준비 (실제 데이터 또는 테스트 데이터)

## 테스트 시나리오

### 시나리오 1: 새 직원 계약서 작성

#### 입력 데이터
1. **지점 선택**: 임의의 지점 선택
2. **근로자 정보**:
   - 성명: 테스트용 이름
   - 주민등록번호: 형식에 맞게 입력 (예: 000000-0000000)
   - 주소: 테스트 주소
   - 연락처: 형식에 맞게 입력 (예: 010-0000-0000)
3. **계약 정보**:
   - 근로개시일: 오늘 또는 미래 날짜
   - 계약일자: 오늘 날짜
   - 임금: 월급/일급/시급 중 선택
   - 급여액: 숫자 입력
   - 주휴수당 포함: 체크/해제
   - 지급방법: 현금 또는 계좌입금
   - 계좌번호: 계좌입금 선택 시 은행명 + 계좌번호 입력
   - 근무일: 요일 체크박스 선택
   - 수습기간: 기본값 1개월 (변경 가능)
   - 고용형태: 근로소득/사업소득/일용직/외국인 중 선택

#### 확인 포인트
- [ ] 모든 필수 필드 입력 후 "계약서 작성 완료" 버튼 클릭 가능
- [ ] 근로자 서명 완료
- [ ] 사업주 서명 완료
- [ ] "근로계약서가 성공적으로 작성되었습니다!" 메시지 표시
- [ ] 에러 없이 완료

### 시나리오 2: 기존 직원 계약서 작성

#### 입력 데이터
- 기존 직원의 이름과 주민등록번호로 작성

#### 확인 포인트
- [ ] 기존 직원 정보가 업데이트되는지 확인
- [ ] 새 계약서가 추가되는지 확인

## 데이터 확인 방법

### 1. Firestore 확인

**employmentContracts 컬렉션:**
```
- branchId: 선택한 지점 ID
- branchName: 선택한 지점 이름
- employeeInfo: { name, residentNumber, address, phone, email }
- contractInfo: {
    startDate: Timestamp
    employmentType: "근로소득" | "사업소득" | "일용직" | "외국인"
    salaryType: "hourly" | "monthly" | "daily"
    salaryAmount: number
    includesWeeklyHoliday: boolean
    ...
  }
- signatures: { employee, employer }
- contractFile: "https://firebasestorage.googleapis.com/..."
- contractFileName: "근로계약서_이름_타임스탬프.pdf"
- status: "signed"
```

**employees 컬렉션:**
```
- name: 근로자 이름
- residentNumber: 주민등록번호
- address: 주소
- phone: 연락처
- employmentType: 고용형태
- salaryType: 급여타입
- salaryAmount: 급여액
- includesWeeklyHolidayInWage: 주휴수당 포함 여부
- bankName: 은행명 (계좌입금인 경우)
- bankCode: 은행코드
- accountNumber: 계좌번호
- contractFile: PDF URL
- primaryBranchId: 대표 지점 ID
- primaryBranchName: 대표 지점 이름
- probationStartDate: 수습 시작일
- probationEndDate: 수습 종료일
- probationPeriod: 수습 기간 (개월)
- isOnProbation: true
```

**employeeBranches 컬렉션:**
```
- employeeId: 직원 ID
- branchId: 지점 ID
- branchName: 지점 이름
- role: "main"
- startDate: 계약 시작일
- isActive: true
```

### 2. Firebase Storage 확인

**contracts 폴더:**
- [ ] PDF 파일이 업로드되었는지 확인
- [ ] 파일명 형식: `{branchId}_{timestamp}.pdf`
- [ ] 파일 다운로드 가능한지 확인

### 3. 직원관리 화면 확인

**직원 목록:**
- [ ] 새로 작성한 계약서의 직원이 목록에 나타나는지
- [ ] 근로계약서 관리에서 계약서가 보이는지
- [ ] "근로계약서 보기" 버튼 클릭 시 PDF가 새 탭에서 열리는지

## 테스트 중 확인할 에러

### 일반적인 에러

1. **"근로자 성명을 입력해주세요"**
   - 필수 필드 미입력

2. **"주민등록번호 형식이 올바르지 않습니다"**
   - 주민등록번호 형식 오류 (예: 하이픈 없음)

3. **"전화번호 형식이 올바르지 않습니다"**
   - 전화번호 형식 오류

4. **"계좌입금을 선택한 경우 은행명과 계좌번호를 입력해주세요"**
   - 계좌입금 선택했지만 은행 정보 미입력

5. **"PDF 생성 중 오류가 발생했습니다"**
   - PDF 생성 실패 (브라우저 콘솔 확인)

6. **"파일 업로드 중 오류가 발생했습니다"**
   - Storage 권한 문제 또는 네트워크 오류

7. **"계약서 저장 중 오류가 발생했습니다"**
   - Firestore 권한 문제 또는 데이터 형식 오류

## 문제 발생 시

### 1. 브라우저 콘솔 확인
- F12 → Console 탭
- 에러 메시지 확인
- 스크린샷 저장

### 2. Firebase 콘솔 확인
- Firestore: 데이터가 저장되었는지 확인
- Storage: 파일이 업로드되었는지 확인
- Authentication: 권한 문제인지 확인

### 3. 알려주실 정보
- 어떤 단계에서 에러가 발생했는지
- 에러 메시지 내용
- 브라우저 콘솔 에러 (스크린샷)
- 입력한 데이터 (개인정보 제외)

## 성공 확인 체크리스트

- [ ] 계약서 작성 완료 메시지 표시
- [ ] Firestore에 데이터 저장 확인
- [ ] Storage에 PDF 업로드 확인
- [ ] 직원관리 화면에서 직원 정보 확인
- [ ] 근로계약서 관리에서 계약서 확인
- [ ] PDF 다운로드/보기 정상 작동
- [ ] 모든 필드가 올바르게 저장되었는지 확인

## 테스트 완료 후

모든 기능이 정상 작동하면:
- ✅ 프로덕션 사용 가능
- ⏳ 카카오톡 전송만 비즈 앱 전환 후 활성화

문제가 발생하면:
- 에러 내용과 스크린샷을 알려주시면 바로 수정하겠습니다!

