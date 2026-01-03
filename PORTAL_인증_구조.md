# Portal 인증 구조

## 📋 개요

**Portal**이 메인 플랫폼이며, 모든 인증은 Portal 단위에서 처리됩니다.
**work-schedule**은 Portal의 서브 시스템일 뿐이며, 별도의 인증이 필요 없습니다.

## 🏗️ 아키텍처

```
Portal (cdcdcd.kr)
├── 인증 레이어 (PortalAuth)
│   ├── 기존 로그인 (아이디/비밀번호)
│   └── 카카오톡 로그인
├── 메인 대시보드 (/)
│   └── 시스템 카드들 (work-schedule 포함)
└── 서브 시스템들
    ├── work-schedule (/work-schedule)
    │   └── Portal 인증 사용 (별도 인증 없음)
    └── account (향후 추가 예정)
        └── Portal 인증 사용
```

## 🔐 인증 흐름

1. **사용자가 Portal 접근** (`https://cdcdcd.kr`)
   - PortalAuth가 인증 상태 확인
   - 미인증 시 로그인 화면 표시

2. **로그인 방법**
   - 기존 로그인 (아이디/비밀번호)
   - 카카오톡 로그인

3. **인증 후**
   - Portal 메인 대시보드 접근 가능
   - work-schedule 등 모든 서브 시스템 접근 가능

4. **work-schedule 접근** (`/work-schedule`)
   - PortalAuth가 이미 인증 처리
   - 별도 로그인 불필요
   - Dashboard 바로 표시

## 📁 파일 구조

```
portal/
├── components/
│   ├── PortalAuth.tsx          # Portal 전체 인증 레이어
│   └── work-schedule/
│       └── Dashboard.tsx        # work-schedule 대시보드
├── app/
│   ├── page.tsx                 # Portal 메인 (PortalAuth 적용)
│   ├── signup/
│   │   └── page.tsx             # 카카오톡 가입 페이지
│   └── work-schedule/
│       └── page.tsx             # work-schedule (PortalAuth 적용)
└── lib/
    └── kakao.ts                 # 카카오 SDK 유틸리티
```

## ✅ 주요 원칙

1. **단일 인증 지점**: Portal에서만 인증 처리
2. **서브 시스템 독립성**: work-schedule은 인증 로직 없음
3. **통합 사용자 경험**: 한 번 로그인으로 모든 시스템 접근

## 🔄 변경 사항

### 삭제된 파일
- `components/work-schedule/AuthForm.tsx` (더 이상 필요 없음)

### 변경된 파일
- `app/page.tsx`: PortalAuth 적용
- `app/work-schedule/page.tsx`: PortalAuth 사용, 별도 인증 제거

## 📝 카카오톡 로그인

- **가입 페이지**: `/signup` (Portal 단위)
- **로그인 페이지**: `/` (Portal 메인)
- **Redirect URI**: Portal 도메인 기준으로 설정

