import { System } from '@/data/systems'

interface SystemCardProps {
  system: System
  index: number
}

export default function SystemCard({ system, index }: SystemCardProps) {
  const handleClick = () => {
    if (system.url) {
      window.open(system.url, '_blank')
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`
        bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg 
        transition-all duration-300 cursor-pointer
        hover:shadow-2xl hover:-translate-y-2 hover:scale-105
        border-2 border-transparent hover:border-blue-500
        animate-slide-up
        ${system.url ? 'cursor-pointer' : 'cursor-default opacity-70'}
      `}
      style={{
        animationDelay: `${index * 0.1}s`,
      }}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl shadow-md"
            style={{ backgroundColor: system.color + '20' }}
          >
            {system.icon}
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              {system.title}
            </h3>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              {system.category}
            </span>
          </div>
        </div>
        {system.status === 'active' && (
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" title="활성" />
        )}
        {system.status === 'maintenance' && (
          <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" title="점검중" />
        )}
        {system.status === 'inactive' && (
          <div className="w-3 h-3 bg-gray-400 rounded-full" title="비활성" />
        )}
      </div>

      {/* 설명 */}
      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">
        {system.description}
      </p>

      {/* 태그 */}
      {system.tags && system.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {system.tags.map((tag, idx) => (
            <span
              key={idx}
              className="text-xs px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* 링크 표시 */}
      {system.url && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
            <span>바로가기</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </div>
        </div>
      )}

      {/* URL이 없는 경우 */}
      {!system.url && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-400 dark:text-gray-500">
            준비중
          </div>
        </div>
      )}
    </div>
  )
}

