import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  Timestamp 
} from 'firebase/firestore'
import { db } from './firebase'

const COLLECTION_NAME = 'employmentContracts'

export interface EmploymentContract {
  id: string
  branchId: string
  branchName: string
  employeeId?: string
  employeeInfo: {
    name: string
    residentNumber: string
    address: string
    phone: string
    email?: string
  }
  contractInfo: {
    startDate: Date
    endDate?: Date
    workType: string
    workPlace: string
    workContent?: string
    employmentType?: string // 고용형태 ('근로소득', '사업소득', '일용직', '외국인')
    salaryType: 'hourly' | 'monthly' | 'daily'
    salaryAmount: number
    includesWeeklyHoliday?: boolean // 주휴수당 포함 여부
    weeklyWorkHours?: number
    dailyWorkHours?: number
    workDays?: string
    workStartTime?: string
    workEndTime?: string
    breakTime?: number
    probationPeriod?: number
    notes?: string
  }
  signatures: {
    employee: {
      signatureImage: string
      signedAt: Timestamp
      signedBy: string
    }
    employer: {
      signatureImage: string
      signedAt: Timestamp
      signedBy: string
    }
  }
  contractFile?: string
  contractDocxFile?: string
  contractFileName?: string
  status: 'draft' | 'signed' | 'completed'
  createdAt: Date
  updatedAt: Date
  signedAt?: Date
}

// Firestore 데이터를 EmploymentContract로 변환
const firestoreToContract = (id: string, data: any): EmploymentContract => {
  return {
    id,
    branchId: data.branchId,
    branchName: data.branchName,
    employeeId: data.employeeId,
    employeeInfo: data.employeeInfo,
    contractInfo: {
      ...data.contractInfo,
      startDate: data.contractInfo.startDate?.toDate ? data.contractInfo.startDate.toDate() : new Date(data.contractInfo.startDate),
      endDate: data.contractInfo.endDate?.toDate ? data.contractInfo.endDate.toDate() : (data.contractInfo.endDate ? new Date(data.contractInfo.endDate) : undefined)
    },
    signatures: {
      employee: {
        ...data.signatures.employee,
        signedAt: data.signatures.employee.signedAt?.toDate ? data.signatures.employee.signedAt.toDate() : new Date()
      },
      employer: {
        ...data.signatures.employer,
        signedAt: data.signatures.employer.signedAt?.toDate ? data.signatures.employer.signedAt.toDate() : new Date()
      }
    },
    contractFile: data.contractFile,
    contractDocxFile: data.contractDocxFile,
    contractFileName: data.contractFileName,
    status: data.status || 'draft',
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
    signedAt: data.signedAt?.toDate ? data.signedAt.toDate() : (data.signedAt ? new Date(data.signedAt) : undefined)
  }
}

// 근로계약서 저장
export async function saveEmploymentContract(
  contract: Omit<EmploymentContract, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    const contractsRef = collection(db, COLLECTION_NAME)
    const now = Timestamp.now()
    
    // Base64 데이터 크기 확인 (Firestore 문서 크기 제한: 1MB)
    if (contract.contractFile && contract.contractFile.startsWith('data:')) {
      const base64Size = contract.contractFile.length
      const sizeInMB = base64Size / (1024 * 1024)
      console.log(`📊 Base64 데이터 크기: ${sizeInMB.toFixed(2)}MB (${base64Size} bytes)`)
      
      if (sizeInMB > 0.9) {
        console.warn('⚠️ Base64 데이터가 1MB에 가깝습니다. Firestore 저장이 실패할 수 있습니다.')
        throw new Error(`파일 크기가 너무 큽니다 (${sizeInMB.toFixed(2)}MB). 1MB 이하로 줄여주세요.`)
      }
    }
    
    const contractData = {
      ...contract,
      contractInfo: {
        ...contract.contractInfo,
        startDate: Timestamp.fromDate(contract.contractInfo.startDate),
        endDate: contract.contractInfo.endDate ? Timestamp.fromDate(contract.contractInfo.endDate) : null,
        // salaryAmount가 제대로 포함되도록 명시적으로 설정
        salaryAmount: contract.contractInfo.salaryAmount || 0,
        salaryType: contract.contractInfo.salaryType,
        employmentType: contract.contractInfo.employmentType
      },
      signatures: {
        employee: {
          ...contract.signatures.employee,
          signedAt: contract.signatures.employee.signedAt instanceof Timestamp 
            ? contract.signatures.employee.signedAt 
            : Timestamp.fromDate(contract.signatures.employee.signedAt as any)
        },
        employer: {
          ...contract.signatures.employer,
          signedAt: contract.signatures.employer.signedAt instanceof Timestamp 
            ? contract.signatures.employer.signedAt 
            : Timestamp.fromDate(contract.signatures.employer.signedAt as any)
        }
      },
      signedAt: contract.signedAt ? Timestamp.fromDate(contract.signedAt) : now,
      createdAt: now,
      updatedAt: now
    }
    
    console.log('💾 Firestore에 저장할 데이터 준비 완료')
    const docRef = await addDoc(contractsRef, contractData)
    console.log('✅ Firestore 저장 성공, document ID:', docRef.id)
    return docRef.id
  } catch (error) {
    console.error('❌ Error saving employment contract:', error)
    console.error('오류 상세:', {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: (error as any)?.code,
      errorStack: error instanceof Error ? error.stack : undefined,
      contractFileSize: contract.contractFile?.length || 0
    })
    throw error
  }
}

// 근로계약서 조회 (ID로)
export async function getEmploymentContract(contractId: string): Promise<EmploymentContract | null> {
  try {
    const contractRef = doc(db, COLLECTION_NAME, contractId)
    const contractSnap = await getDoc(contractRef)
    
    if (!contractSnap.exists()) {
      return null
    }
    
    return firestoreToContract(contractSnap.id, contractSnap.data())
  } catch (error) {
    console.error('Error getting employment contract:', error)
    throw error
  }
}

// 근로계약서 목록 조회 (지점별)
export async function getEmploymentContractsByBranch(branchId: string): Promise<EmploymentContract[]> {
  try {
    const contractsRef = collection(db, COLLECTION_NAME)
    const q = query(contractsRef, where('branchId', '==', branchId))
    const querySnapshot = await getDocs(q)
    
    return querySnapshot.docs.map(doc => firestoreToContract(doc.id, doc.data()))
  } catch (error) {
    console.error('Error getting employment contracts by branch:', error)
    throw error
  }
}

// 근로계약서 목록 조회 (직원별)
export async function getEmploymentContractsByEmployee(employeeId: string): Promise<EmploymentContract[]> {
  try {
    const contractsRef = collection(db, COLLECTION_NAME)
    const q = query(contractsRef, where('employeeId', '==', employeeId))
    const querySnapshot = await getDocs(q)
    
    return querySnapshot.docs.map(doc => firestoreToContract(doc.id, doc.data()))
  } catch (error) {
    console.error('Error getting employment contracts by employee:', error)
    throw error
  }
}

// 근로계약서 업데이트
export async function updateEmploymentContract(
  contractId: string,
  updates: Partial<EmploymentContract>
): Promise<void> {
  try {
    const contractRef = doc(db, COLLECTION_NAME, contractId)
    const updateData: any = {
      ...updates,
      updatedAt: Timestamp.now()
    }
    
    // Date 객체를 Timestamp로 변환
    if (updates.contractInfo) {
      if (updates.contractInfo.startDate) {
        updateData.contractInfo.startDate = Timestamp.fromDate(updates.contractInfo.startDate)
      }
      if (updates.contractInfo.endDate) {
        updateData.contractInfo.endDate = Timestamp.fromDate(updates.contractInfo.endDate)
      }
    }
    
    await updateDoc(contractRef, updateData)
  } catch (error) {
    console.error('Error updating employment contract:', error)
    throw error
  }
}

// 근로계약서 삭제
export async function deleteEmploymentContract(contractId: string): Promise<void> {
  try {
    const contractRef = doc(db, COLLECTION_NAME, contractId)
    await deleteDoc(contractRef)
  } catch (error) {
    console.error('Error deleting employment contract:', error)
    throw error
  }
}

