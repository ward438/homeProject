import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import {
  createDocument,
  getDocumentById,
  updateDocument
} from '@/lib/documents/db'
import { fillPdfForm, type PdfFillValues } from '@/lib/documents/form-fill'
import {
  createDocumentId,
  readFileBuffer,
  resolveAbsolutePath,
  resolveRelativePath,
  savePdfFile,
  writeFileBuffer
} from '@/lib/documents/storage'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const document = await getDocumentById(userId, id)
    if (!document?.pdfPath) {
      return NextResponse.json(
        { error: 'Fillable PDF not found' },
        { status: 404 }
      )
    }

    const body = (await req.json()) as {
      values?: PdfFillValues
      saveAs?: 'copy' | 'overwrite'
    }

    const values = body.values ?? {}
    const sourcePath = resolveAbsolutePath(document.pdfPath)
    const sourceBuffer = await readFileBuffer(sourcePath)
    const filledBuffer = await fillPdfForm(sourceBuffer, values)

    if (body.saveAs === 'overwrite') {
      await writeFileBuffer(sourcePath, filledBuffer)
      const updated = await updateDocument(userId, id, {
        status: 'ready'
      })
      return NextResponse.json({ document: updated })
    }

    const documentId = createDocumentId()
    const pdfPath = await savePdfFile(userId, documentId, filledBuffer, 'filled')
    const filename = document.originalFilename.replace(
      /\.pdf$/i,
      '_filled.pdf'
    )

    const created = await createDocument({
      id: documentId,
      userId,
      originalFilename: filename.endsWith('.pdf')
        ? filename
        : `${filename}_filled.pdf`,
      originalMimeType: 'application/pdf',
      originalPath: resolveRelativePath(pdfPath),
      pdfPath: resolveRelativePath(pdfPath),
      status: 'ready',
      extractedText: document.extractedText,
      jsonData: document.jsonData
    })

    return NextResponse.json({ document: created })
  } catch (error) {
    console.error('[documents fill POST]', error)
    return NextResponse.json(
      { error: 'Failed to fill PDF' },
      { status: 500 }
    )
  }
}
