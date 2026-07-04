import { and, desc, eq, or } from 'drizzle-orm'

import {
  type Document,
  documents,
  type FormTemplate,
  formTemplates,
  type NewDocument,
  type NewFormTemplate
} from '@/lib/db/schema'
import { withRLS } from '@/lib/db/with-rls'

import type { FormField, JsonValue, TitleStyle } from './types'

export async function createDocument(
  data: Omit<NewDocument, 'createdAt'>
): Promise<Document> {
  return withRLS(data.userId, async tx => {
    const [created] = await tx.insert(documents).values(data).returning()
    return created
  })
}

export async function updateDocument(
  userId: string,
  documentId: string,
  data: Partial<
    Pick<
      Document,
      'pdfPath' | 'status' | 'extractedText' | 'originalPath' | 'jsonData'
    >
  >
): Promise<Document | null> {
  return withRLS(userId, async tx => {
    const [updated] = await tx
      .update(documents)
      .set(data)
      .where(eq(documents.id, documentId))
      .returning()
    return updated ?? null
  })
}

export async function setDocumentJson(
  userId: string,
  documentId: string,
  jsonData: JsonValue
): Promise<Document | null> {
  return updateDocument(userId, documentId, {
    jsonData: jsonData as Document['jsonData']
  })
}

export async function getDocumentById(
  userId: string,
  documentId: string
): Promise<Document | null> {
  return withRLS(userId, async tx => {
    const [doc] = await tx
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1)
    return doc ?? null
  })
}

export async function deleteDocument(
  userId: string,
  documentId: string
): Promise<boolean> {
  return withRLS(userId, async tx => {
    const deleted = await tx
      .delete(documents)
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .returning({ id: documents.id })
    return deleted.length > 0
  })
}

export async function listDocuments(userId: string): Promise<Document[]> {
  return withRLS(userId, async tx => {
    return tx
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt))
  })
}

export async function createFormTemplate(
  data: Omit<NewFormTemplate, 'createdAt'> & { fields: FormField[] }
): Promise<FormTemplate> {
  return withRLS(data.userId, async tx => {
    const [created] = await tx
      .insert(formTemplates)
      .values({
        ...data,
        fields: data.fields as unknown as NewFormTemplate['fields']
      })
      .returning()
    return created
  })
}

export async function getFormTemplateByDocumentId(
  userId: string,
  documentId: string
): Promise<FormTemplate | null> {
  return withRLS(userId, async tx => {
    const [template] = await tx
      .select()
      .from(formTemplates)
      .where(
        and(
          eq(formTemplates.userId, userId),
          or(
            eq(formTemplates.exportedDocumentId, documentId),
            eq(formTemplates.sourceDocumentId, documentId)
          )
        )
      )
      .limit(1)

    return template ?? null
  })
}

export async function getFormTemplateById(
  userId: string,
  templateId: string
): Promise<FormTemplate | null> {
  return withRLS(userId, async tx => {
    const [template] = await tx
      .select()
      .from(formTemplates)
      .where(
        and(eq(formTemplates.id, templateId), eq(formTemplates.userId, userId))
      )
      .limit(1)

    return template ?? null
  })
}

export async function updateFormTemplate(
  userId: string,
  templateId: string,
  data: Partial<Pick<FormTemplate, 'name' | 'exportedDocumentId'>> & {
    fields?: FormField[]
    titleStyle?: Partial<TitleStyle>
  }
): Promise<FormTemplate | null> {
  return withRLS(userId, async tx => {
    const values: Partial<NewFormTemplate> = {}

    if (typeof data.name !== 'undefined') values.name = data.name
    if (typeof data.exportedDocumentId !== 'undefined') {
      values.exportedDocumentId = data.exportedDocumentId
    }
    if (typeof data.fields !== 'undefined') {
      values.fields = data.fields as unknown as NewFormTemplate['fields']
    }
    if (typeof data.titleStyle !== 'undefined') {
      values.config = {
        titleStyle: data.titleStyle
      } as unknown as NewFormTemplate['config']
    }

    const [updated] = await tx
      .update(formTemplates)
      .set(values)
      .where(
        and(eq(formTemplates.id, templateId), eq(formTemplates.userId, userId))
      )
      .returning()

    return updated ?? null
  })
}
