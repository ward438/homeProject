import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { exportInvoicePdf } from '@/lib/invoices/render-invoice-pdf'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const { documentId } = await exportInvoicePdf(userId, id)

    return NextResponse.json({ documentId })
  } catch (error) {
    console.error('[invoices export POST]', error)
    const msg = error instanceof Error ? error.message : 'Export failed'
    if (msg.includes('not found')) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
