import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { extractText } from '@/lib/documents/analyze'
import { ALLOWED_MIMES, MAX_DOCUMENT_SIZE } from '@/lib/documents/constants'
import { convertToPdf } from '@/lib/documents/convert'
import { createDocument, listDocuments } from '@/lib/documents/db'
import { safeParseJson } from '@/lib/documents/json'
import {
  createDocumentId,
  getMimeFromFilename,
  resolveRelativePath,
  saveOriginalFile,
  savePdfFile
} from '@/lib/documents/storage'
import type { JsonValue } from '@/lib/documents/types'

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const docs = await listDocuments(userId)
    return NextResponse.json({ documents: docs })
  } catch (error) {
    console.error('[documents GET]', error)
    return NextResponse.json(
      { error: 'Failed to list documents' },
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

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (file.size > MAX_DOCUMENT_SIZE) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_DOCUMENT_SIZE / 1024 / 1024}MB)` },
        { status: 400 }
      )
    }

    const mimeType =
      file.type || getMimeFromFilename(file.name) || 'application/octet-stream'

    if (!ALLOWED_MIMES.includes(mimeType as (typeof ALLOWED_MIMES)[number])) {
      return NextResponse.json(
        { error: 'Unsupported file type. Allowed: PDF, TXT, DOCX, JSON' },
        { status: 400 }
      )
    }

    const documentId = createDocumentId()
    const buffer = Buffer.from(await file.arrayBuffer())
    const originalPath = await saveOriginalFile(
      userId,
      documentId,
      file.name,
      buffer
    )

    let pdfPath: string | null = null
    let status: 'uploaded' | 'converted' | 'ready' = 'uploaded'
    let extractedText = ''
    let jsonData: JsonValue | null = null

    if (mimeType === 'application/json' || mimeType === 'text/json') {
      const parsed = safeParseJson(buffer.toString('utf-8'))
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 })
      }
      jsonData = parsed.value
      extractedText = JSON.stringify(parsed.value, null, 2)
      status = 'ready'
    } else if (mimeType === 'application/pdf') {
      pdfPath = originalPath
      status = 'ready'
    } else {
      try {
        extractedText = await extractText(originalPath, mimeType)
      } catch (err) {
        console.warn('[documents upload] text extraction failed:', err)
      }

      try {
        const { pdfBuffer } = await convertToPdf(buffer, mimeType, file.name)
        pdfPath = await savePdfFile(userId, documentId, pdfBuffer)
        status = 'ready'
        if (!extractedText && pdfPath) {
          extractedText = await extractText(pdfPath, 'application/pdf')
        }
      } catch (err) {
        console.warn('[documents upload] conversion failed:', err)
        status = 'uploaded'
      }
    }

    const document = await createDocument({
      id: documentId,
      userId,
      originalFilename: file.name,
      originalMimeType: mimeType,
      originalPath: resolveRelativePath(originalPath),
      pdfPath: pdfPath ? resolveRelativePath(pdfPath) : null,
      status,
      extractedText: extractedText || null,
      jsonData
    })

    return NextResponse.json({ document })
  } catch (error) {
    console.error('[documents upload]', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
