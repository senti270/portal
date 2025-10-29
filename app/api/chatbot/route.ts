import { NextRequest, NextResponse } from 'next/server'
import { getTodos, addTodo, updateTodo, deleteTodo } from '@/lib/todo-firestore'
import { getDeposits, addDeposit, updateDeposit, deleteDeposit } from '@/lib/todo-firestore'
import { getKeywords, addKeyword, updateKeyword, deleteKeyword } from '@/lib/keyword-firestore'
import { getStores, addStore, updateStore, deleteStore } from '@/lib/store-firestore'
import { getRankings, addRanking } from '@/lib/ranking-firestore'
import { getPurchaseItems, addPurchaseItem, updatePurchaseItem, deletePurchaseItem } from '@/lib/purchase-firestore'
import { getSystems } from '@/lib/firestore'
import { searchManuals } from '@/lib/manual-firestore'
import { addChatMessage } from '@/lib/chatbot-firestore'
import { listIntents, matchIntent, renderTemplate } from '@/lib/chatbot-intents-firestore'

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

function parsePurchaseCommand(message: string) {
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes('구매') || lowerMessage.includes('물품') || lowerMessage.includes('purchase') || lowerMessage.includes('재고')) {
    if (lowerMessage.includes('추가') || lowerMessage.includes('등록') || lowerMessage.includes('만들')) {
      return { action: 'add_purchase', message }
    } else if (lowerMessage.includes('수정') || lowerMessage.includes('편집')) {
      return { action: 'update_purchase', message }
    } else if (lowerMessage.includes('삭제') || lowerMessage.includes('지워')) {
      return { action: 'delete_purchase', message }
    } else if (lowerMessage.includes('검색') || lowerMessage.includes('찾아')) {
      return { action: 'search_purchase', message }
    } else {
      return { action: 'list_purchases', message }
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

function parseManualCommand(message: string) {
  const lowerMessage = message.toLowerCase().trim()
  // 메시지 안에 "매뉴얼/manual/문서"가 포함되면 매뉴얼 검색 동작
  if (lowerMessage.includes('매뉴얼') || lowerMessage.includes('manual') || lowerMessage.includes('문서')) {
    return { action: 'search_manuals', message }
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

function formatPurchaseItems(items: any[]) {
  if (items.length === 0) {
    return '등록된 구매물품이 없습니다.'
  }
  
  let response = `🛒 **구매물품 목록 (${items.length}개)**\n\n`
  
  items.forEach((item, index) => {
    const categories = item.category && item.category.length > 0 ? item.category.join(', ') : '미분류'
    const source = item.purchaseSource || '미지정'
    const unit = item.purchaseUnit || '개'
    
    response += `${index + 1}. **${item.name}**\n`
    response += `   📂 카테고리: ${categories}\n`
    response += `   🏪 구매처: ${source}\n`
    response += `   📦 단위: ${unit}\n`
    if (item.url) {
      response += `   🔗 링크: ${item.url}\n`
    }
    response += `\n`
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

function formatManuals(manuals: any[], keyword: string) {
  if (!manuals || manuals.length === 0) {
    return `"${keyword}"에 대한 매뉴얼을 찾지 못했습니다.`
  }
  let response = `📚 **매뉴얼 검색 결과 (${manuals.length}개)**\n\n`
  manuals.slice(0, 10).forEach((m: any, index: number) => {
    // 첫 줄 미리보기 생성
    const preview = (m.content || '').toString().replace(/\n+/g, ' ').slice(0, 80)
    response += `${index + 1}. **${m.title}**\n   ${preview}${preview.length === 80 ? '…' : ''}\n   링크: /manual-viewer?manual=${m.id}\n`
  })
  if (manuals.length > 10) {
    response += `\n… 외 ${manuals.length - 10}개 더 있음`
  }
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
    return '안녕하세요! 포털 챗봇입니다. 무엇을 도와드릴까요? 😊\n\n💡 **예시:**\n• "주차"\n• "아몬드"\n• "네이버환불"\n• "키워드 목록 보여줘"\n• "시스템 상태 확인해줘"\n• "도움말"'
  }

  // 네이버 환불 전용 안내
  if (lowerMessage.includes('네이버환불') || (lowerMessage.includes('네이버') && lowerMessage.includes('환불'))) {
    return `네이버 환불 요청은 아래 메뉴에서 진행해 주세요.\n\n• 메뉴: 네이버 환불 요청\n• 바로가기: /naver-refund`
  }

  // 도움말
  if (lowerMessage.includes('도움말') || lowerMessage.includes('help')) {
    return `🤖 **포털 챗봇 도움말**\n\n**📚 매뉴얼 검색:**\n• 일반 키워드로 검색: "주차", "아몬드", "네이버환불"\n\n**💰 입금 관리:**\n• "입금 현황 알려줘" - 입금 요청 현황\n\n**🛒 구매 관리:**\n• "구매물품 보여줘" - 구매물품 목록\n• "물품 검색해줘" - 구매물품 검색\n\n**🔍 순위 관리:**\n• "키워드 목록 보여줘" - 키워드 목록\n• "순위 확인해줘" - 순위 조회\n\n**🚀 시스템 관리:**\n• "시스템 상태 확인해줘" - 포털 현황`
  }

  // 할일 관련 명령어
  const todoCommand = parseTodoCommand(message)
  if (todoCommand) {
    return '할일 조회는 챗봇에서 제공하지 않습니다.'
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

  // 구매물품 관련 명령어
  const purchaseCommand = parsePurchaseCommand(message)
  if (purchaseCommand) {
    try {
      switch (purchaseCommand.action) {
        case 'list_purchases':
          const purchaseItems = await getPurchaseItems()
          return formatPurchaseItems(purchaseItems)
        case 'search_purchase':
          const allItems = await getPurchaseItems()
          // 간단한 검색 로직
          const searchTerm = message.toLowerCase().replace(/구매|물품|검색|찾아|해줘/g, '').trim()
          const filteredItems = allItems.filter(item => 
            item.name.toLowerCase().includes(searchTerm) ||
            item.category.some(cat => cat.toLowerCase().includes(searchTerm)) ||
            item.purchaseSource.toLowerCase().includes(searchTerm)
          )
          if (filteredItems.length === 0) {
            return `"${searchTerm}"에 대한 검색 결과가 없습니다.`
          }
          return `🔍 **"${searchTerm}" 검색 결과 (${filteredItems.length}개)**\n\n` + formatPurchaseItems(filteredItems)
        case 'add_purchase':
          return '구매물품 추가 기능은 준비 중입니다. 포털에서 직접 추가해주세요.'
        case 'update_purchase':
          return '구매물품 수정 기능은 준비 중입니다. 포털에서 직접 수정해주세요.'
        case 'delete_purchase':
          return '구매물품 삭제 기능은 준비 중입니다. 포털에서 직접 삭제해주세요.'
      }
    } catch (error) {
      return '구매물품 데이터를 가져오는 중 오류가 발생했습니다.'
    }
  }

  // 순위/키워드 관련 명령어
  const rankingCommand = parseRankingCommand(message)
  if (rankingCommand) {
    try {
      switch (rankingCommand.action) {
        case 'list_rankings':
        case 'check_ranking': {
          // 모든 지점의 키워드를 모아 간단히 보여줌
          const stores = await getStores()
          const allKeywordsArrays = await Promise.all(
            stores.map(s => getKeywords(s.id))
          )
          const allKeywords = allKeywordsArrays.flat()
          return formatKeywords(allKeywords)
        }
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

  // 매뉴얼 검색 명령어
  const manualCommand = parseManualCommand(message)
  if (manualCommand) {
    try {
      // "매뉴얼 ~검색어"에서 검색어 추출 (앞 접두사 강제)
      const term = message
        .replace(/^\s*(매뉴얼|manual|문서)\b/i, '')
        .replace(/검색|찾아|보여줘|열어줘|확인|해줘/gi, '')
        .trim()
      const searchTerm = term.length > 0 ? term : message
      const manuals = await searchManuals(searchTerm)
      return formatManuals(manuals, searchTerm)
    } catch (error) {
      return '매뉴얼을 검색하는 중 오류가 발생했습니다.'
    }
  }

  // 폴백: 다른 명령에 해당하지 않으면 매뉴얼 자동 검색 시도
  try {
    const trimmed = message.trim()
    if (trimmed.length > 1) {
      const manuals = await searchManuals(trimmed)
      if (Array.isArray(manuals) && manuals.length > 0) {
        return formatManuals(manuals, trimmed)
      }
    }
  } catch {}

  // "오늘 할 일" 요약 기능 제거 (개인 업무 데이터 노출 방지)

  // 단일 키워드 자동 구매물품 검색 (예: "박스")
  try {
    const term = lowerMessage.replace(/\s+/g, ' ').trim()
    if (term.length > 0) {
      const items = await getPurchaseItems()
      const results = items.filter(item =>
        item.name.toLowerCase().includes(term) ||
        item.purchaseSource?.toLowerCase().includes(term) ||
        (Array.isArray(item.category) && item.category.some(cat => cat.toLowerCase().includes(term)))
      )
      if (results.length > 0) {
        return `🔍 "${term}" 검색 결과 (${results.length}개)\n\n` + formatPurchaseItems(results)
      }
    }
  } catch {}

  // 기본 응답
  return `죄송합니다. "${message}"에 대한 답변을 찾을 수 없습니다.\n\n💡 **사용 가능한 명령어:**\n• "할일 보여줘"\n• "입금 현황 알려줘"\n• "구매물품 보여줘"\n• "키워드 목록 보여줘"\n• "시스템 상태 확인해줘"\n• "도움말"\n\n더 정확한 답변을 위해 구체적으로 질문해주세요! 😊`
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

    // 대화 로그 저장 (에러가 나더라도 응답은 진행)
    try {
      await addChatMessage({ role: 'user', content: message })
      await addChatMessage({ role: 'bot', content: response })
    } catch {}

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
