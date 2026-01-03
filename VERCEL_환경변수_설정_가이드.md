# Vercel 환경 변수 설정 가이드

## 📋 추가해야 할 환경 변수

다음 환경 변수들을 Vercel 프로젝트에 추가해야 합니다:

```env
NEXT_PUBLIC_KAKAO_APP_KEY=c5d583e5ff16d309db38add5aa9032a4
NEXT_PUBLIC_APP_URL=https://cdcdcd.kr
```

## 🔧 설정 방법

### 방법 1: Vercel 대시보드에서 설정 (권장)

1. [Vercel 대시보드](https://vercel.com/dashboard)에 로그인
2. `portal` 프로젝트 선택
3. **Settings** → **Environment Variables** 메뉴 클릭
4. 다음 환경 변수들을 추가:

   **변수 1:**
   - Key: `NEXT_PUBLIC_KAKAO_APP_KEY`
   - Value: `c5d583e5ff16d309db38add5aa9032a4`
   - Environment: `Production`, `Preview`, `Development` 모두 선택
   - **Add** 클릭

   **변수 2:**
   - Key: `NEXT_PUBLIC_APP_URL`
   - Value: `https://cdcdcd.kr`
   - Environment: `Production`, `Preview`, `Development` 모두 선택
   - **Add** 클릭

5. 환경 변수 추가 후 **Redeploy** 필요
   - 최근 배포 → **...** 메뉴 → **Redeploy** 클릭

### 방법 2: Vercel CLI로 설정

터미널에서 다음 명령어 실행:

```bash
# Vercel CLI 설치 (없는 경우)
npm i -g vercel

# Vercel 로그인
vercel login

# 프로젝트 디렉토리로 이동
cd C:\Users\senti\OneDrive\cursor_project\portal

# 환경 변수 추가
vercel env add NEXT_PUBLIC_KAKAO_APP_KEY
# 값 입력: c5d583e5ff16d309db38add5aa9032a4
# Environment 선택: Production, Preview, Development 모두 선택

vercel env add NEXT_PUBLIC_APP_URL
# 값 입력: https://cdcdcd.kr
# Environment 선택: Production, Preview, Development 모두 선택

# 환경 변수 확인
vercel env ls
```

## ⚠️ 중요 사항

1. **NEXT_PUBLIC_ 접두사**: 
   - `NEXT_PUBLIC_`로 시작하는 변수는 클라이언트 사이드에서 접근 가능합니다.
   - 카카오 SDK는 클라이언트에서 사용하므로 이 접두사가 필요합니다.

2. **환경별 설정**:
   - Production: 프로덕션 배포용
   - Preview: PR/브랜치별 배포용
   - Development: 로컬 개발용 (Vercel CLI 사용 시)

3. **재배포 필요**:
   - 환경 변수 추가 후 자동으로 재배포되지 않습니다.
   - 수동으로 **Redeploy**를 실행해야 합니다.

4. **기존 환경 변수 확인**:
   - Vercel 대시보드에서 기존 환경 변수 목록을 확인하고
   - 중복되지 않도록 주의하세요.

## 🔍 환경 변수 확인

배포 후 환경 변수가 제대로 적용되었는지 확인:

1. Vercel 대시보드 → 프로젝트 → **Deployments**
2. 최신 배포 클릭 → **Build Logs** 확인
3. 또는 배포된 사이트에서 브라우저 콘솔 확인:
   ```javascript
   console.log(process.env.NEXT_PUBLIC_KAKAO_APP_KEY);
   ```

## 📝 참고

- 환경 변수는 빌드 타임에 주입됩니다.
- 런타임에 변경하려면 재배포가 필요합니다.
- 민감한 정보는 `NEXT_PUBLIC_` 접두사 없이 서버 사이드에서만 사용하세요.

