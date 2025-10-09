# cdcdcd.kr 통합 포털

cdcdcd.kr 도메인을 위한 통합 업무 시스템 포털입니다.

## 🚀 기능

- 📱 **반응형 디자인** - 모바일, 태블릿, 데스크톱 모두 지원
- 🌓 **다크모드** - 자동 시스템 테마 감지 및 수동 전환
- 🔍 **실시간 검색** - 시스템 이름, 설명, 카테고리 검색
- 📊 **대시보드** - 시스템 현황 한눈에 확인
- ✨ **애니메이션** - 부드러운 UI 애니메이션
- 🎯 **쉬운 확장** - 시스템 추가/수정 용이

## 📦 현재 등록된 시스템

1. **스케줄 관리** - 팀 일정 및 개인 스케줄 관리
2. **근무시간 및 급여** - 직원 근무시간 기록 및 급여 확인
3. **구매 물품 리스트** - 구매 요청 및 발주 현황 관리
4. **네이버 순위 확인** - 검색 순위 및 키워드 분석

## 🛠 설치 및 실행

### 1. 의존성 설치
\`\`\`bash
npm install
\`\`\`

### 2. 개발 서버 실행
\`\`\`bash
npm run dev
\`\`\`

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

### 3. 프로덕션 빌드
\`\`\`bash
npm run build
npm start
\`\`\`

## ➕ 새로운 시스템 추가 방법

\`data/systems.ts\` 파일을 열고 \`systems\` 배열에 새로운 객체를 추가하세요:

\`\`\`typescript
{
  id: 'unique-id',                    // 고유 ID
  title: '시스템 이름',               // 표시될 제목
  description: '시스템 설명',         // 상세 설명
  icon: '🎯',                         // 이모지 아이콘
  color: '#EC4899',                   // 테마 색상 (HEX)
  category: '카테고리명',             // 카테고리
  url: 'https://example.com',         // 실제 시스템 URL
  status: 'active',                   // active | inactive | maintenance
  tags: ['태그1', '태그2'],           // 검색용 태그 (선택사항)
}
\`\`\`

저장하면 자동으로 포털에 표시됩니다!

## 🎨 기술 스택

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Emoji

## 📝 디렉토리 구조

\`\`\`
portal/
├── app/
│   ├── layout.tsx          # 레이아웃
│   ├── page.tsx            # 메인 페이지
│   └── globals.css         # 전역 스타일
├── components/
│   ├── SystemCard.tsx      # 시스템 카드 컴포넌트
│   ├── SearchBar.tsx       # 검색바 컴포넌트
│   └── ThemeToggle.tsx     # 테마 토글 버튼
├── data/
│   └── systems.ts          # 시스템 데이터 (여기서 시스템 추가/수정)
└── package.json
\`\`\`

## 🔧 커스터마이징

### 색상 변경
\`tailwind.config.js\`에서 색상 테마를 변경할 수 있습니다.

### 시스템 URL 설정
\`data/systems.ts\`에서 각 시스템의 \`url\` 필드에 실제 주소를 입력하세요.

### 로고 변경
\`app/page.tsx\`의 헤더 부분에서 로고와 제목을 수정할 수 있습니다.

## 📱 반응형 브레이크포인트

- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

## 🌟 주요 특징

- ✅ 서버 사이드 렌더링 (SSR)
- ✅ 정적 최적화
- ✅ 코드 스플리팅
- ✅ 이미지 최적화
- ✅ SEO 친화적
- ✅ 접근성 고려

## 📄 라이센스

이 프로젝트는 cdcdcd.kr을 위한 전용 포털입니다.

## 🤝 지원

문제가 있거나 기능 추가가 필요한 경우 관리자에게 문의하세요.
\`\`\`

---

**Made with ❤️ for cdcdcd.kr**

*Last updated: 2025-01-16*

