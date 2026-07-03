import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { deleteDocument, getDocumentById } from '@/lib/documents/db'
import { deleteDocumentDir } from '@/lib/documents/storage'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const document = await getDocumentById(userId, id)
    if (!document) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ document })
  } catch (error) {
    console.error('[documents GET id]', error)
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const document = await getDocumentById(userId, id)
    if (!document) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await deleteDocumentDir(userId, id)
    await deleteDocument(userId, id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[documents DELETE id]', error)
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}
