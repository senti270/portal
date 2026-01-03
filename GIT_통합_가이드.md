# Git 통합 가이드

## 📋 현재 상황

- `portal` 프로젝트에 `work-schedule-next` 통합 완료
- Firebase 통합 완료 (`portal-fc7ae`)
- 통합된 파일들을 Git에 커밋 필요

## 🔄 Git 통합 단계

### 1단계: 변경사항 확인

```bash
cd C:\Users\senti\OneDrive\cursor_project\portal
git status
```

### 2단계: 통합된 파일들 추가

```bash
# 모든 변경사항 추가
git add .

# 또는 선택적으로 추가
git add app/
git add components/
git add lib/
git add scripts/
git add utils/
git add package.json
git add postcss.config.mjs
git add FIREBASE_통합_가이드.md
```

### 3단계: 커밋

```bash
git commit -m "feat: work-schedule-next 프로젝트 통합

- work-schedule-next 파일들을 portal로 통합
- Firebase 프로젝트 통합 (workschedule-8fc6f → portal-fc7ae)
- Tailwind CSS v4 설정 업데이트
- 라우팅 구조 변경 (/work-schedule)
- Authentication 사용자 마이그레이션"
```

### 4단계: 원격 저장소에 푸시 (선택사항)

```bash
git push origin main
# 또는
git push origin master
```

## 📝 커밋 전 확인사항

### ✅ 커밋해야 할 파일들
- `app/(work-schedule)/` - work-schedule 라우트
- `app/work-schedule/` - work-schedule 메인 페이지
- `components/work-schedule/` - work-schedule 컴포넌트들
- `lib/work-schedule/` - work-schedule 유틸리티
- `scripts/work-schedule/` - work-schedule 스크립트
- `utils/work-schedule/` - work-schedule 유틸리티
- `package.json` - 의존성 업데이트
- `postcss.config.mjs` - Tailwind CSS v4 설정
- `FIREBASE_통합_가이드.md` - 통합 가이드

### ❌ 커밋하지 말아야 할 파일들
- `.env.local` - 환경 변수 (이미 .gitignore에 포함됨)
- `node_modules/` - 의존성 (이미 .gitignore에 포함됨)
- `.next/` - 빌드 출력 (이미 .gitignore에 포함됨)

## 🔀 work-schedule-next Git 히스토리 병합 (선택사항)

만약 `work-schedule-next`의 Git 히스토리를 보존하고 싶다면:

### 방법 1: Subtree 병합

```bash
cd C:\Users\senti\OneDrive\cursor_project\portal

# work-schedule-next를 subtree로 추가
git subtree add --prefix=work-schedule-history \
  ../work-schedule-next main --squash
```

### 방법 2: 히스토리 보존 없이 통합 (권장)

현재 상태 그대로 커밋하는 것이 가장 간단합니다.

## 📋 체크리스트

- [ ] `.gitignore` 확인 (`.env.local` 제외 확인)
- [ ] 변경사항 확인 (`git status`)
- [ ] 파일 추가 (`git add`)
- [ ] 커밋 메시지 작성
- [ ] 커밋 실행 (`git commit`)
- [ ] 원격 저장소 푸시 (선택)

## ⚠️ 주의사항

1. **환경 변수 확인**: `.env.local`이 커밋되지 않았는지 확인
2. **민감한 정보**: API 키, 비밀번호 등이 코드에 하드코딩되지 않았는지 확인
3. **대용량 파일**: 이미지, PDF 등 대용량 파일은 Git LFS 사용 고려

