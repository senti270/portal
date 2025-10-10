'use client'

import { Store } from '@/types/ranking'

interface StoreSelectorProps {
  stores: Store[]
  selectedStore: Store | null
  onStoreChange: (store: Store) => void
}

export default function StoreSelector({ stores, selectedStore, onStoreChange }: StoreSelectorProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        지점 선택
      </h2>
      
      {/* 지점 카드 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {stores.map((store) => (
          <button
            key={store.id}
            onClick={() => onStoreChange(store)}
            className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
              selectedStore?.id === store.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            {/* 지점 정보 */}
            <div className="space-y-2">
              <h3 className="font-medium text-base text-gray-900 dark:text-white">
                {store.name}
              </h3>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {store.category}
              </p>
            </div>
            
            {/* 선택 표시 */}
            {selectedStore?.id === store.id && (
              <div className="absolute top-2 right-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
