# 카카오 개발자 콘솔 Redirect URI 업데이트

## 🔄 변경 사항

카카오톡 로그인이 **portal 전체 단위**로 이동되었습니다.

## 📝 업데이트할 Redirect URI

### 기존 (삭제)
- ❌ `https://cdcdcd.kr/work-schedule/signup`
- ❌ `https://cdcdcd.kr/work-schedule`
- ❌ `http://localhost:3000/work-schedule/signup`
- ❌ `http://localhost:3000/work-schedule`

### 신규 (추가)
- ✅ `https://cdcdcd.kr/signup` (가입 페이지)
- ✅ `https://cdcdcd.kr` (로그인 페이지 - portal 메인)
- ✅ `http://localhost:3000/signup` (개발용 가입 페이지)
- ✅ `http://localhost:3000` (개발용 로그인 페이지)

## 🔧 설정 방법

1. [카카오 개발자 콘솔](https://developers.kakao.com/) 접속
2. 내 애플리케이션 → 해당 앱 선택
3. **제품 설정** → **카카오 로그인** → **Redirect URI 등록**
4. 기존 URI 삭제 후 신규 URI 추가
5. **저장** 클릭

## ⚠️ 중요

- 기존 URI는 반드시 삭제하세요 (보안상 이유)
- 신규 URI는 정확히 입력하세요 (대소문자, 슬래시 주의)
- 프로덕션과 개발 환경 모두 등록하세요

