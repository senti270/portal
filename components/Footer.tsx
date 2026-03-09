'use client'

export default function Footer() {
  return (
    <footer className="mt-auto py-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            주식회사 씨디씨디씨디 / 사업자번호 431-86-03904 / 시스템 문의{' '}
            <a
              href="https://open.kakao.com/o/s0RsYvki"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium"
            >
              카카오톡 오픈채팅
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}

