export interface TodoItem {
  id: string
  requester: string // 요청자
  task: string // 할일
  dueDate: Date | null // 마감일
  isCompleted: boolean // 완료여부
  createdAt: Date
  updatedAt: Date
}

export interface DepositItem {
  id: string
  requester: string // 요청자
  companyName: string // 업체명
  amount: number // 금액
  bank: string // 은행
  accountNumber: string // 계좌번호
  requestDate: string // 입금요청일 (YYYY-MM-DD)
  taxInvoice: string // 세금계산서첨부 (URL 또는 텍스트)
  isCompleted: boolean // 입금완료
  createdAt: Date
  updatedAt: Date
}

export type TodoTabType = 'todo' | 'deposit'
