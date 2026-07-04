import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { createInvoice, listInvoices } from '@/lib/invoices/db'
import type { CreateInvoiceInput, InvoiceStatus } from '@/lib/types/invoice'

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as InvoiceStatus | null

    const invoices = await listInvoices(userId, status ? { status } : undefined)
    return NextResponse.json({ invoices })
  } catch (error) {
    console.error('[invoices GET]', error)
    return NextResponse.json(
      { error: 'Failed to list invoices' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = body as CreateInvoiceInput

    if (!data.sellerInfo || !data.billedTo) {
      return NextResponse.json(
        { error: 'sellerInfo and billedTo are required' },
        { status: 400 }
      )
    }

    const invoice = await createInvoice(userId, data)
    return NextResponse.json({ invoice }, { status: 201 })
  } catch (error) {
    console.error('[invoices POST]', error)
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    )
  }
}
