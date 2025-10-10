import { NextRequest, NextResponse } from 'next/server'
import { getTodos, addTodo, updateTodo, deleteTodo } from '@/lib/todo-firestore'

const ADMIN_PASSWORD = '43084308'

// GET: TODO 목록 조회 (위젯용)
export async function GET(request: NextRequest) {
  try {
    const todos = await getTodos()
    
    // Android 위젯을 위한 간소화된 데이터
    const widgetData = todos.map(todo => ({
      id: todo.id,
      requester: todo.requester,
      task: todo.task,
      dueDate: todo.dueDate,
      isCompleted: todo.isCompleted,
      createdAt: todo.createdAt.toISOString()
    }))

    return NextResponse.json({
      success: true,
      todos: todos,
      data: widgetData,
      count: todos.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching todos:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch todos' },
      { status: 500 }
    )
  }
}

// POST: TODO 추가
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { password, todo } = body

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    if (!todo || !todo.requester || !todo.task) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('API에서 받은 todo 데이터:', todo)
    
    const todoData = {
      requester: todo.requester,
      task: todo.task,
      dueDate: todo.dueDate,
      isCompleted: false
    }
    
    console.log('Firestore에 저장할 데이터:', todoData)

    const todoId = await addTodo(todoData)

    return NextResponse.json({
      success: true,
      id: todoId,
      message: 'Todo added successfully'
    })
  } catch (error) {
    console.error('❌ Error adding todo:', error)
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to add todo',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PUT: TODO 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { password, id, updates } = body

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Todo ID is required' },
        { status: 400 }
      )
    }

    console.log('PUT 요청 - ID:', id, 'Updates:', updates)
    await updateTodo(id, updates)

    return NextResponse.json({
      success: true,
      message: 'Todo updated successfully'
    })
  } catch (error) {
    console.error('❌ Error updating todo:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update todo',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE: TODO 삭제
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { password, id } = body

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Todo ID is required' },
        { status: 400 }
      )
    }

    await deleteTodo(id)

    return NextResponse.json({
      success: true,
      message: 'Todo deleted successfully'
    })
  } catch (error) {
    console.error('❌ Error deleting todo:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete todo',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
