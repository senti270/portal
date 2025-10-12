export interface System {
  id: string
  title: string
  description: string
  icon: string
  color: string
  category: string
  url?: string
  status: 'active' | 'inactive' | 'maintenance'
  tags?: string[]
  optimization?: string[]
  order?: number
  createdAt?: Date
  updatedAt?: Date
}

export const systems: System[] = [
  {
    id: 'schedule',
    title: '스케줄 관리',
    description: '매장의 스케줄 및 직원, 급여를 관리하는 시스템입니다.',
    icon: '📅',
    color: '#3B82F6',
    category: '업무관리',
    url: 'https://work-schedule-next.vercel.app/',
    status: 'active',
    tags: ['일정', '캘린더', '스케줄'],
    optimization: ['PC 최적화'],
    order: 1,
  },
  {
    id: 'attendance',
    title: '근무시간 및 급여',
    description: '직원들의 근무시간 기록 및 급여를 확인할 수 있습니다.',
    icon: '👥',
    color: '#10B981',
    category: '인사관리',
    url: '', // 실제 URL로 변경하세요
    status: 'active',
    tags: ['근태', '급여', '인사'],
    order: 2,
  },
  {
    id: 'purchase',
    title: '구매 물품 리스트',
    description: '매장에 필요한 발주물품목록입니다.',
    icon: '🛒',
    color: '#F59E0B',
    category: '구매관리',
    url: '/purchase-list',
    status: 'active',
    tags: ['구매', '발주', '재고'],
    order: 3,
  },
  {
    id: 'naver-ranking',
    title: '네이버 순위 확인',
    description: '각 매장별로 설정한 키워드로 네이버 블로그상위순위를 조회합니다.',
    icon: '📊',
    color: '#8B5CF6',
    category: '마케팅',
    url: 'https://web-production-1d90.up.railway.app/',
    status: 'active',
    tags: ['SEO', '순위', '분석', '블로그'],
    optimization: ['PC 최적화', '모바일 최적화'],
    order: 4,
  },
  {
    id: 'naver-refund',
    title: '네이버예약 환불접수',
    description: '네이버 예약내역 환불 접수',
    icon: '📝',
    color: '#FF6B6B',
    category: '고객서비스',
    url: '/naver-refund',
    status: 'active',
    tags: ['환불', '네이버', '예약'],
    optimization: ['PC 최적화', '모바일 최적화'],
    order: 5,
  },
  {
    id: 'ranking-tracker',
    title: '네이버 순위 추적',
    description: '스마트 플레이스 키워드별 노출 순위를 자동으로 추적하고 기록합니다.',
    icon: '📈',
    color: '#10B981',
    category: '마케팅',
    url: '/ranking-tracker',
    status: 'active',
    tags: ['SEO', '순위', '자동추적', '키워드'],
    optimization: ['PC 최적화', '모바일 최적화'],
    order: 6,
  },
  {
    id: 'manual-management',
    title: '매뉴얼 관리',
    description: '매장별 매뉴얼을 관리하고 조회할 수 있습니다.',
    icon: '📚',
    color: '#8B5CF6',
    category: '업무관리',
    url: '/manual-viewer',
    status: 'active',
    tags: ['매뉴얼', '가이드', '도움말'],
    optimization: ['PC 최적화', '모바일 최적화'],
    order: 7,
  },
  // 아래는 예시 - 나중에 추가할 시스템들
  {
    id: 'example1',
    title: '시스템 추가 예정',
    description: '새로운 시스템을 여기에 추가할 수 있습니다.',
    icon: '➕',
    color: '#6B7280',
    category: '기타',
    status: 'inactive',
    tags: ['준비중'],
    order: 8,
  },
]

// 새로운 시스템 추가 방법:
// 위 배열에 새로운 객체를 추가하면 자동으로 화면에 표시됩니다.
// 
// 예시:
// {
//   id: 'new-system',
//   title: '새 시스템',
//   description: '새로운 시스템 설명',
//   icon: '🎯',
//   color: '#EC4899',
//   category: '카테고리명',
//   url: 'https://example.com',
//   status: 'active',
//   tags: ['태그1', '태그2'],
// }

