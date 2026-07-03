import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { extractText } from '@/lib/documents/analyze'
import { getDocumentById, updateDocument } from '@/lib/documents/db'
import { resolveAbsolutePath } from '@/lib/documents/storage'

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

    if (document.extractedText) {
      return NextResponse.json({ text: document.extractedText })
    }

    const filePath = resolveAbsolutePath(
      document.pdfPath ?? document.originalPath
    )
    const mime =
      document.pdfPath != null ? 'application/pdf' : document.originalMimeType
    const text = await extractText(filePath, mime)

    await updateDocument(userId, id, { extractedText: text || null })

    return NextResponse.json({ text })
  } catch (error) {
    console.error('[documents analyze GET]', error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
