'use client'

import React, { useState } from 'react'

interface Store {
  id: string
  name: string
  refundMessage: string
  naverMapUrl?: string
}

const stores: Store[] = [
  {
    id: 'store1',
    name: '청담장어마켓동탄점',
    refundMessage: '청담장어마켓동탄점 예약 환불 요청드립니다.\n\n예약번호: [예약번호]\n환불 사유: [사유]\n매장 위치: 동탄신도시\n\n빠른 처리를 부탁드립니다.',
    naverMapUrl: 'https://map.naver.com/p/entry/place/2056632623?lng=127.0993355&lat=37.1933444&placePath=/booking?entry=plt&from=map&fromPanelNum=1&additionalHeight=76&timestamp=202510101006&locale=ko&svcName=map_pcv5&entry=plt&searchType=place&c=14.85,0,0,0,dh'
  },
  {
    id: 'store2', 
    name: '청담장어마켓송파점',
    refundMessage: '청담장어마켓송파점 예약 환불 요청드립니다.\n\n예약번호: [예약번호]\n환불 사유: [사유]\n매장 위치: 송파구\n\n빠른 처리를 부탁드립니다.',
    naverMapUrl: 'https://map.naver.com/p/entry/place/1563424767?lng=127.1249046&lat=37.4801315&placePath=/booking?from=map&fromPanelNum=1&additionalHeight=76&timestamp=202510101116&locale=ko&svcName=map_pcv5&entry=bmp&fromPanelNum=1&additionalHeight=76&timestamp=202510101116&locale=ko&svcName=map_pcv5&entry=plt&searchType=place&c=15.00,0,0,0,dh'
  },
  {
    id: 'store3',
    name: '카페드로잉석촌호수점', 
    refundMessage: '카페드로잉석촌호수점 예약 환불 요청드립니다.\n\n예약번호: [예약번호]\n환불 사유: [사유]\n매장 위치: 석촌호수\n\n빠른 처리를 부탁드립니다.',
    naverMapUrl: 'https://map.naver.com/p/entry/place/1824352254?c=15.00,0,0,0,dh&placePath=/booking?from=map&fromPanelNum=1&additionalHeight=76&timestamp=202510101116&locale=ko&svcName=map_pcv5&entry=bmp&fromPanelNum=1&additionalHeight=76&timestamp=202510101116&locale=ko&svcName=map_pcv5'
  },
  {
    id: 'store4',
    name: '카페드로잉정자점',
    refundMessage: '카페드로잉정자점 예약 환불 요청드립니다.\n\n예약번호: [예약번호]\n환불 사유: [사유]\n매장 위치: 정자동\n\n빠른 처리를 부탁드립니다.',
    naverMapUrl: 'https://map.naver.com/p/entry/place/31427861?c=15.00,0,0,0,dh&placePath=/booking?from=map&fromPanelNum=1&additionalHeight=76&timestamp=202510101116&locale=ko&svcName=map_pcv5&entry=bmp&fromPanelNum=1&additionalHeight=76&timestamp=202510101116&locale=ko&svcName=map_pcv5'
  },
  {
    id: 'store5',
    name: '카페드로잉동탄점',
    refundMessage: '카페드로잉동탄점 예약 환불 요청드립니다.\n\n예약번호: [예약번호]\n환불 사유: [사유]\n매장 위치: 동탄신도시\n\n빠른 처리를 부탁드립니다.',
    naverMapUrl: 'https://map.naver.com/p/entry/place/1249653316?c=15.00,0,0,0,dh&placePath=/booking?from=map&fromPanelNum=1&additionalHeight=76&timestamp=202510101117&locale=ko&svcName=map_pcv5&entry=bmp&fromPanelNum=1&additionalHeight=76&timestamp=202510101117&locale=ko&svcName=map_pcv5'
  }
]

export default function NaverRefundRequest() {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [customMessage, setCustomMessage] = useState('')

  const handleStoreSelect = async (store: Store) => {
    setSelectedStore(store)
    setCustomMessage(store.refundMessage)
    
    // 예약사이트 URL 자동 복사
    if (store.naverMapUrl) {
      try {
        await navigator.clipboard.writeText(store.naverMapUrl)
        alert(`${store.name}의 예약사이트 URL이 클립보드에 복사되었습니다!`)
      } catch (error) {
        // 클립보드 API가 지원되지 않는 경우
        const textArea = document.createElement('textarea')
        textArea.value = store.naverMapUrl
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        alert(`${store.name}의 예약사이트 URL이 클립보드에 복사되었습니다!`)
      }
    }
  }

  const handleSubmit = () => {
    if (!selectedStore) {
      alert('매장을 선택해주세요.')
      return
    }

    // 네이버 고객센터 URL 생성
    const naverUrl = `https://help.naver.com/inquiry/input.help?categoryNo=15008&serviceNo=30026&lang=ko`
    
    // 모바일과 데스크톱에서 다르게 처리
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    if (isMobile) {
      // 모바일에서는 현재 창에서 이동
      window.location.href = naverUrl
    } else {
      // 데스크톱에서는 새 탭에서 열기
      window.open(naverUrl, '_blank')
    }
    
    // 안내 메시지 표시
    const mobileInstruction = isMobile ? '붙여넣기(길게 누르기 → 붙여넣기) 하세요' : '붙여넣기(Ctrl+V) 하세요'
    
    alert(`네이버 고객센터${isMobile ? '로 이동했습니다' : '가 열렸습니다'}!\n\n입력할 내용:\n\n1. 업체명 입력란에:\n"${selectedStore.name}"\n\n2. 문의내용 입력란에:\n${mobileInstruction}\n\n(예약사이트 URL이 이미 클립보드에 복사되어 있습니다)`)
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stores.map((store) => (
            <button
              key={store.id}
              onClick={() => handleStoreSelect(store)}
              className={`p-4 rounded-lg border-2 transition-all duration-200 min-h-[60px] flex items-center justify-center ${
                selectedStore?.id === store.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 text-gray-800 dark:text-gray-200'
              }`}
            >
              <span className="font-medium text-sm sm:text-base text-center leading-tight">{store.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 선택된 매장 정보 */}
      {selectedStore && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
          <p className="text-sm text-green-700 dark:text-green-300 text-center">
            <span className="font-medium">선택된 매장:</span> {selectedStore.name}
          </p>
        </div>
      )}

      {/* 제출 버튼 */}
      <div className="flex justify-center">
        <button
          onClick={handleSubmit}
          disabled={!selectedStore}
          className={`px-8 py-4 rounded-lg font-medium text-lg transition-all duration-200 ${
            selectedStore
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
              : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          }`}
        >
          네이버 고객센터로 이동
        </button>
      </div>
    </div>
  )
}
