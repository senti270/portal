# Firebase Firestore 설정 가이드

관리자가 시스템을 추가/편집할 때 Firebase Firestore에 자동으로 저장되도록 설정하는 방법입니다.

## 1. Firebase 프로젝트 설정

### **Firebase Console에서:**
1. https://console.firebase.google.com 접속
2. 기존 프로젝트 선택 또는 새 프로젝트 생성
3. **Firestore Database** → **데이터베이스 만들기**
4. **테스트 모드로 시작** 선택 (개발용)
5. **위치 선택** (asia-northeast3 권장)

## 2. Firebase 설정 정보 복사

### **프로젝트 설정에서:**
1. Firebase Console → 프로젝트 설정 (⚙️)
2. **일반** 탭 → **내 앱** 섹션
3. **웹 앱 추가** (이미 있으면 기존 것 사용)
4. **Firebase SDK 구성** 복사:
   ```javascript
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "your-app-id"
   }
   ```

## 3. Vercel 환경 변수 설정

### **Vercel 대시보드에서:**
1. 프로젝트 선택 → Settings → Environment Variables
2. 다음 변수들 추가:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | 위에서 복사한 apiKey | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | 위에서 복사한 authDomain | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | 위에서 복사한 projectId | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 위에서 복사한 storageBucket | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 위에서 복사한 messagingSenderId | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | 위에서 복사한 appId | Production, Preview, Development |

## 4. Firestore 보안 규칙 설정

### **Firestore Console에서:**
1. **규칙** 탭 클릭
2. 다음 규칙으로 변경:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // systems 컬렉션은 모든 사용자가 읽기/쓰기 가능
       match /systems/{document} {
         allow read, write: if true;
       }
     }
   }
   ```
3. **게시** 클릭

## 5. 자동 배포

환경 변수 설정 후:
1. Vercel에서 **"Redeploy"** 클릭
2. 또는 코드를 조금 수정해서 푸시

## 6. 테스트

설정 완료 후:
1. https://cdcdcd.kr 접속
2. 관리자 로그인 (비밀번호: 2906)
3. 시스템 추가/편집 테스트
4. 다른 브라우저/컴퓨터에서도 동일한 데이터가 보이는지 확인

## 📊 Firestore 데이터 구조

### **컬렉션: `systems`**
```javascript
{
  id: "system-1234567890",
  title: "시스템 이름",
  description: "시스템 설명",
  icon: "📅",
  color: "#3B82F6",
  category: "업무관리",
  url: "https://example.com",
  status: "active",
  tags: ["태그1", "태그2"],
  optimization: ["PC 최적화", "모바일 최적화"],
  createdAt: "2025-01-16T00:00:00.000Z",
  updatedAt: "2025-01-16T00:00:00.000Z"
}
```

## 🔧 문제 해결

### **Firestore 연결 실패:**
- 환경 변수가 올바르게 설정되었는지 확인
- Vercel 재배포 필요
- Firebase 프로젝트 ID가 정확한지 확인

### **권한 오류:**
- Firestore 보안 규칙이 올바른지 확인
- 테스트 모드로 설정되어 있는지 확인

### **데이터가 보이지 않음:**
- Firebase Console에서 데이터가 실제로 저장되었는지 확인
- 브라우저 개발자 도구에서 에러 메시지 확인

## 💡 추가 기능

### **실시간 동기화:**
나중에 실시간 동기화를 원하면 `onSnapshot`을 사용하여 구현 가능합니다.

### **인증 추가:**
Firebase Authentication을 추가하여 더 안전한 관리자 시스템 구축 가능합니다.








