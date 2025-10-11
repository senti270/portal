# 스마트스토어 주문 알림 시스템 설정 가이드

## 📋 개요

네이버 스마트스토어 주문 내역을 자동으로 조회하고 카카오워크로 알림을 보내는 시스템입니다.

## 🔧 1단계: 네이버 커머스 API 설정

### 1-1. 네이버 개발자 센터
1. https://developers.naver.com/apps/#/register 접속
2. **Application 등록** 클릭
3. **애플리케이션 이름**: "스마트스토어 주문 알림"
4. **사용 API**: "네이버 커머스 API" 선택
5. **서비스 URL**: https://www.cdcdcd.kr
6. **Callback URL**: https://www.cdcdcd.kr/callback (필요시)

### 1-2. API 키 발급
- **Client ID**: 발급받은 ID 복사
- **Client Secret**: 발급받은 Secret 복사

### 1-3. 스마트스토어 연동
1. 네이버 커머스 API 관리 페이지 접속
2. 스마트스토어 계정 연동
3. 권한 승인 (주문 조회)

---

## 💬 2단계: 카카오워크 설정

### 2-1. 카카오워크 설치 및 가입
1. 카카오워크 앱 다운로드 (PC/모바일)
   - https://www.kakaowork.com/
2. 회원가입 및 워크스페이스 생성
   - 워크스페이스 이름: "드로잉컴퍼니" (예시)

### 2-2. 테스트 단톡방 생성
1. 카카오워크 앱에서 **대화방 만들기**
2. **나만 있는 방** 생성 (테스트용)
3. 방 이름: "주문알림 테스트"

### 2-3. 챗봇 생성 및 Webhook 설정
1. 카카오워크 관리자 페이지 접속
   - https://workspace.kakaowork.com/
2. **챗봇** 메뉴 클릭
3. **챗봇 만들기** 클릭
   - 챗봇 이름: "주문알림봇"
   - 설명: "네이버 스마트스토어 주문 알림"
4. **Webhook 설정**
   - **Incoming Webhook** 생성
   - Webhook URL 복사 (예: `https://flow.team/webhook/xxxxxxxx`)

### 2-4. 단톡방에 챗봇 초대
1. 테스트 단톡방 열기
2. **대화상대 추가** 클릭
3. **챗봇** 탭에서 "주문알림봇" 선택
4. 추가 완료!

---

## 🔐 3단계: Vercel 환경 변수 설정

1. Vercel 프로젝트 대시보드 접속
   - https://vercel.com/senti270/portal

2. **Settings** → **Environment Variables** 클릭

3. 다음 환경 변수 추가:

```
NAVER_COMMERCE_CLIENT_ID = [네이버 커머스 Client ID]
NAVER_COMMERCE_CLIENT_SECRET = [네이버 커머스 Client Secret]
KAKAO_WORK_WEBHOOK_URL = [카카오워크 Webhook URL]
NEXT_PUBLIC_BASE_URL = https://www.cdcdcd.kr
```

4. **Save** 클릭

5. **Redeploy** 필요 (자동 배포됨)

---

## ✅ 4단계: 테스트

### 4-1. 수동 테스트
1. https://www.cdcdcd.kr/smart-store-orders 접속
2. 날짜 선택 (오늘 또는 어제)
3. **주문 조회** 클릭
4. 결과 확인
5. **📤 카카오워크로 전송** 클릭
6. 카카오워크 테스트 단톡방에서 메시지 확인!

### 4-2. 자동 스케줄 테스트
- 오전 9시와 낮 12시에 자동으로 메시지 발송
- 카카오워크에서 확인

---

## 🎯 5단계: 실제 단톡방에 적용

### 테스트 완료 후:
1. **실제 업무 단톡방**에 "주문알림봇" 초대
2. 끝! (Webhook URL은 동일)

---

## 📊 메시지 형식

### 오전 9시 리포트:
```
🌅 오전 9시 주문 리포트
📅 2025-10-10 12:00 ~ 2025-10-11 09:00

📊 주문 요약
• 총 주문: 15건
• 신규 주문: 12건
• 배송 준비: 2건
• 배송 완료: 0건
• 취소: 1건

━━━━━━━━━━━━━━━━
1. 상품명 A
   주문번호: 2025101012345
   상태: PAYED
   금액: 35,000원
...
```

### 낮 12시 리포트:
```
🌤️ 낮 12시 변경사항 리포트
📅 2025-10-11 09:00 ~ 12:00

📊 변경/추가 주문
• 총 3건
• 신규 주문: 2건
• 상태 변경: 1건
...
```

---

## 🐛 문제 해결

### Webhook이 작동하지 않을 때:
1. Webhook URL 확인
2. 카카오워크에서 챗봇이 단톡방에 있는지 확인
3. Vercel 환경 변수 확인

### API 키 오류:
1. 네이버 개발자 센터에서 API 사용 승인 확인
2. Client ID/Secret 재확인

---

## 💰 비용 요약

- **카카오워크**: 무료 ✅
- **네이버 커머스 API**: 무료 ✅
- **Vercel Cron**: 무료 ✅
- **총 비용**: **0원!** 🎉

---

## 📞 지원

문제 발생 시:
- 네이버 개발자 포럼: https://developers.naver.com/forum
- 카카오워크 고객센터: https://cs.kakao.com/helps?service=157

---

다음 작업: API 키 발급 후 `.env.local`에 추가하고 테스트!

