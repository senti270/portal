'use client'

import { PurchaseItem } from '@/types/purchase'

interface PurchaseItemTableProps {
  items: PurchaseItem[]
  onEdit: (item: PurchaseItem) => void
  onDelete: (id: string) => void
}

export default function PurchaseItemTable({ items, onEdit, onDelete }: PurchaseItemTableProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      {/* 데스크톱 테이블 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                이미지
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                이름
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                카테고리
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                관리
              </th>
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
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                        >
                          {cat}
                        </span>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {item.purchaseUnit || '-'}
                  </td>
                  
                  {/* 관리 */}
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 뷰 */}
      <div className="md:hidden">
        {items.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
            등록된 물품이 없습니다.
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {items.map((item) => (
              <div key={item.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
                {/* 이미지와 이름 */}
                <div className="flex items-start gap-3">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-400 text-xs">이미지 없음</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm leading-tight">
                      {item.name}
                    </h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.category.map((cat, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 구입처 */}
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">구입처:</span>
                  <p className="text-sm text-gray-900 dark:text-white">{item.purchaseSource}</p>
                </div>

                {/* URL */}
                {item.url && (
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">URL:</span>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm block truncate"
                    >
                      {item.url}
                    </a>
                  </div>
                )}

                {/* 구매단위&옵션 */}
                {item.purchaseUnit && (
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">구매단위&옵션:</span>
                    <p className="text-sm text-gray-900 dark:text-white">{item.purchaseUnit}</p>
                  </div>
                )}

                {/* 관리 버튼 */}
                <div className="flex justify-end space-x-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <button
                    onClick={() => onEdit(item)}
                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 text-sm px-3 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30"
                  >
                    편집
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-sm px-3 py-1 rounded-md bg-red-50 dark:bg-red-900/30"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
