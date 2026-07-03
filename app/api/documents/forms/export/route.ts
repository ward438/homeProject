import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import {
  createDocument,
  createFormTemplate
} from '@/lib/documents/db'
import { exportFormPdf } from '@/lib/documents/form-export'
import {
  createDocumentId,
  resolveRelativePath,
  savePdfFile
} from '@/lib/documents/storage'
import type { FormExportRequest, FormField } from '@/lib/documents/types'

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as FormExportRequest
    const { name, fields, titleStyle, sourceDocumentId } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json(
        { error: 'At least one form field is required' },
        { status: 400 }
      )
    }

    const pdfBuffer = await exportFormPdf(name, fields as FormField[], titleStyle)
    const documentId = createDocumentId()
    const pdfPath = await savePdfFile(userId, documentId, pdfBuffer, 'form')

    const document = await createDocument({
      id: documentId,
      userId,
      originalFilename: `${name.replace(/\s+/g, '_')}_form.pdf`,
      originalMimeType: 'application/pdf',
      originalPath: resolveRelativePath(pdfPath),
      pdfPath: resolveRelativePath(pdfPath),
      status: 'ready',
      extractedText: null
    })

    const template = await createFormTemplate({
      userId,
      name,
      fields: fields as FormField[],
      config: titleStyle ? { titleStyle } : {},
      sourceDocumentId: sourceDocumentId ?? null,
      exportedDocumentId: documentId
    })

    return NextResponse.json({ template, document })
  } catch (error) {
    console.error('[documents forms export]', error)
    return NextResponse.json(
      { error: 'Form export failed' },
      { status: 500 }
    )
  }
}
