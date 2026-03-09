# 카카오톡 전송 구현 가이드

## 현재 상태
- API 라우트: `app/api/employment-contract/send-kakao/route.ts`
- 현재는 TODO 상태로 로그만 출력

## 구현 방법 옵션

### 옵션 1: 카카오톡 비즈니스 API (알림톡)
**장점:**
- 공식 API, 안정적
- 템플릿 메시지 지원
- 파일 첨부 가능

**필요한 작업:**
1. 카카오톡 비즈니스 계정 생성 및 앱 등록
2. API 키 발급
3. 환경변수 설정:
   ```
   KAKAO_REST_API_KEY=your_api_key
   KAKAO_ADMIN_KEY=your_admin_key
   ```
4. 알림톡 템플릿 등록 (카카오톡 비즈니스 관리자 페이지)
5. API 구현:
   ```typescript
   // app/api/employment-contract/send-kakao/route.ts
   const response = await fetch('https://kapi.kakao.com/v2/api/talk/memo/send', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${accessToken}`,
       'Content-Type': 'application/x-www-form-urlencoded'
     },
     body: new URLSearchParams({
       template_id: 'your_template_id',
       template_args: JSON.stringify({
         employeeName: employeeName,
         contractUrl: contractUrl
       }),
       receiver_uuids: JSON.stringify([phoneNumber])
     })
   })
   ```

### 옵션 2: 카카오톡 링크 공유 API
**장점:**
- 간단한 구현
- 링크만 전송

**필요한 작업:**
1. 카카오톡 개발자 계정 생성
2. 앱 등록 및 JavaScript 키 발급
3. 환경변수 설정:
   ```
   KAKAO_JS_KEY=your_js_key
   ```
4. 클라이언트 사이드에서 구현 (서버 사이드 불가)

### 옵션 3: SMS 대체 (카카오톡 대신)
**장점:**
- 구현이 더 간단
- 카카오톡 API 없이도 가능

**필요한 작업:**
1. SMS API 서비스 선택 (예: Twilio, AWS SNS, 네이버 클라우드 플랫폼)
2. API 키 발급
3. 환경변수 설정
4. API 구현

### 옵션 4: 이메일 전송
**장점:**
- 가장 간단
- 파일 첨부 가능

**필요한 작업:**
1. 이메일 서비스 선택 (예: SendGrid, AWS SES, Nodemailer)
2. SMTP 설정 또는 API 키 발급
3. 환경변수 설정
4. API 구현

## 추천 방법
**카카오톡 비즈니스 API (알림톡)**를 추천합니다:
- 한국에서 가장 널리 사용
- 파일 첨부 가능
- 템플릿 메시지로 일관된 형식 유지

## 구현 시 주의사항
1. **개인정보 보호**: 전화번호는 암호화하여 전송
2. **에러 처리**: 전송 실패 시 재시도 로직 추가
3. **비용**: 알림톡은 유료 서비스 (건당 과금)
4. **동의**: 근로자로부터 카카오톡 수신 동의 필요

## 참고 링크
- [카카오톡 비즈니스 API 문서](https://developers.kakao.com/docs/latest/ko/kakaotalk-business/overview)
- [알림톡 가이드](https://developers.kakao.com/docs/latest/ko/kakaotalk-business/notification)

