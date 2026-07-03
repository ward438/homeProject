import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { extractText } from '@/lib/documents/analyze'
import { convertToPdf } from '@/lib/documents/convert'
import { getDocumentById, updateDocument } from '@/lib/documents/db'
import {
  readFileBuffer,
  resolveAbsolutePath,
  resolveRelativePath,
  savePdfFile
} from '@/lib/documents/storage'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, context: RouteContext) {
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

    if (document.status === 'ready' && document.pdfPath) {
      return NextResponse.json({ document })
    }

    const originalPath = resolveAbsolutePath(document.originalPath)
    const buffer = await readFileBuffer(originalPath)
    const { pdfBuffer } = await convertToPdf(
      buffer,
      document.originalMimeType,
      document.originalFilename
    )
    const pdfPath = await savePdfFile(userId, id, pdfBuffer)

    let extractedText = document.extractedText
    if (!extractedText) {
      extractedText = await extractText(pdfPath, 'application/pdf')
    }

    const updated = await updateDocument(userId, id, {
      pdfPath: resolveRelativePath(pdfPath),
      status: 'ready',
      extractedText: extractedText || null
    })

    return NextResponse.json({ document: updated })
  } catch (error) {
    console.error('[documents convert POST]', error)
    const message = error instanceof Error ? error.message : 'Conversion failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
