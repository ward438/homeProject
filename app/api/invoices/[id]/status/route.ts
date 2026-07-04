import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { updateInvoiceStatus } from '@/lib/invoices/db'
import type { InvoiceStatus } from '@/lib/types/invoice'

type RouteContext = { params: Promise<{ id: string }> }

const VALID_STATUSES: InvoiceStatus[] = [
  'draft',
  'sent',
  'paid',
  'overdue',
  'cancelled'
]

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await req.json()
    const { status } = body as { status?: string }

    if (!status || !VALID_STATUSES.includes(status as InvoiceStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const invoice = await updateInvoiceStatus(
      userId,
      id,
      status as InvoiceStatus
    )
    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ invoice })
  } catch (error) {
    console.error('[invoices status PATCH]', error)
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    )
  }
}
