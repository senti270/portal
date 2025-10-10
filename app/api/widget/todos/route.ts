import { NextRequest, NextResponse } from 'next/server'
import { getTodos } from '@/lib/todo-firestore'

// Android 위젯 전용 API - 최소한의 데이터만 반환
export async function GET(request: NextRequest) {
  try {
    const todos = await getTodos()
    
    // 미완료 할일만 필터링 (위젯에서는 미완료만 보여주는 게 좋음)
    const incompleteTodos = todos.filter(todo => !todo.isCompleted)
    
    // 위젯용 초간소 데이터
    const widgetData = incompleteTodos.slice(0, 5).map(todo => ({
      id: todo.id,
      task: todo.task.length > 20 ? todo.task.substring(0, 20) + '...' : todo.task,
      dueDate: todo.dueDate,
      requester: todo.requester
    }))

    return NextResponse.json({
      success: true,
      todos: widgetData,
      totalCount: todos.length,
      incompleteCount: incompleteTodos.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Widget API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Widget API failed' },
      { status: 500 }
    )
  }
}
