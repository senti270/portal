'use client'

import React, { useState } from 'react'

interface Store {
  id: string
  name: string
  refundMessage: string
}

const stores: Store[] = [
  {
    id: 'store1',
    name: '강남점',
    refundMessage: '강남점 예약 환불 요청드립니다. 예약번호: [예약번호], 환불 사유: [사유]'
  },
  {
    id: 'store2', 
    name: '홍대점',
    refundMessage: '홍대점 예약 환불 요청드립니다. 예약번호: [예약번호], 환불 사유: [사유]'
  },
  {
    id: 'store3',
    name: '명동점', 
    refundMessage: '명동점 예약 환불 요청드립니다. 예약번호: [예약번호], 환불 사유: [사유]'
  },
  {
    id: 'store4',
    name: '잠실점',
    refundMessage: '잠실점 예약 환불 요청드립니다. 예약번호: [예약번호], 환불 사유: [사유]'
  }
]

export default function NaverRefundRequest() {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [customMessage, setCustomMessage] = useState('')

  const handleStoreSelect = (store: Store) => {
    setSelectedStore(store)
    setCustomMessage(store.refundMessage)
  }

  const handleSubmit = () => {
    if (!selectedStore || !customMessage) {
      alert('매장을 선택하고 메시지를 입력해주세요.')
      return
    }

    // 네이버 고객센터 URL 생성
    const encodedMessage = encodeURIComponent(customMessage)
    const naverUrl = `https://help.naver.com/inquiry/input.help?categoryNo=15008&serviceNo=30026&lang=ko&message=${encodedMessage}`
    
    // 새 탭에서 열기
    window.open(naverUrl, '_blank')
  }

  const handleCustomMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCustomMessage(e.target.value)
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        네이버 예약 환불 요청
      </h2>
      
      {/* 매장 선택 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          매장 선택
        </label>
        <div className="grid grid-cols-2 gap-3">
          {stores.map((store) => (
            <button
              key={store.id}
              onClick={() => handleStoreSelect(store)}
              className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                selectedStore?.id === store.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <span className="font-medium">{store.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 선택된 매장 정보 */}
      {selectedStore && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
          <p className="text-sm text-green-700 dark:text-green-300">
            <span className="font-medium">선택된 매장:</span> {selectedStore.name}
          </p>
        </div>
      )}

      {/* 메시지 편집 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          환불 요청 메시지
        </label>
        <textarea
          value={customMessage}
          onChange={handleCustomMessageChange}
          placeholder="매장을 선택하면 기본 메시지가 입력됩니다. 필요에 따라 수정하세요."
          className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          [예약번호], [사유] 부분을 실제 내용으로 변경해주세요.
        </p>
      </div>

      {/* 제출 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!selectedStore || !customMessage}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
            selectedStore && customMessage
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          }`}
        >
          네이버 고객센터로 이동
        </button>
      </div>

      {/* 안내 메시지 */}
      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          <span className="font-medium">안내:</span> 버튼을 클릭하면 네이버 고객센터 문의 페이지가 새 탭에서 열리며, 
          위에서 작성한 메시지가 자동으로 입력됩니다.
        </p>
      </div>
    </div>
  )
}
