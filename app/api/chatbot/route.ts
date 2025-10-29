import { NextRequest, NextResponse } from 'next/server'
import { getTodos, addTodo, updateTodo, deleteTodo } from '@/lib/todo-firestore'
import { getDeposits, addDeposit, updateDeposit, deleteDeposit } from '@/lib/todo-firestore'
import { getKeywords, addKeyword, updateKeyword, deleteKeyword } from '@/lib/keyword-firestore'
import { getStores, addStore, updateStore, deleteStore } from '@/lib/store-firestore'
import { getRankings, addRanking } from '@/lib/ranking-firestore'
import { getSystems } from '@/lib/firestore'

const ADMIN_PASSWORD = '43084308'

// 자연어 처리 함수들
function parseTodoCommand(message: string) {
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes('할일') || lowerMessage.includes('todo')) {
    if (lowerMessage.includes('추가') || lowerMessage.includes('등록') || lowerMessage.includes('만들')) {
      return { action: 'add_todo', message }
    } else if (lowerMessage.includes('완료') || lowerMessage.includes('체크')) {
      return { action: 'complete_todo', message }
    } else if (lowerMessage.includes('삭제') || lowerMessage.includes('지워')) {
      return { action: 'delete_todo', message }
    } else {
      return { action: 'list_todos', message }
    }
  }
  return null
}

function parseDepositCommand(message: string) {
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes('입금') || lowerMessage.includes('deposit')) {
    if (lowerMessage.includes('추가') || lowerMessage.includes('등록') || lowerMessage.includes('요청')) {
      return { action: 'add_deposit', message }
    } else if (lowerMessage.includes('완료') || lowerMessage.includes('처리')) {
      return { action: 'complete_deposit', message }
    } else if (lowerMessage.includes('삭제') || lowerMessage.includes('지워')) {
      return { action: 'delete_deposit', message }
    } else {
      return { action: 'list_deposits', message }
    }
  }
  return null
}

function parseRankingCommand(message: string) {
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes('순위') || lowerMessage.includes('ranking') || lowerMessage.includes('키워드')) {
    if (lowerMessage.includes('확인') || lowerMessage.includes('조회') || lowerMessage.includes('보여')) {
      return { action: 'check_ranking', message }
    } else if (lowerMessage.includes('추가') || lowerMessage.includes('등록')) {
      return { action: 'add_keyword', message }
    } else if (lowerMessage.includes('추적') || lowerMessage.includes('체크')) {
      return { action: 'track_ranking', message }
    } else {
      return { action: 'list_rankings', message }
    }
  }
  return null
}

function parseSystemCommand(message: string) {
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes('시스템') || lowerMessage.includes('포털') || lowerMessage.includes('상태')) {
    return { action: 'system_status', message }
  }
  return null
}

// 데이터 포맷팅 함수들
function formatTodos(todos: any[]) {
  if (todos.length === 0) {
    return '현재 등록된 할일이 없습니다.'
  }
  
  let response = `📋 **할일 목록 (${todos.length}개)**\n\n`
  todos.forEach((todo, index) => {
    const status = todo.isCompleted ? '✅' : '⏳'
    const dueDate = todo.dueDate ? ` (마감: ${new Date(todo.dueDate).toLocaleDateString('ko-KR')})` : ''
    response += `${index + 1}. ${status} **${todo.requester}**: ${todo.task}${dueDate}\n`
  })
  
  return response
}

function formatDeposits(deposits: any[]) {
  if (deposits.length === 0) {
    return '현재 등록된 입금 요청이 없습니다.'
  }
  
  let response = `💰 **입금 요청 목록 (${deposits.length}개)**\n\n`
  const totalAmount = deposits.reduce((sum, deposit) => sum + deposit.amount, 0)
  
  deposits.forEach((deposit, index) => {
    const status = deposit.isCompleted ? '✅' : '⏳'
    const amount = deposit.amount.toLocaleString('ko-KR')
    response += `${index + 1}. ${status} **${deposit.companyName}**: ${amount}원 (${deposit.requester})\n`
  })
  
  response += `\n💰 **총 입금 요청액**: ${totalAmount.toLocaleString('ko-KR')}원`
  return response
}

function formatKeywords(keywords: any[]) {
  if (keywords.length === 0) {
    return '등록된 키워드가 없습니다.'
  }
  
  let response = `🔍 **키워드 목록 (${keywords.length}개)**\n\n`
  keywords.forEach((keyword, index) => {
    const status = keyword.isActive ? '🟢' : '🔴'
    response += `${index + 1}. ${status} **${keyword.keyword}** (월 검색량: ${keyword.monthlySearchVolume.toLocaleString()})\n`
  })
  
  return response
}

function formatSystems(systems: any[]) {
  let response = `🚀 **포털 시스템 현황**\n\n`
  const activeSystems = systems.filter(s => s.status === 'active')
  const inactiveSystems = systems.filter(s => s.status === 'inactive')
  
  response += `✅ **활성 시스템**: ${activeSystems.length}개\n`
  response += `❌ **비활성 시스템**: ${inactiveSystems.length}개\n\n`
  
  response += `**주요 시스템:**\n`
  activeSystems.slice(0, 5).forEach((system, index) => {
    response += `${index + 1}. ${system.icon} **${system.title}** - ${system.description}\n`
  })
  
  return response
}

// 메인 챗봇 처리 함수
async function processMessage(message: string, password: string) {
  if (password !== ADMIN_PASSWORD) {
    return '인증에 실패했습니다. 올바른 비밀번호를 입력해주세요.'
  }

  const lowerMessage = message.toLowerCase()

  // 인사말 처리
  if (lowerMessage.includes('안녕') || lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return '안녕하세요! 포털 챗봇입니다. 무엇을 도와드릴까요? 😊\n\n💡 **사용 가능한 명령어:**\n• "할일 보여줘" - 할일 목록 조회\n• "입금 현황 알려줘" - 입금 요청 현황\n• "키워드 목록 보여줘" - 키워드 목록 조회\n• "시스템 상태 확인해줘" - 포털 시스템 현황\n• "도움말" - 더 많은 명령어 보기'
  }

  // 도움말
  if (lowerMessage.includes('도움말') || lowerMessage.includes('help')) {
    return `🤖 **포털 챗봇 도움말**\n\n**📋 할일 관리:**\n• "할일 보여줘" - 할일 목록 조회\n• "할일 추가해줘" - 새 할일 등록\n• "할일 완료 처리해줘" - 할일 완료\n\n**💰 입금 관리:**\n• "입금 현황 알려줘" - 입금 요청 현황\n• "입금 요청 등록해줘" - 새 입금 요청\n\n**🔍 순위 관리:**\n• "키워드 목록 보여줘" - 키워드 목록\n• "순위 확인해줘" - 순위 조회\n• "키워드 추가해줘" - 새 키워드 등록\n\n**🚀 시스템 관리:**\n• "시스템 상태 확인해줘" - 포털 현황\n• "오늘 뭐 해야해?" - 오늘 할 일 요약`
  }

  // 할일 관련 명령어
  const todoCommand = parseTodoCommand(message)
  if (todoCommand) {
    try {
      switch (todoCommand.action) {
        case 'list_todos':
          const todos = await getTodos()
          return formatTodos(todos)
        case 'add_todo':
          return '할일 추가 기능은 준비 중입니다. 포털에서 직접 추가해주세요.'
        case 'complete_todo':
          return '할일 완료 처리 기능은 준비 중입니다. 포털에서 직접 처리해주세요.'
        case 'delete_todo':
          return '할일 삭제 기능은 준비 중입니다. 포털에서 직접 삭제해주세요.'
      }
    } catch (error) {
      return '할일 데이터를 가져오는 중 오류가 발생했습니다.'
    }
  }

  // 입금 관련 명령어
  const depositCommand = parseDepositCommand(message)
  if (depositCommand) {
    try {
      switch (depositCommand.action) {
        case 'list_deposits':
          const deposits = await getDeposits()
          return formatDeposits(deposits)
        case 'add_deposit':
          return '입금 요청 추가 기능은 준비 중입니다. 포털에서 직접 추가해주세요.'
        case 'complete_deposit':
          return '입금 완료 처리 기능은 준비 중입니다. 포털에서 직접 처리해주세요.'
        case 'delete_deposit':
          return '입금 요청 삭제 기능은 준비 중입니다. 포털에서 직접 삭제해주세요.'
      }
    } catch (error) {
      return '입금 데이터를 가져오는 중 오류가 발생했습니다.'
    }
  }

  // 순위/키워드 관련 명령어
  const rankingCommand = parseRankingCommand(message)
  if (rankingCommand) {
    try {
      switch (rankingCommand.action) {
        case 'list_rankings':
        case 'check_ranking':
          const keywords = await getKeywords()
          return formatKeywords(keywords)
        case 'add_keyword':
          return '키워드 추가 기능은 준비 중입니다. 포털에서 직접 추가해주세요.'
        case 'track_ranking':
          return '순위 추적 기능은 준비 중입니다. 포털에서 직접 확인해주세요.'
      }
    } catch (error) {
      return '키워드 데이터를 가져오는 중 오류가 발생했습니다.'
    }
  }

  // 시스템 상태 관련 명령어
  const systemCommand = parseSystemCommand(message)
  if (systemCommand) {
    try {
      const systems = await getSystems()
      return formatSystems(systems)
    } catch (error) {
      return '시스템 정보를 가져오는 중 오류가 발생했습니다.'
    }
  }

  // 오늘 할 일 요약
  if (lowerMessage.includes('오늘') && (lowerMessage.includes('뭐') || lowerMessage.includes('할'))) {
    try {
      const todos = await getTodos()
      const deposits = await getDeposits()
      const incompleteTodos = todos.filter(todo => !todo.isCompleted)
      const incompleteDeposits = deposits.filter(deposit => !deposit.isCompleted)
      
      let response = `📅 **오늘 할 일 요약**\n\n`
      
      if (incompleteTodos.length > 0) {
        response += `📋 **할일 (${incompleteTodos.length}개):**\n`
        incompleteTodos.slice(0, 3).forEach((todo, index) => {
          response += `${index + 1}. ${todo.requester}: ${todo.task}\n`
        })
        if (incompleteTodos.length > 3) {
          response += `... 외 ${incompleteTodos.length - 3}개\n`
        }
        response += `\n`
      }
      
      if (incompleteDeposits.length > 0) {
        response += `💰 **입금 요청 (${incompleteDeposits.length}개):**\n`
        incompleteDeposits.slice(0, 3).forEach((deposit, index) => {
          response += `${index + 1}. ${deposit.companyName}: ${deposit.amount.toLocaleString()}원\n`
        })
        if (incompleteDeposits.length > 3) {
          response += `... 외 ${incompleteDeposits.length - 3}개\n`
        }
      }
      
      if (incompleteTodos.length === 0 && incompleteDeposits.length === 0) {
        response += `🎉 **오늘 완료할 일이 없습니다!**\n모든 업무가 완료되었어요.`
      }
      
      return response
    } catch (error) {
      return '오늘 할 일을 가져오는 중 오류가 발생했습니다.'
    }
  }

  // 기본 응답
  return `죄송합니다. "${message}"에 대한 답변을 찾을 수 없습니다.\n\n💡 **사용 가능한 명령어:**\n• "할일 보여줘"\n• "입금 현황 알려줘"\n• "키워드 목록 보여줘"\n• "시스템 상태 확인해줘"\n• "도움말"\n\n더 정확한 답변을 위해 구체적으로 질문해주세요! 😊`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, password } = body

    if (!message) {
      return NextResponse.json(
        { success: false, error: '메시지가 필요합니다.' },
        { status: 400 }
      )
    }

    const response = await processMessage(message, password || '')

    return NextResponse.json({
      success: true,
      response: response
    })
  } catch (error) {
    console.error('챗봇 API 오류:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '서버 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
