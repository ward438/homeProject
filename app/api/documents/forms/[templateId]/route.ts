import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import {
  getDocumentById,
  getFormTemplateById,
  updateFormTemplate
} from '@/lib/documents/db'
import { overwritePdfWithForm } from '@/lib/documents/form-update'
import { resolveAbsolutePath } from '@/lib/documents/storage'
import type { FormField } from '@/lib/documents/types'

type RouteContext = { params: Promise<{ templateId: string }> }

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { templateId } = await context.params
    const template = await getFormTemplateById(userId, templateId)
    if (!template) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = (await req.json()) as {
      name?: string
      fields?: FormField[]
      titleStyle?: { fontSize?: number; fontWeight?: 'bold' | 'normal'; color?: string; spacingBelow?: number }
    }

    const name = body.name?.trim() || template.name
    const fields = Array.isArray(body.fields)
      ? body.fields
      : (template.fields as FormField[])
    const titleStyle = body.titleStyle

    if (!template.exportedDocumentId) {
      return NextResponse.json(
        { error: 'This template is not linked to an exported PDF' },
        { status: 400 }
      )
    }

    const document = await getDocumentById(userId, template.exportedDocumentId)
    if (!document?.pdfPath) {
      return NextResponse.json(
        { error: 'Linked PDF was not found' },
        { status: 404 }
      )
    }

    await overwritePdfWithForm(resolveAbsolutePath(document.pdfPath), name, fields, titleStyle)

    const updated = await updateFormTemplate(userId, templateId, {
      name,
      fields,
      titleStyle
    })

    return NextResponse.json({ template: updated })
  } catch (error) {
    console.error('[documents form PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update form template' },
      { status: 500 }
    )
  }
}
