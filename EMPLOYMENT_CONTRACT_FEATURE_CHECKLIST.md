# 근로계약서 작성 기능 구현 체크리스트

## ✅ 완료된 기능

### 1. 포털 통합
- [x] 포털 첫 화면에 "근로계약서 작성" 바로가기 추가
- [x] 시스템 카드 표시 및 클릭 시 이동

### 2. 계약서 작성 UI
- [x] 지점 선택 기능
- [x] 표준 근로계약서 양식대로 UI 구현
- [x] 모든 입력 필드 구현:
  - 근로자 정보 (성명, 주민등록번호, 주소, 연락처) - 필수
  - 근로개시일, 종료일, 계약일자
  - 근무장소 (고정 텍스트)
  - 업무의 내용 (고정 텍스트)
  - 임금 (월급/일급/시급 체크박스 선택)
  - 주휴수당 포함 여부
  - 지급방법 (현금/계좌입금)
  - 계좌번호 (은행명 드롭다운 + 계좌번호 입력)
  - 근무일/휴일 (요일 체크박스 선택, 자동 계산)
  - 임금지급일 (10일 고정)
  - 수습기간 (기본값 1개월)
  - 고용형태 (근로소득/사업소득/일용직/외국인)

### 3. 서명 기능
- [x] 근로자 서명 캔버스
- [x] 사업주 서명 캔버스
- [x] 서명 완료 후 자동 전환 (근로자 → 사업주)
- [x] 서명 이미지 저장

### 4. 데이터 검증
- [x] 필수 필드 검증
- [x] 주민등록번호 형식 검증
- [x] 전화번호 형식 검증
- [x] 날짜 유효성 검사
- [x] 계좌입금 선택 시 은행명/계좌번호 필수 검증

### 5. PDF 생성
- [x] jsPDF를 사용한 PDF 생성
- [x] 계약서 양식대로 레이아웃 구성
- [x] 서명 이미지 포함
- [x] 지점 정보 자동 입력 (사업체명, 주소, 대표자명)

### 6. Firebase Storage 업로드
- [x] PDF 파일 업로드
- [x] 파일명 생성 (타임스탬프 포함)
- [x] 다운로드 URL 생성

### 7. Firestore 저장
- [x] `employmentContracts` 컬렉션에 저장
- [x] 모든 계약 정보 저장:
  - employeeInfo (근로자 정보)
  - contractInfo (계약 정보)
    - employmentType (고용형태)
    - salaryType, salaryAmount (급여 정보)
    - includesWeeklyHoliday (주휴수당 포함 여부)
    - 기타 계약 조건
  - signatures (서명 정보)
  - contractFile (PDF URL)
  - contractFileName

### 8. 직원관리 자동 동기화
- [x] 기존 직원 확인 (이름 + 주민등록번호)
- [x] 새 직원 추가 또는 기존 직원 업데이트
- [x] 다음 필드 자동 동기화:
  - employmentType (고용형태)
  - salaryType, salaryAmount (급여 정보)
  - includesWeeklyHolidayInWage (주휴수당 포함 여부)
  - bankName, bankCode, accountNumber (은행 정보)
  - contractFile (계약서 PDF URL)
  - primaryBranchId, primaryBranchName (대표 지점)
  - probationStartDate, probationEndDate, probationPeriod (수습기간)
  - isOnProbation (수습 여부)
- [x] employeeBranches 컬렉션에 관계 생성
- [x] employmentContracts에 employeeId 연결

### 9. 에러 처리
- [x] 각 단계별 try-catch 처리
- [x] 사용자에게 명확한 에러 메시지 표시
- [x] 직원관리 동기화 실패해도 계약서는 저장되도록 처리

### 10. 근로계약서 관리
- [x] 직원관리 화면에서 근로계약서 목록 표시
- [x] PDF 다운로드/보기 기능
  - 기존 이미지 파일: 다운로드
  - 새 PDF 파일: 새 탭에서 열기

## ⏳ 대기 중인 기능

### 1. 카카오톡 전송
- [ ] 비즈 앱 전환 심사 완료 대기 (2-3일)
- [ ] 알림톡 템플릿 등록 및 심사
- [ ] 템플릿 ID 확인 후 API 최종 활성화

## 📝 참고사항

### 저장되는 데이터 구조

**employmentContracts 컬렉션:**
- `contractInfo.bankName`, `contractInfo.bankAccount`는 저장되지 않음
- (은행 정보는 employees 컬렉션에만 저장)

**employees 컬렉션:**
- `bankName`, `bankCode`, `accountNumber` 저장됨
- `employmentType`, `salaryType`, `salaryAmount` 저장됨
- `includesWeeklyHolidayInWage` 저장됨

### 개선 가능한 부분 (선택사항)
- PDF 한글 폰트 지원 (현재는 기본 폰트 사용)
- DOCX 템플릿 파일 업로드 기능 (현재는 미사용)
- 계약서 수정 기능
- 계약서 삭제 기능

## ✅ 결론

**카카오톡 발송을 제외한 모든 핵심 기능이 구현되었습니다!**

- 계약서 작성 ✅
- 서명 ✅
- PDF 생성 ✅
- 저장 ✅
- 직원관리 동기화 ✅
- 에러 처리 ✅

카카오톡 전송만 비즈 앱 전환 완료 후 활성화하면 됩니다.


