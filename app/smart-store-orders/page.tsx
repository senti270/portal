'use client'

import { useState } from 'react'

export default function SmartStoreOrdersPage() {
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  const fetchOrders = async () => {
    if (!startDate || !endDate) {
      alert('시작일과 종료일을 선택하세요.')
      return
    }

    setLoading(true)
    try {
      const start = `${startDate} 00:00:00`
      const end = `${endDate} 23:59:59`
      
      const response = await fetch(
        `/api/naver-commerce/orders?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}&password=43084308`
      )
      
      const data = await response.json()
      
      if (data.success) {
        setOrders(data.orders || [])
        setSummary(data.summary || {})
      } else {
        alert('주문 조회 실패: ' + data.error)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
      alert('주문 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const sendManualReport = async () => {
    if (!summary) {
      alert('먼저 주문을 조회하세요.')
      return
    }

    setSendingMessage(true)
    try {
      const message = `
📦 **수동 주문 리포트**
📅 ${startDate} ~ ${endDate}

📊 **주문 요약**
• 총 주문: ${summary.total}건
• 신규 주문: ${summary.newOrders}건
• 배송 준비: ${summary.preparing}건
• 배송 완료: ${summary.completed}건
• 취소: ${summary.cancelled}건

${orders.length > 0 ? '━━━━━━━━━━━━━━━━' : ''}
${orders.slice(0, 10).map((order: any, index: number) => `
${index + 1}. ${order.productName || '상품명'}
   주문번호: ${order.productOrderId}
   상태: ${order.productOrderStatus}
   금액: ${order.totalPaymentAmount?.toLocaleString()}원
`).join('\n')}
${orders.length > 10 ? `\n... 외 ${orders.length - 10}건` : ''}
      `.trim()

      const response = await fetch('/api/kakao-work/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          password: '43084308'
        })
      })

      const data = await response.json()
      
      if (data.success) {
        alert('✅ 카카오워크로 메시지가 전송되었습니다!')
      } else {
        alert('메시지 전송 실패: ' + data.error)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('메시지 전송 중 오류가 발생했습니다.')
    } finally {
      setSendingMessage(false)
    }
  }

  const setToday = () => {
    const today = new Date().toISOString().split('T')[0]
    setStartDate(today)
    setEndDate(today)
  }

  const setYesterday = () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    setStartDate(yesterdayStr)
    setEndDate(yesterdayStr)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            스마트스토어 주문 알림
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            네이버 스마트스토어 주문 내역을 조회하고 카카오워크로 전송합니다.
          </p>
        </div>

        {/* 조회 패널 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            주문 조회
          </h2>
          
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                종료일
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={setToday}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                오늘
              </button>
              <button
                onClick={setYesterday}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                어제
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '조회 중...' : '주문 조회'}
            </button>
            
            {summary && (
              <button
                onClick={sendManualReport}
                disabled={sendingMessage}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingMessage ? '전송 중...' : '📤 카카오워크로 전송'}
              </button>
            )}
          </div>
        </div>

        {/* 요약 */}
        {summary && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              주문 요약
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">총 주문</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                <p className="text-sm text-blue-600 dark:text-blue-400">신규 주문</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{summary.newOrders}</p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">배송 준비</p>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{summary.preparing}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                <p className="text-sm text-green-600 dark:text-green-400">배송 완료</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{summary.completed}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
                <p className="text-sm text-red-600 dark:text-red-400">취소</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{summary.cancelled}</p>
              </div>
            </div>
          </div>
        )}

        {/* 주문 목록 */}
        {orders.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              주문 내역 ({orders.length}건)
            </h2>
            <div className="space-y-3">
              {orders.map((order: any, index: number) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {order.productName || '상품명'}
                    </h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      order.productOrderStatus === 'PAYED' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                      order.productOrderStatus === 'DELIVERING' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      order.productOrderStatus === 'DELIVERED' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                      {order.productOrderStatus}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p>주문번호: {order.productOrderId}</p>
                    <p>금액: {order.totalPaymentAmount?.toLocaleString()}원</p>
                    {order.ordererName && <p>주문자: {order.ordererName}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 안내 */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">
            💡 자동 알림 설정
          </h3>
          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
            <li>• 오전 9시: 전일 12시 ~ 당일 9시 주문 요약</li>
            <li>• 낮 12시: 오전 9시 ~ 낮 12시 변경/추가 주문</li>
            <li>• Vercel Cron Jobs로 자동 실행</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

