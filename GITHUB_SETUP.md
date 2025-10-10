# GitHub API 설정 가이드

관리자가 시스템을 추가/편집할 때 GitHub에 자동으로 저장되도록 설정하는 방법입니다.

## 1. GitHub Personal Access Token 생성

1. GitHub.com 로그인
2. Settings → Developer settings → Personal access tokens → Tokens (classic)
3. "Generate new token (classic)" 클릭
4. 설정:
   - Note: "Portal System Management"
   - Expiration: 1 year (또는 원하는 기간)
   - Scopes: `repo` (전체 저장소 접근) 체크
5. "Generate token" 클릭
6. **생성된 토큰을 복사해두세요!** (다시 볼 수 없습니다)

## 2. Vercel 환경 변수 설정

1. Vercel 대시보드 → 프로젝트 선택
2. Settings → Environment Variables
3. 다음 변수 추가:
   - **Name**: `NEXT_PUBLIC_GITHUB_TOKEN`
   - **Value**: 위에서 생성한 토큰
   - **Environment**: Production, Preview, Development 모두 선택
4. "Save" 클릭

## 3. 자동 배포 트리거

환경 변수 설정 후:
1. Vercel에서 "Redeploy" 클릭
2. 또는 코드를 조금 수정해서 푸시

## 4. 테스트

설정 완료 후:
1. https://cdcdcd.kr 접속
2. 관리자 로그인 (비밀번호: 2906)
3. 시스템 추가/편집 테스트
4. 다른 브라우저/컴퓨터에서도 동일한 데이터가 보이는지 확인

## 주의사항

- 토큰은 절대 공개하지 마세요
- 토큰이 만료되면 다시 생성해야 합니다
- GitHub 저장소에 대한 쓰기 권한이 필요합니다

## 문제 해결

- 토큰 권한이 부족하면 `repo` 스코프를 확인하세요
- 환경 변수가 제대로 설정되지 않으면 Vercel을 재배포하세요
- API 호출 실패 시 브라우저 개발자 도구에서 에러 확인
