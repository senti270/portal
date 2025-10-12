# 🚀 Vercel 배포 가이드

## 방법 1: Vercel 웹사이트에서 직접 배포 (가장 쉬움!)

### 단계 1: 준비
1. GitHub 계정이 필요합니다 (없으면 github.com에서 만들기)
2. Vercel 계정이 필요합니다 (없으면 vercel.com에서 만들기 - GitHub으로 로그인 가능)

### 단계 2: GitHub에 코드 업로드

#### 옵션 A: GitHub Desktop 사용 (추천)
1. https://desktop.github.com/ 에서 GitHub Desktop 다운로드
2. GitHub Desktop 실행 후 로그인
3. `File` > `Add Local Repository` 선택
4. 이 프로젝트 폴더 선택: `C:\Users\senti_czpx8a3\OneDrive\cursor_project\portal`
5. "Create a repository" 클릭
6. Repository name: `cdcdcd-portal` 입력
7. "Publish repository" 클릭

#### 옵션 B: 수동으로 GitHub에 업로드
1. github.com 접속 후 로그인
2. 오른쪽 상단 `+` > `New repository` 클릭
3. Repository name: `cdcdcd-portal` 입력
4. `Create repository` 클릭
5. 생성된 저장소에 파일들을 업로드

### 단계 3: Vercel에서 배포
1. https://vercel.com 접속 후 로그인
2. `Add New...` > `Project` 클릭
3. GitHub 저장소 연결 (처음이면 GitHub 연결 허용 필요)
4. `cdcdcd-portal` 저장소 선택
5. `Import` 클릭
6. Framework Preset: `Next.js` 자동 감지됨 (그대로 두기)
7. `Deploy` 클릭!

### 단계 4: 완료! 🎉
- 2-3분 후 배포 완료
- Vercel이 자동으로 URL 제공 (예: cdcdcd-portal.vercel.app)

### 단계 5: 커스텀 도메인 연결
1. Vercel 프로젝트 대시보드에서 `Settings` > `Domains` 클릭
2. `cdcdcd.kr` 입력 후 `Add` 클릭
3. Vercel이 제공하는 DNS 설정 정보 확인
4. 도메인 등록 업체 사이트 접속 (cdcdcd.kr을 구입한 곳)
5. DNS 설정에서 Vercel이 알려준 값 입력:
   - Type: `A` 또는 `CNAME`
   - Value: Vercel이 제공한 주소
6. 10-30분 후 https://cdcdcd.kr 으로 접속 가능!

---

## 방법 2: Vercel CLI 사용 (개발자용)

### 1. Node.js 설치
https://nodejs.org/ 에서 LTS 버전 다운로드 및 설치

### 2. Vercel CLI 설치
\`\`\`bash
npm install -g vercel
\`\`\`

### 3. 로그인
\`\`\`bash
vercel login
\`\`\`

### 4. 배포
프로젝트 폴더에서:
\`\`\`bash
vercel
\`\`\`

프로덕션 배포:
\`\`\`bash
vercel --prod
\`\`\`

---

## 방법 3: Git 명령어 사용 (고급 사용자용)

### 1. Git 설치
https://git-scm.com/download/win 에서 다운로드

### 2. Git 저장소 초기화 및 GitHub 푸시
\`\`\`bash
git init
git add .
git commit -m "Initial commit: cdcdcd.kr portal"
git remote add origin https://github.com/사용자명/cdcdcd-portal.git
git push -u origin main
\`\`\`

### 3. Vercel에서 GitHub 저장소 연결 (방법 1의 단계 3 참고)

---

## 🔧 배포 후 시스템 URL 업데이트

배포가 완료되면 `data/systems.ts` 파일에서 각 시스템의 실제 URL을 입력하세요:

\`\`\`typescript
{
  id: 'schedule',
  title: '스케줄 관리',
  url: 'https://your-schedule-system.com', // 👈 실제 URL로 변경
  // ...
}
\`\`\`

변경 후 다시 푸시하면 자동으로 재배포됩니다!

---

## 📝 추가 설정

### 환경 변수 설정 (필요시)
Vercel 대시보드 > Settings > Environment Variables 에서 추가

### 자동 배포
GitHub에 코드를 푸시할 때마다 자동으로 Vercel이 재배포합니다!

---

## 🆘 문제 해결

### 빌드 에러 발생시
- Vercel 대시보드에서 Build Logs 확인
- `package.json`의 의존성 버전 확인

### 도메인 연결 안될 때
- DNS 전파는 최대 48시간까지 걸릴 수 있음
- https://dnschecker.org 에서 DNS 전파 상태 확인

### 배포는 되는데 페이지가 안보일 때
- Vercel 대시보드에서 Function Logs 확인
- 브라우저 개발자 도구(F12)에서 Console 에러 확인

---

**추천 순서: 방법 1 > 방법 2 > 방법 3**

방법 1이 가장 쉽고 직관적입니다! 🚀


