# 카카오톡 API 환경변수 설정 가이드

## 확인된 키 정보
- **REST API 키**: `c5d583e5ff16d309db38add5aa9032a4`
- **JavaScript 키**: `5c13f632a4dcaa7607e1c45bf4100b81`

## Vercel 환경변수 설정

### 1. Vercel 대시보드 접속
- https://vercel.com/dashboard
- `portal` 프로젝트 선택

### 2. Settings → Environment Variables

### 3. 다음 변수 추가/수정

#### REST API 키 (서버 사이드용)
```
Key: KAKAO_REST_API_KEY
Value: c5d583e5ff16d309db38add5aa9032a4
Environment: Production, Preview, Development 모두 선택
```

#### JavaScript 키 (클라이언트 사이드용 - 이미 있을 수 있음)
```
Key: NEXT_PUBLIC_KAKAO_JS_KEY (또는 NEXT_PUBLIC_KAKAO_APP_KEY)
Value: 5c13f632a4dcaa7607e1c45bf4100b81
Environment: Production, Preview, Development 모두 선택
```

### 4. Redeploy 필수
- 환경변수 추가/수정 후 반드시 **Redeploy** 실행
- Deployments 탭 → 최근 배포 → ⋯ → Redeploy

## 확인 방법

환경변수 설정 후:
1. 배포 완료 대기
2. 브라우저 콘솔에서 확인:
   - `✅ 카카오 SDK 초기화 완료` (클라이언트 사이드)
3. 서버 로그에서 확인:
   - API 호출 시 REST API 키 사용 확인

