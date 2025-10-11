import { NextRequest, NextResponse } from 'next/server'
import { getDeposits, addDeposit, updateDeposit, deleteDeposit } from '@/lib/todo-firestore'

const ADMIN_PASSWORD = '43084308'

// GET: 입금 목록 조회 (위젯용)
export async function GET(request: NextRequest) {
  try {
    const deposits = await getDeposits()
    
    // Android 위젯을 위한 간소화된 데이터
    const widgetData = deposits.map(deposit => ({
      id: deposit.id,
      requester: deposit.requester,
      companyName: deposit.companyName,
      amount: deposit.amount,
      bank: deposit.bank,
      accountNumber: deposit.accountNumber,
      requestDate: deposit.requestDate,
      isCompleted: deposit.isCompleted,
      createdAt: deposit.createdAt.toISOString()
    }))

    return NextResponse.json({
      success: true,
      deposits: deposits,
      data: widgetData,
      count: deposits.length,
      totalAmount: deposits.reduce((sum, d) => sum + d.amount, 0),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching deposits:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch deposits' },
      { status: 500 }
    )
  }
}

// POST: 입금 요청 추가
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { password, deposit } = body

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    if (!deposit || !deposit.requester || !deposit.companyName || deposit.amount === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: requester, companyName, amount' },
        { status: 400 }
      )
    }

    const depositData = {
      requester: deposit.requester,
      companyName: deposit.companyName,
      amount: Number(deposit.amount),
      bank: deposit.bank || '',
      accountNumber: deposit.accountNumber || '',
      requestDate: deposit.requestDate ? new Date(deposit.requestDate) : null,
      taxInvoiceAttached: deposit.taxInvoiceAttached || false,
      attachedFiles: deposit.attachedFiles || [],
      isCompleted: false
    }

    const depositId = await addDeposit(depositData)

    return NextResponse.json({
      success: true,
      id: depositId,
      message: 'Deposit request added successfully'
    })
  } catch (error) {
    console.error('❌ Error adding deposit:', error)
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to add deposit',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PUT: 입금 요청 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { password, id, updates } = body

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Deposit ID is required' },
        { status: 400 }
      )
    }

    await updateDeposit(id, updates)

    return NextResponse.json({
      success: true,
      message: 'Deposit updated successfully'
    })
  } catch (error) {
    console.error('❌ Error updating deposit:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update deposit',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE: 입금 요청 삭제
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { password, id } = body

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Deposit ID is required' },
        { status: 400 }
      )
    }

    await deleteDeposit(id)

    return NextResponse.json({
      success: true,
      message: 'Deposit deleted successfully'
    })
  } catch (error) {
    console.error('❌ Error deleting deposit:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete deposit',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
