# Firebase 통합 가이드

## 📋 개요

`work-schedule-next`의 Firebase 프로젝트(`workschedule-8fc6f`)를 `portal`의 Firebase 프로젝트(`portal-fc7ae`)로 통합합니다.

## 🔥 현재 상황

- **Portal**: `portal-fc7ae` Firebase 프로젝트 사용
- **Work Schedule**: `workschedule-8fc6f` Firebase 프로젝트 사용
- **목표**: 두 프로젝트를 `portal-fc7ae`로 통합

## 📝 단계별 통합 방법

### 1단계: Firebase 콘솔에서 데이터 마이그레이션

#### 1.1 `workschedule-8fc6f` 데이터 확인
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. `workschedule-8fc6f` 프로젝트 선택
3. Firestore Database → Data 탭에서 모든 컬렉션 확인
4. 주요 컬렉션 목록:
   - `branches` - 지점 정보
   - `employees` - 직원 정보
   - `schedules` - 스케줄 정보
   - `workTimeComparisonResults` - 근무시간 비교 결과
   - `payrollData` - 급여 데이터
   - `managerAccounts` - 매니저 계정
   - `pay_deposits` - 입금 정보 (이전 `deposits`)
   - 기타 컬렉션들

#### 1.2 데이터 내보내기 (Export)

**방법 1: Google Cloud Console 사용 (권장)**
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트를 `workschedule-8fc6f`로 선택
3. 왼쪽 메뉴에서 **Firestore** → **데이터** 선택
4. 상단 메뉴에서 **내보내기** (Export) 클릭
5. Cloud Storage 버킷 선택 (없으면 생성)
6. 내보내기 실행

**방법 2: Firebase CLI 사용**
1. Firebase CLI 설치 (아직 안 했다면):
   ```bash
   npm install -g firebase-tools
   ```
2. Firebase 로그인:
   ```bash
   firebase login
   ```
3. 프로젝트 선택:
   ```bash
   firebase use workschedule-8fc6f
   ```
4. 데이터 내보내기:
   ```bash
   firebase firestore:export gs://workschedule-8fc6f-backup/export
   ```
   (Cloud Storage 버킷이 필요합니다)

**방법 3: 수동 마이그레이션 (소규모 데이터용)**
- 각 컬렉션을 하나씩 확인하면서 `portal-fc7ae`로 수동 복사
- 또는 아래 스크립트 사용

**방법 4: Google Cloud Console에서 직접 Export (가장 간단)**
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 상단에서 프로젝트를 `workschedule-8fc6f`로 선택
3. 왼쪽 메뉴에서 **Firestore** → **데이터** 클릭
4. 상단에 **내보내기** 버튼이 있습니다 (Export)
5. Cloud Storage 버킷 선택 후 내보내기 실행

#### 1.3 데이터 가져오기 (Import)

**방법 1: Google Cloud Console 사용**
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트를 `portal-fc7ae`로 선택
3. 왼쪽 메뉴에서 **Firestore** → **데이터** 선택
4. 상단 메뉴에서 **가져오기** (Import) 클릭
5. 내보낸 파일 경로 선택
6. 가져오기 실행

**방법 2: Firebase CLI 사용**
1. 프로젝트 전환:
   ```bash
   firebase use portal-fc7ae
   ```
2. 데이터 가져오기:
   ```bash
   firebase firestore:import gs://workschedule-8fc6f-backup/export
   ```

**방법 3: 스크립트를 사용한 자동 마이그레이션**
- 아래 "자동 마이그레이션 스크립트" 섹션 참고

#### 1.4 사용자 인증 계정 마이그레이션
1. `workschedule-8fc6f` 프로젝트의 Authentication → Users에서 모든 사용자 확인
2. `portal-fc7ae` 프로젝트의 Authentication → Users에서 동일한 이메일로 사용자 생성
3. 또는 Firebase CLI로 사용자 내보내기/가져오기:
   ```bash
   # 내보내기
   firebase auth:export users.json --project workschedule-8fc6f
   
   # 가져오기
   firebase auth:import users.json --project portal-fc7ae
   ```

### 2단계: 환경 변수 설정

#### 2.1 `.env.local` 파일 생성/수정
`portal` 프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용 추가:

```env
# Portal Firebase 설정 (통합된 메인 Firebase)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy... (portal-fc7ae의 API Key)
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=portal-fc7ae.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=portal-fc7ae
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=portal-fc7ae.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=... (portal-fc7ae의 Messaging Sender ID)
NEXT_PUBLIC_FIREBASE_APP_ID=1:...:web:... (portal-fc7ae의 App ID)
```

#### 2.2 Firebase 설정 값 확인 방법
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. `portal-fc7ae` 프로젝트 선택
3. 프로젝트 설정 (⚙️) → 일반 탭
4. "내 앱" 섹션에서 웹 앱 선택 또는 추가
5. 설정 값 복사:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

### 3단계: 코드 확인

#### 3.1 Firebase 설정 파일 확인
`lib/firebase.ts` 파일이 환경 변수를 사용하도록 설정되어 있는지 확인:

```typescript
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "...",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "...",
  // ...
};
```

#### 3.2 모든 컴포넌트가 통합 Firebase 사용 확인
work-schedule 컴포넌트들이 모두 `@/lib/firebase`를 사용하는지 확인 (이미 완료됨)

### 4단계: 테스트

#### 4.1 로그인 테스트
1. 개발 서버 재시작: `npm run dev`
2. `http://localhost:3000/work-schedule` 접속
3. 기존 계정으로 로그인 시도:
   - ID: `drawing555`
   - 비밀번호: (기존 비밀번호)

#### 4.2 데이터 로드 테스트
1. 지점 관리 페이지에서 지점 목록이 표시되는지 확인
2. 직원 관리 페이지에서 직원 목록이 표시되는지 확인
3. 스케줄 관리 페이지에서 스케줄이 표시되는지 확인

#### 4.3 데이터 쓰기 테스트
1. 새 스케줄 추가
2. 새 직원 추가
3. 데이터가 `portal-fc7ae` 프로젝트에 저장되는지 확인

## ⚠️ 중요: 버킷 위치 문제 해결

**오류 메시지:** "Bucket is in location us. This database can only operate on buckets spanning location asia or asia-northeast3."

**해결 방법:**
1. **"찾아보기"** 버튼 클릭
2. **"버킷 만들기"** 또는 **"Create bucket"** 클릭
3. 버킷 이름 입력 (예: `workschedule-export-asia`)
4. **위치 유형 선택:**
   - **"리전"** (Region) 선택
   - **"asia-northeast3 (서울)"** 선택
5. 버킷 생성 후 선택
6. 다시 내보내기 시도

**참고:** Firestore 데이터베이스가 `asia-northeast3`에 있으면, 내보내기 버킷도 같은 리전(`asia-northeast3`) 또는 `asia` 멀티리전이어야 합니다.

## ⚠️ 주의사항

1. **데이터 백업**: 마이그레이션 전 반드시 데이터 백업
2. **테스트 환경에서 먼저 테스트**: 프로덕션 데이터 마이그레이션 전 테스트 환경에서 먼저 시도
3. **점진적 마이그레이션**: 한 번에 모든 데이터를 마이그레이션하지 말고, 단계적으로 진행
4. **컬렉션 이름 충돌 확인**: `portal-fc7ae`에 이미 존재하는 컬렉션과 이름이 겹치지 않는지 확인
5. **버킷 위치**: Firestore와 같은 리전 또는 `asia` 멀티리전 사용

## 🔄 롤백 계획

만약 문제가 발생하면:
1. 환경 변수를 `workschedule-8fc6f` 설정으로 되돌리기
2. 또는 별도 Firebase 인스턴스 사용 (임시 해결책)

## ⚡ 가장 간단한 방법: Firebase CLI 사용

버킷 권한 설정이 복잡하다면, **Firebase CLI**를 사용하세요! 훨씬 간단합니다.

### 단계별 가이드

1. **터미널 열기** (PowerShell 또는 CMD)

2. **프로젝트 전환:**
   ```bash
   firebase use portal-fc7ae
   ```

3. **데이터 가져오기:**
   ```bash
   firebase firestore:import gs://260103_work_db_asia/export/경로
   ```
   (경로는 `workschedule-8fc6f`에서 내보내기 완료 후 표시된 경로)

**끝!** 버킷 권한 설정 없이 바로 가져올 수 있습니다.

---

## 🚀 빠른 시작 (가장 간단한 방법)

### 방법 1: 검색으로 Firestore 찾기

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 상단 프로젝트 선택 드롭다운에서 `workschedule-8fc6f` 선택
3. **상단 검색 바에 "Firestore" 입력** (가장 빠른 방법!)
4. 검색 결과에서 **Firestore** 클릭
5. **데이터** 탭 클릭
6. 상단에 **내보내기** (Export) 버튼 클릭
7. Cloud Storage 버킷 선택 (없으면 생성)
8. 내보내기 실행

### 방법 2: Firebase Console에서 직접 접근 (더 쉬움!)

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. `workschedule-8fc6f` 프로젝트 선택
3. 왼쪽 메뉴에서 **Firestore Database** 클릭
4. **데이터** 탭에서 상단 메뉴 확인
5. 또는 **Google Cloud Console로 이동** 링크 클릭하여 Google Cloud Console로 이동

### 방법 3: 현재 페이지에서 데이터베이스 클릭

1. 현재 보이는 데이터베이스 목록에서 **`(default)`** 클릭 (파란색 링크)
2. 데이터베이스 상세 페이지로 이동
3. 상단 탭에서 **데이터** (Data) 탭 클릭
4. 상단에 **내보내기** (Export) 버튼이 보입니다

### 방법 4: URL로 직접 접근

1. 다음 URL로 직접 접근:
   ```
   https://console.cloud.google.com/firestore/databases/-default-/data?project=workschedule-8fc6f
   ```
2. 상단에 **내보내기** (Export) 버튼이 보입니다

### 데이터 가져오기

**방법 1: Google Cloud Console에서 가져오기 (버킷 찾기 오류 해결)**

**문제:** "버킷을 찾을 수 없습니다" 오류가 발생하는 경우

**해결 방법:**
1. 프로젝트를 `portal-fc7ae`로 변경
2. [Firestore 가져오기 페이지](https://console.cloud.google.com/firestore/databases/-default-/import?project=portal-fc7ae) 접속
3. **"파일 이름"** 입력 필드에 **직접 경로 입력**:
   - 형식: `gs://버킷이름/export/폴더경로`
   - 예: `gs://workschedule-export-asia/export/2025-01-16T12-00-00_12345`
   - **참고:** `workschedule-8fc6f` 프로젝트에서 내보내기 완료 후 표시된 전체 경로를 복사
4. "찾아보기" 버튼 대신 **직접 입력** 후 **"가져오기"** 클릭

**내보낸 파일 경로 확인 방법:**
1. `workschedule-8fc6f` 프로젝트로 돌아가기
2. Google Cloud Console → Cloud Storage → 버킷 선택
3. 내보낸 폴더 경로 확인 (예: `export/2025-01-16T12-00-00_12345`)
4. 전체 경로: `gs://버킷이름/export/2025-01-16T12-00-00_12345`

**버킷 권한 설정으로 해결하기:**
`portal-fc7ae` 프로젝트에서 버킷을 보려면:

1. 현재 버킷 권한 페이지에서 **"+ 주 구성원 추가"** 클릭
2. **"주 구성원"** 필드에 `portal-fc7ae@appspot.gserviceaccount.com` 입력
   - 또는 `portal-fc7ae` 프로젝트의 Firestore 서비스 계정 추가
3. **"역할"** 선택:
   - **"Storage Legacy Object Reader"** 또는
   - **"Storage Object Viewer"**
4. **"저장"** 클릭
5. `portal-fc7ae` 프로젝트로 돌아가서 다시 시도

**또는 더 간단한 방법:**
- Firebase CLI 사용 (권한 문제 없음)
- 직접 경로 입력 (권한 설정 불필요)

**방법 2: Firebase CLI 사용 (가장 확실한 방법)**
1. Firebase CLI 설치 (아직 안 했다면):
   ```bash
   npm install -g firebase-tools
   ```
2. Firebase 로그인:
   ```bash
   firebase login
   ```
3. 프로젝트 전환:
   ```bash
   firebase use portal-fc7ae
   ```
4. 데이터 가져오기:
   ```bash
   firebase firestore:import gs://버킷이름/export경로
   ```

**방법 3: 스크립트로 직접 마이그레이션 (버킷 없이 가능)**
- 아래 "자동 마이그레이션 스크립트" 섹션 참고

## 🔐 Authentication 사용자 마이그레이션

Firestore 데이터를 마이그레이션했지만, **Authentication 사용자**는 별도로 추가해야 합니다.

### 방법 1: Firebase Console에서 직접 추가

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. `portal-fc7ae` 프로젝트 선택
3. **Authentication** → **Users** 탭
4. **"사용자 추가"** (Add user) 클릭
5. 사용자 정보 입력:
   - **이메일**: `drawing555@naver.com`
   - **비밀번호**: 기존 비밀번호 입력
6. **"사용자 추가"** 클릭

### 방법 2: 기존 사용자 확인

1. `workschedule-8fc6f` 프로젝트의 **Authentication** → **Users**에서 사용자 목록 확인
2. 각 사용자를 `portal-fc7ae`에 동일하게 추가

### 방법 3: Firebase CLI로 사용자 내보내기/가져오기

```bash
# workschedule-8fc6f에서 사용자 내보내기
firebase auth:export users.json --project workschedule-8fc6f

# portal-fc7ae로 사용자 가져오기
firebase auth:import users.json --project portal-fc7ae
```

**중요:** 비밀번호는 내보내기/가져오기 시 포함되지 않으므로, 사용자에게 비밀번호 재설정을 요청하거나 수동으로 설정해야 합니다.

## 📞 지원

문제가 발생하면:
1. Firebase Console에서 데이터 확인
2. 브라우저 개발자 도구 콘솔에서 오류 확인
3. Firebase 설정 값 재확인
4. Authentication 사용자가 추가되었는지 확인

