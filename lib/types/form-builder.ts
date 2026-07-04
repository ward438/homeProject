import type { FormField, FormFieldType } from '@/lib/documents/types'

/**
 * A single item in the form builder drag palette.
 * Each entry describes one field type the user can drag onto the canvas.
 */
export type FormBuilderPaletteItem = {
  type: FormFieldType
  label: string
  glyph: string
  color: string
  tile: string
  /** Custom drag token sent via the drag MIME type (overrides type when set). */
  dragToken?: string
  /** Extra field properties applied when this palette item is dropped. */
  initPatch?: Partial<FormField>
}

/**
 * The shape of the form template API response used inside the form builder.
 */
export type FormTemplateApiResponse = {
  template: {
    id: string
    name: string
    fields: FormField[]
    exportedDocumentId?: string | null
  } | null
}

/**
 * Props for the FormBuilder component.
 */
export type FormBuilderProps = {
  sourceDocumentId: string | null
  onExported: (documentId?: string) => void
}
