import type { FormField, TableConfig } from './types'

// US Letter in PDF points
export const PAGE_WIDTH = 612
export const PAGE_HEIGHT = 792
export const PAGE_MARGIN = 50
export const COLUMN_GUTTER = 16
export const COMPACT_COLUMN_GAP = 6 // tighter gap used between checkboxes in an all-checkbox row
export const CONTENT_TOP = PAGE_HEIGHT - 90
export const LABEL_SPACE = 16
export const ROW_GAP = 22
export const ROW_GAP_COMPACT = 8
export const CHECKBOX_LABEL_GAP = 6
export const DEFAULT_STATIC_TEXT_HEIGHT = 18
export const DEFAULT_IMAGE_HEIGHT = 60
export const DEFAULT_DIVIDER_HEIGHT = 4
export const DEFAULT_TABLE_ROW_HEIGHT = 20
export const DEFAULT_TABLE_HEADER_HEIGHT = 24
export const DEFAULT_CELL_PADDING = 4
export const TABLE_TITLE_HEIGHT = 20

export type PositionedField = FormField & {
  x: number
  y: number
  width: number
}

/** Computed total height for a table block in PDF points. */
export function tableBlockHeight(cfg: TableConfig, hasTitle = false): number {
  const headerH = DEFAULT_TABLE_HEADER_HEIGHT
  const rowH = cfg.rowHeight ?? DEFAULT_TABLE_ROW_HEIGHT
  return (hasTitle ? TABLE_TITLE_HEIGHT : 0) + headerH + cfg.rows.length * rowH
}

/** Effective height of a field in layout (what drives row height). */
export function fieldLayoutHeight(field: FormField): number {
  if (field.type === 'static-text')
    return field.height || DEFAULT_STATIC_TEXT_HEIGHT
  if (field.type === 'image') return field.height || DEFAULT_IMAGE_HEIGHT
  if (field.type === 'divider') return field.height || DEFAULT_DIVIDER_HEIGHT
  if (field.type === 'table' && field.tableConfig) {
    return tableBlockHeight(
      field.tableConfig,
      field.tableLabelPosition === 'above'
    )
  }
  return field.height || 24
}

/** Does this field reserve the LABEL_SPACE line above it? */
export function needsAboveLabel(field: FormField): boolean {
  if (field.type === 'static-text') return false
  if (field.type === 'image') return false
  if (field.type === 'divider') return false
  if (field.type === 'table') return false
  return field.type !== 'checkbox' || field.labelPosition === 'above'
}

/** Approximate Helvetica text width at the 9pt label size (with padding). */
export function approxLabelWidth(label: string): number {
  return label.length * 5.2 + 6
}

/**
 * Checkboxes don't stretch to fill their column — they take their natural
 * width (box + label) so several can sit close together in one row.
 */
export function checkboxNaturalWidth(field: FormField): number {
  const box = field.height || 16
  return field.labelPosition === 'above'
    ? Math.max(box, approxLabelWidth(field.label))
    : box + CHECKBOX_LABEL_GAP + approxLabelWidth(field.label) + 4
}

/** Rows of side-labeled checkboxes stack with a tighter vertical gap. */
export function isCompactRow(rowFields: FormField[]): boolean {
  return (
    rowFields.length > 0 &&
    rowFields.every(f => f.type === 'checkbox' && f.labelPosition !== 'above')
  )
}

/**
 * Row/column auto-layout. Fields with a `row` set are laid out top-down per
 * page: Y comes from row order, X/width from the field's column slot within
 * its row. Fields without a `row` keep their manual x/y/width (legacy).
 *
 * When a row would overflow the bottom margin it is automatically advanced
 * to the next page (field.page is updated accordingly).
 *
 * Shared by the PDF export and the builder's page preview so both stay in sync.
 */
export function applyAutoLayout(
  fields: FormField[],
  contentTop = CONTENT_TOP
): PositionedField[] {
  const out: PositionedField[] = fields.map(f => ({ ...f }))

  // page -> row number -> indexes into `out`
  const pages = new Map<number, Map<number, number[]>>()
  out.forEach((field, index) => {
    if (!field.row || field.row < 1) return
    const page = field.page || 1
    let rows = pages.get(page)
    if (!rows) {
      rows = new Map()
      pages.set(page, rows)
    }
    const list = rows.get(field.row) ?? []
    list.push(index)
    rows.set(field.row, list)
  })

  // Flatten all rows sorted by (original page, row number) so we can process
  // them sequentially and auto-advance the page when content overflows.
  type RowEntry = { origPage: number; rowNumber: number; indexes: number[] }
  const allRows: RowEntry[] = []
  for (const [pageNum, rows] of [...pages.entries()].sort(
    (a, b) => a[0] - b[0]
  )) {
    for (const rowNum of [...rows.keys()].sort((a, b) => a - b)) {
      const indexes = rows
        .get(rowNum)!
        .sort((a, b) => (out[a].column ?? 0) - (out[b].column ?? 0))
      allRows.push({ origPage: pageNum, rowNumber: rowNum, indexes })
    }
  }

  let effectivePage = 1
  let cursorY = contentTop

  for (const { origPage, indexes } of allRows) {
    // User explicitly placed this row on a later page — honour that jump
    if (origPage > effectivePage) {
      effectivePage = origPage
      cursorY = contentTop
    }

    const rowFields = indexes.map(i => out[i])

    const spacingBefore = rowFields[0]?.spacingBefore ?? 0
    cursorY -= spacingBefore

    const compact = isCompactRow(rowFields)
    const colGutter = compact ? COMPACT_COLUMN_GAP : COLUMN_GUTTER

    const fixedWidths = indexes.map(i =>
      out[i].type === 'checkbox' ? checkboxNaturalWidth(out[i]) : null
    )
    const totalFixed = fixedWidths.reduce<number>((sum, w) => sum + (w ?? 0), 0)
    const weights = indexes.map((i, pos) =>
      fixedWidths[pos] != null
        ? 0
        : out[i].span && out[i].span! > 0
          ? out[i].span!
          : 1
    )
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)
    const weightDivisor = Math.max(totalWeight, 1)
    const available = Math.max(
      0,
      PAGE_WIDTH -
        2 * PAGE_MARGIN -
        (indexes.length - 1) * colGutter -
        totalFixed
    )

    const labelSpace = rowFields.some(needsAboveLabel) ? LABEL_SPACE : 0
    const rowHeight = Math.max(...indexes.map(i => fieldLayoutHeight(out[i])))
    let fieldY = cursorY - labelSpace - rowHeight

    // Auto-advance to the next page when this row overflows the bottom margin
    if (fieldY < PAGE_MARGIN) {
      effectivePage++
      cursorY = contentTop
      fieldY = cursorY - labelSpace - rowHeight
    }

    let x = PAGE_MARGIN
    indexes.forEach((i, pos) => {
      const width =
        fixedWidths[pos] ?? (available * weights[pos]) / weightDivisor
      out[i].x = x
      out[i].y = fieldY
      out[i].width = width
      out[i].page = effectivePage
      // Layout-only fields expand to fill the full row height
      if (out[i].type === 'static-text' || out[i].type === 'image') {
        out[i].height = rowHeight
      }
      // Sync table height to config so drawTable and layout agree exactly
      if (out[i].type === 'table' && out[i].tableConfig) {
        out[i].height = tableBlockHeight(
          out[i].tableConfig!,
          out[i].tableLabelPosition === 'above'
        )
      }
      x += width + colGutter
    })

    cursorY = fieldY - (isCompactRow(rowFields) ? ROW_GAP_COMPACT : ROW_GAP)

    const spacingAfter = rowFields[0]?.spacingAfter ?? 0
    cursorY -= spacingAfter
  }

  return out
}
