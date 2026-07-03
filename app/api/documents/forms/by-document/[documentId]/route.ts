import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getFormTemplateByDocumentId } from '@/lib/documents/db'

type RouteContext = { params: Promise<{ documentId: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId } = await context.params
    const template = await getFormTemplateByDocumentId(userId, documentId)

    return NextResponse.json({ template })
  } catch (error) {
    console.error('[documents form by document GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch form template' },
      { status: 500 }
    )
  }
}
