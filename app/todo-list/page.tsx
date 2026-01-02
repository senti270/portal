'use client'

import TodoListManager from '@/components/TodoListManager'

export default function TodoListPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          TO DO LIST
        </h1>
        <TodoListManager />
      </div>
    </div>
  )
}






