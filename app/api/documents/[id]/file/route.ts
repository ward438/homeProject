import fs from 'fs/promises'
import path from 'path'

import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getDocumentById } from '@/lib/documents/db'
import { resolveAbsolutePath } from '@/lib/documents/storage'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
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

    const variant = req.nextUrl.searchParams.get('variant') ?? 'pdf'
    const shouldDownload = req.nextUrl.searchParams.get('download') === '1'
    const relativePath =
      variant === 'original'
        ? document.originalPath
        : document.pdfPath ?? document.originalPath

    if (!relativePath) {
      return NextResponse.json(
        { error: 'PDF not available yet' },
        { status: 404 }
      )
    }

    const absolutePath = resolveAbsolutePath(relativePath)
    const buffer = await fs.readFile(absolutePath)
    const ext = path.extname(absolutePath).toLowerCase()
    const contentType =
      ext === '.pdf'
        ? 'application/pdf'
        : ext === '.txt'
          ? 'text/plain'
          : ext === '.json'
            ? 'application/json'
            : 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${
          shouldDownload ? 'attachment' : 'inline'
        }; filename="${document.originalFilename}"`
      }
    })
  } catch (error) {
    console.error('[documents file GET]', error)
    return NextResponse.json(
      { error: 'Failed to read file' },
      { status: 500 }
    )
  }
}
