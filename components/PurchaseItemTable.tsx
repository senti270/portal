'use client'

import { PurchaseItem, PurchaseItemFormData } from '@/types/purchase'
import PurchaseItemForm from './PurchaseItemForm'

interface PurchaseItemTableProps {
  items: PurchaseItem[]
  onEdit: (item: PurchaseItem) => void
  onDelete: (id: string) => void
  onCategoryFilter?: (category: string) => void
  selectedCategory?: string
  editingItem?: PurchaseItem | null
  onEditSubmit?: (data: PurchaseItemFormData) => void
  onEditCancel?: () => void
  isAdmin: boolean
}

export default function PurchaseItemTable({ 
  items, 
  onEdit, 
  onDelete, 
  onCategoryFilter, 
  selectedCategory,
  editingItem,
  onEditSubmit,
  onEditCancel,
  isAdmin
}: PurchaseItemTableProps) {
  return (
    <div>
      {/* 데스크톱 테이블 */}
      <div className="hidden md:block overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                이미지
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                이름
              </th>
              <th 
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer transition-colors ${
                  onCategoryFilter 
                    ? 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300' 
                    : 'text-gray-500 dark:text-gray-300'
                }`}
                onClick={() => onCategoryFilter && onCategoryFilter('')}
                title={onCategoryFilter ? "카테고리 클릭으로 필터링" : ""}
              >
                카테고리
                {onCategoryFilter && (
                  <span className="ml-1 text-xs">🔍</span>
                )}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                구입처
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                URL
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                구매단위&옵션
              </th>
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  관리
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  등록된 물품이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <>
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  {/* 이미지 */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                        <span className="text-gray-400 text-xs">이미지 없음</span>
                      </div>
                    )}
                  </td>
                  
                  {/* 이름 */}
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.name}
                    </div>
                  </td>
                  
                  {/* 카테고리 */}
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {item.category.map((cat, index) => (
                        <button
                          key={index}
                          onClick={() => onCategoryFilter && onCategoryFilter(cat)}
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                            selectedCategory === cat
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 ring-2 ring-green-500'
                              : onCategoryFilter
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 cursor-pointer'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}
                          title={onCategoryFilter ? `"${cat}" 카테고리로 필터링` : ''}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </td>
                  
                  {/* 구입처 */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {item.purchaseSource}
                  </td>
                  
                  {/* URL */}
                  <td className="px-6 py-4">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm truncate max-w-32 block"
                      >
                        {item.url}
                      </a>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  
                  {/* 구매단위&옵션 */}
                  <td className="px-6 py-4 text-xs text-gray-900 dark:text-white max-w-[200px]">
                    <div className="line-clamp-2">
                      {item.purchaseUnit || '-'}
                    </div>
                  </td>
                  
                  {/* 관리 */}
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => onEdit(item)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          편집
                        </button>
                        <button
                          onClick={() => onDelete(item.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
                {/* 편집 폼 - 해당 아이템을 편집 중일 때만 표시 */}
                {editingItem?.id === item.id && onEditSubmit && onEditCancel && (
                  <tr key={`${item.id}-edit`}>
                    <td colSpan={7} className="px-6 py-6 bg-blue-50 dark:bg-blue-900/20">
                      <PurchaseItemForm
                        item={editingItem}
                        onSubmit={onEditSubmit}
                        onCancel={onEditCancel}
                      />
                    </td>
                  </tr>
                )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 뷰 */}
      <div className="md:hidden">
        {items.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            등록된 물품이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id}>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3 border border-gray-200 dark:border-gray-600">
                {/* 이미지와 기본 정보 */}
                <div className="flex items-start gap-3">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-400 text-xs">📦</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm leading-tight">
                      {item.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-600 dark:text-gray-300">{item.purchaseSource}</span>
                      {item.category.map((cat, index) => (
                        <button
                          key={index}
                          onClick={() => onCategoryFilter && onCategoryFilter(cat)}
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                            selectedCategory === cat
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 ring-1 ring-green-500'
                              : onCategoryFilter
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 cursor-pointer'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}
                          title={onCategoryFilter ? `"${cat}" 카테고리로 필터링` : ''}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex space-x-1">
                      <button
                        onClick={() => onEdit(item)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 text-xs px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/30"
                      >
                        편집
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 text-xs px-2 py-1 rounded bg-red-50 dark:bg-red-900/30"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>

                {/* 추가 정보 (URL, 구매단위) */}
                {(item.url || item.purchaseUnit) && (
                  <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs group"
                      >
                        <svg className="w-4 h-4 flex-shrink-0 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span className="truncate">{item.url}</span>
                      </a>
                    )}
                    {item.purchaseUnit && (
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                        <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <span>{item.purchaseUnit}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* 편집 폼 - 해당 아이템을 편집 중일 때만 표시 */}
              {editingItem?.id === item.id && onEditSubmit && onEditCancel && (
                <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <PurchaseItemForm
                    item={editingItem}
                    onSubmit={onEditSubmit}
                    onCancel={onEditCancel}
                  />
                </div>
              )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
