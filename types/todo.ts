export interface TodoItem {
  id: string
  requester: string // 요청자
  task: string // 할일
  dueDate: Date | null // 마감일
  isCompleted: boolean // 완료여부
  createdAt: Date
  updatedAt: Date
}

// 별칭 추가
export type Todo = TodoItem

export interface AttachedFile {
  name: string // 파일명 (세금계산서, 견적서 등)
  data: string // Base64 인코딩된 이미지
  uploadedAt: Date // 업로드 시각
}

export interface DepositItem {
  id: string
  requester: string // 요청자
  companyName: string // 업체명
  amount: number // 금액
  bank: string // 은행
  accountNumber: string // 계좌번호
  requestDate: any // 입금요청일 (Date, Timestamp, string 등)
  taxInvoiceAttached: boolean // 세금계산서 첨부 여부
  attachedFiles?: AttachedFile[] // 첨부 파일들 (세금계산서, 견적서 등)
  isCompleted: boolean // 입금완료
  createdAt: Date
  updatedAt: Date
}

// 별칭 추가
export type Deposit = DepositItem

export type TodoTabType = 'todo' | 'deposit'
