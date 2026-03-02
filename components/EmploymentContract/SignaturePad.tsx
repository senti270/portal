'use client'

import { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'

interface SignaturePadProps {
  onComplete: (signature: string) => void
  onClear: () => void
}

export default function SignaturePad({ onComplete, onClear }: SignaturePadProps) {
  const canvasRef = useRef<SignatureCanvas>(null)
  const [isEmpty, setIsEmpty] = useState(true)

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
      <div className="border-2 border-gray-300 rounded-lg p-4 bg-white">
        <SignatureCanvas
          ref={canvasRef}
          onEnd={() => {
            const canvas = canvasRef.current
            if (canvas) {
              setIsEmpty(canvas.isEmpty())
            }
          }}
          canvasProps={{
            width: 800,
            height: 300,
            className: 'signature-canvas w-full border border-gray-200 rounded'
          }}
          backgroundColor="#ffffff"
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

