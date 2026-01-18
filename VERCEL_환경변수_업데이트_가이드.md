# Vercel 환경 변수 업데이트 가이드

## 🔧 환경 변수 변경 (JavaScript 키로 변경)

### 현재 상태
- `NEXT_PUBLIC_KAKAO_APP_KEY` = `c5d583e5ff16d309db38add5aa9032a4` (REST API 키)

### 변경할 값
- `NEXT_PUBLIC_KAKAO_APP_KEY` = `5c13f632a4dcaa7607e1c45bf4100b81` (JavaScript 키)

## 📋 단계별 설정 방법

### 방법 1: Vercel 대시보드에서 수정 (권장)

1. **[Vercel 대시보드](https://vercel.com/dashboard) 접속**
2. **`portal` 프로젝트 선택**
3. **Settings** → **Environment Variables** 메뉴 클릭
4. **`NEXT_PUBLIC_KAKAO_APP_KEY` 찾기**
5. **✏️ 편집 아이콘** 또는 **변수명 클릭**
6. **Value를 변경:**
   - 기존: `c5d583e5ff16d309db38add5aa9032a4`
   - 변경: `5c13f632a4dcaa7607e1c45bf4100b81`
7. **Environment 선택 확인** (Production, Preview, Development 모두 선택)
8. **Save** 클릭
9. **Redeploy 필요** 알림 확인

### 방법 2: 새 변수 추가 (기존 변수 유지)

1. **Settings** → **Environment Variables**
2. **Add New** 클릭
3. **변수 정보 입력:**
   - Key: `NEXT_PUBLIC_KAKAO_JS_KEY`
   - Value: `5c13f632a4dcaa7607e1c45bf4100b81`
   - Environment: Production, Preview, Development 모두 선택
4. **Add** 클릭

> 참고: 방법 2를 사용하면 코드가 자동으로 `NEXT_PUBLIC_KAKAO_JS_KEY`를 우선 사용합니다.

## 🔄 Redeploy 필수

환경 변수 변경 후 반드시 **Redeploy**를 해야 합니다:

### Redeploy 방법:

1. Vercel 대시보드에서 **Deployments** 탭 클릭
2. 가장 최근 배포 항목의 **⋯ (점 3개)** 메뉴 클릭
3. **Redeploy** 선택
4. 확인 클릭

또는

1. **Settings** → **Environment Variables** 페이지 하단
2. **Redeploy** 버튼이 있으면 클릭

## ✅ 변경 확인

Redeploy 후 확인 사항:

1. **브라우저에서 사이트 접속**
2. **개발자 도구 (F12) → Console 탭 열기**
3. 다음 메시지 확인:
   - `✅ 카카오 SDK 초기화 완료` ← 정상
4. **카카오 로그인 버튼 클릭 테스트**
   - 에러 없이 팝업이 나타나면 성공!

## 🔍 문제 해결

### 여전히 에러가 발생하면:

1. **브라우저 캐시 삭제** (Ctrl + Shift + Delete)
2. **하드 리프레시** (Ctrl + F5)
3. **시크릿 모드에서 테스트**
4. **환경 변수가 제대로 적용되었는지 확인:**
   - Vercel에서 변수 값이 `5c13f632a4dcaa7607e1c45bf4100b81`인지 확인
   - 배포 로그에서 환경 변수 로드 확인

## 📝 변경 요약

```diff
- NEXT_PUBLIC_KAKAO_APP_KEY=c5d583e5ff16d309db38add5aa9032a4 (REST API 키)
+ NEXT_PUBLIC_KAKAO_APP_KEY=5c13f632a4dcaa7607e1c45bf4100b81 (JavaScript 키)
```

이 변경으로 "등록되지 않은 플랫폼에서 액세스 토큰을 요청했습니다" 에러가 해결됩니다!





