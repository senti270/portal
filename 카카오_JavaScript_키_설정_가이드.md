# 카카오 JavaScript 키 설정 가이드

## 📋 문제 상황

카카오 JS SDK에서 REST API 키를 사용하면 "등록되지 않은 플랫폼에서 액세스 토큰을 요청했습니다" 에러가 발생합니다.

**원인:** 카카오 JavaScript SDK는 JavaScript 키를 사용해야 합니다.

## 🔧 해결 방법

### 1. JavaScript 키 확인

카카오 개발자 콘솔 → 앱 키에서 JavaScript 키를 확인하세요:
- JavaScript 키: `5c13f632a4dcaa7607e1c45bf4100b81` (이미지에서 확인됨)

### 2. 환경 변수 추가

Vercel 또는 로컬 환경에서 다음 환경 변수를 추가/수정하세요:

```env
# JavaScript 키 사용 (권장)
NEXT_PUBLIC_KAKAO_JS_KEY=5c13f632a4dcaa7607e1c45bf4100b81

# 또는 기존 변수를 JavaScript 키로 변경
NEXT_PUBLIC_KAKAO_APP_KEY=5c13f632a4dcaa7607e1c45bf4100b81
```

### 3. Vercel 환경 변수 설정

1. [Vercel 대시보드](https://vercel.com/dashboard) 접속
2. `portal` 프로젝트 선택
3. **Settings** → **Environment Variables**
4. 다음 중 하나 선택:

   **방법 1: 새 변수 추가 (권장)**
   - Key: `NEXT_PUBLIC_KAKAO_JS_KEY`
   - Value: `5c13f632a4dcaa7607e1c45bf4100b81`
   - Environment: Production, Preview, Development 모두 선택
   - **Add** 클릭

   **방법 2: 기존 변수 수정**
   - `NEXT_PUBLIC_KAKAO_APP_KEY` 찾기
   - Value를 JavaScript 키로 변경: `5c13f632a4dcaa7607e1c45bf4100b81`
   - **Save** 클릭

5. 환경 변수 추가/수정 후 **Redeploy** 필요

## 📝 키 종류 설명

- **REST API 키**: 서버 사이드 API 호출용
- **JavaScript 키**: 클라이언트 사이드 JavaScript SDK용 (현재 사용 중)
- **Native 앱 키**: 모바일 앱용

## ✅ 확인 사항

설정 후 다음을 확인하세요:

1. 브라우저 콘솔에서 `✅ 카카오 SDK 초기화 완료` 메시지 확인
2. 카카오 로그인 버튼 클릭 시 정상 작동 확인
3. 플랫폼 설정에서 `www.cdcdcd.kr` 도메인이 등록되어 있는지 확인

## ⚠️ 주의사항

- JavaScript 키는 클라이언트에 노출되므로 보안에 취약할 수 있습니다
- 하지만 카카오 JS SDK를 사용하려면 JavaScript 키가 필요합니다
- REST API 키는 서버 사이드에서만 사용해야 합니다



