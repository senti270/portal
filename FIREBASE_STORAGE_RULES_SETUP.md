# Firebase Storage 보안 규칙 설정 가이드

## 현재 문제
- 403 Forbidden 오류 발생
- Firebase Storage 보안 규칙이 업로드를 허용하지 않음

## 해결 방법

### 1. Firebase Console 접속
1. https://console.firebase.google.com/ 접속
2. `portal-fc7ae` 프로젝트 선택
3. 왼쪽 메뉴에서 **Storage** 클릭

### 2. 보안 규칙 설정
1. **Rules** 탭 클릭
2. 다음 규칙으로 변경:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // contracts 폴더에 대한 규칙
    match /contracts/{contractId} {
      // 인증된 사용자만 업로드/다운로드 가능
      allow read, write: if request.auth != null;
      
      // 또는 모든 사용자 허용 (개발용 - 나중에 수정 필요)
      // allow read, write: if true;
    }
    
    // 다른 파일들에 대한 규칙
    match /{allPaths=**} {
      // 인증된 사용자만 접근 가능
      allow read, write: if request.auth != null;
    }
  }
}
```

### 3. 규칙 저장
1. **게시** (Publish) 버튼 클릭
2. 규칙 적용 대기 (몇 초 소요)

## 옵션 1: 인증된 사용자만 허용 (권장)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 옵션 2: 임시로 모든 사용자 허용 (개발용)

⚠️ **주의**: 프로덕션에서는 사용하지 마세요!

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

## 옵션 3: 특정 폴더만 허용

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // contracts 폴더만 모든 사용자 허용
    match /contracts/{contractId} {
      allow read, write: if true;
    }
    
    // 나머지는 인증 필요
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 확인 방법

규칙 저장 후:
1. 브라우저 새로고침
2. 근로계약서 작성 다시 시도
3. 403 오류가 사라지고 업로드 성공하는지 확인

## 참고

- 규칙 변경은 즉시 적용됩니다
- 규칙 테스트는 Firebase Console의 "Rules" 탭에서 "Rules Playground" 사용 가능
- 프로덕션 환경에서는 반드시 인증 기반 규칙 사용 권장

