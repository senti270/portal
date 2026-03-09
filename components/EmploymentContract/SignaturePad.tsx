'use client'

import { useRef, useState, useEffect } from 'react'
import SignatureCanvas from 'react-signature-canvas'

interface SignaturePadProps {
  onComplete: (signature: string) => void
  onClear: () => void
}

export default function SignaturePad({ onComplete, onClear }: SignaturePadProps) {
  const canvasRef = useRef<SignatureCanvas>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isEmpty, setIsEmpty] = useState(true)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 300 })

  // 컨테이너 크기에 맞춰 캔버스 크기 조정
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current && canvasRef.current) {
        const container = containerRef.current
        const width = container.clientWidth - 32 // padding 제외
        const height = Math.max(300, Math.min(400, width * 0.375)) // 최소 300px, 최대 400px, 비율 유지
        
        setCanvasSize({ width, height })
        
        // 캔버스 크기 조정 후 좌표 재계산
        const canvas = canvasRef.current.getCanvas()
        canvas.width = width
        canvas.height = height
        canvasRef.current.clear() // 크기 변경 시 초기화
      }
    }

    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize)
    }
  }, [])

  const handleClear = () => {
    canvasRef.current?.clear()
    setIsEmpty(true)
    onClear()
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (canvas.isEmpty()) {
      alert('서명을 먼저 작성해주세요.')
      return
    }

    const signatureData = canvas.toDataURL('image/png')
    onComplete(signatureData)
  }

  return (
    <div className="space-y-4">
      <div 
        ref={containerRef}
        className="border-2 border-gray-300 rounded-lg p-4 bg-white"
        style={{ minHeight: '300px' }}
      >
        <SignatureCanvas
          ref={canvasRef}
          onEnd={() => {
            const canvas = canvasRef.current
            if (canvas) {
              setIsEmpty(canvas.isEmpty())
            }
          }}
          canvasProps={{
            width: canvasSize.width,
            height: canvasSize.height,
            className: 'signature-canvas border border-gray-200 rounded'
          }}
          backgroundColor="#ffffff"
          clearOnResize={false}
        />
      </div>
      
      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={handleClear}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
        >
          지우기
        </button>
        <div className="text-sm text-gray-600">
          {isEmpty ? '서명을 작성해주세요' : '서명이 작성되었습니다'}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isEmpty}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          서명 완료
        </button>
      </div>
    </div>
  )
}

