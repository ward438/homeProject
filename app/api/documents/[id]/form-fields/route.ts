import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getDocumentById } from '@/lib/documents/db'
import { readPdfFormFields } from '@/lib/documents/form-read'
import { readFileBuffer, resolveAbsolutePath } from '@/lib/documents/storage'

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

    if (!document.pdfPath) {
      return NextResponse.json({ fields: [] })
    }

    const buffer = await readFileBuffer(resolveAbsolutePath(document.pdfPath))
    const fields = await readPdfFormFields(buffer)

    return NextResponse.json({ fields })
  } catch (error) {
    console.error('[documents form fields GET]', error)
    return NextResponse.json(
      { error: 'Failed to read form fields' },
      { status: 500 }
    )
  }
}
