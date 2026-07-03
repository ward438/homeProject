export type DocumentStatus = 'uploaded' | 'converted' | 'ready'

export type TitleStyle = {
  fontSize: number
  fontWeight: 'bold' | 'normal'
  color: string
  spacingBelow: number // extra pts between title and first content row
}

export const DEFAULT_TITLE_STYLE: TitleStyle = {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#1a1a1a',
  spacingBelow: 0
}

export type FormFieldType =
  | 'text'
  | 'checkbox'
  | 'dropdown'
  | 'radio'
  | 'static-text'
  | 'image'
  | 'divider'
  | 'table'

export type TableColumn = {
  key: string
  label: string
  labelHtml?: string
  widthWeight?: number
  align?: 'left' | 'center' | 'right'
  bgColor?: string
  textColor?: string
}

export type TableCell = {
  value: string
  isField?: boolean
}

export type TableRow = {
  id: string
  cells: Record<string, TableCell>
  bgColor?: string
  textColor?: string
}

export type TableConfig = {
  columns: TableColumn[]
  rows: TableRow[]
  headerBg?: string
  headerTextColor?: string
  titleBg?: string
  titleTextColor?: string
  titleFontSize?: number
  rowBg?: string
  altRowBg?: string
  borderColor?: string
  cellPadding?: number
  rowHeight?: number
  allowUserInput?: boolean // when true, all data cells become fillable PDF fields
}

export type DropdownOptionStyle = {
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textColor?: string
}

export type FormField = {
  id: string
  type: FormFieldType
  label: string
  page: number
  x: number
  y: number
  width: number
  height: number
  options?: string[]
  optionStyles?: DropdownOptionStyle[]
  dropdownPlaceholder?: string
  /** 1-based row index; when set, y is auto-computed at export */
  row?: number
  /** 1-based column index; when set, x/width are auto-computed at export */
  column?: number
  /** relative width weight within the row (default 1); 2 = twice as wide as a 1 */
  span?: number
  /** Rich HTML label (rendered in canvas); plain `label` extracted from this for PDF naming */
  labelHtml?: string
  /** Rich HTML body for static-text blocks (rendered in canvas) */
  contentHtml?: string
  /** checkbox label placement: beside the box (default) or above it */
  labelPosition?: 'side' | 'above'

  // Text styling (static-text + label overrides)
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textColor?: string
  textAlign?: 'left' | 'center' | 'right'
  content?: string

  // Visual styling
  backgroundColor?: string
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  // Per-corner border radius (overrides borderRadius when set)
  borderTopLeftRadius?: number
  borderTopRightRadius?: number
  borderBottomLeftRadius?: number
  borderBottomRightRadius?: number
  // Per-side border widths (override borderWidth for that side when set)
  borderTopWidth?: number
  borderRightWidth?: number
  borderBottomWidth?: number
  borderLeftWidth?: number

  // Static-text inner padding (pts)
  paddingTop?: number
  paddingBottom?: number

  // Row-level overrides (read from the first column in a row)
  spacingBefore?: number
  spacingAfter?: number
  rowBackgroundColor?: string

  // Image block
  imageData?: string
  imageObjectFit?: 'contain' | 'fill'
  freePosition?: boolean

  // Radio group layout
  radioColumns?: number

  // Table block
  tableConfig?: TableConfig
  /** Where to render the table's label: 'above' = title bar above header, 'none' = hidden */
  tableLabelPosition?: 'above' | 'none'
}

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

export type DocumentRecord = {
  id: string
  userId: string
  originalFilename: string
  originalMimeType: string
  originalPath: string
  pdfPath: string | null
  status: DocumentStatus
  extractedText: string | null
  jsonData?: JsonValue | null
  createdAt: string | Date
}

export type FormTemplateRecord = {
  id: string
  userId: string
  name: string
  fields: FormField[]
  sourceDocumentId: string | null
  exportedDocumentId?: string | null
  createdAt: string | Date
}

export type FormExportRequest = {
  name: string
  fields: FormField[]
  titleStyle?: TitleStyle
  sourceDocumentId?: string
}

export type PdfFormFieldInfo = {
  name: string
  type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'unknown'
  value?: string | boolean
  options?: string[]
}

export type JsonSummary = {
  objects: number
  arrays: number
  scalars: number
  maxDepth: number
}
