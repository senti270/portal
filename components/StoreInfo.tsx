'use client'

import { Store } from '@/types/ranking'

interface StoreInfoProps {
  store: Store
}

export default function StoreInfo({ store }: StoreInfoProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
        {/* 지점 이미지 */}
        <div className="w-24 h-24 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden flex-shrink-0">
          {store.imageUrl ? (
            <img
              src={store.imageUrl}
              alt={store.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-3xl">🏪</span>
          )}
        </div>

        {/* 지점 정보 */}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {store.name}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            📍 {store.address}
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
            🏷️ {store.category}
          </p>
          
          {/* 바로가기 링크 */}
          <div className="flex gap-3">
            {store.mobileUrl && (
              <a
                href={store.mobileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
              >
                📱 모바일
              </a>
            )}
            {store.pcUrl && (
              <a
                href={store.pcUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
              >
                💻 PC
              </a>
            )}
          </div>
        </div>

        {/* 안내 문구 */}
        <div className="w-full md:w-80">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              💡 스마트 플레이스 순위 추적은 네이버 지도에 등록된 가게의 노출 순위를 확인하실 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}





