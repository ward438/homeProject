import {
  CHECKBOX_LABEL_GAP,
  checkboxNaturalWidth,
  COLUMN_GUTTER,
  COMPACT_COLUMN_GAP,
  CONTENT_TOP,
  DEFAULT_CELL_PADDING,
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_STATIC_TEXT_HEIGHT,
  DEFAULT_TABLE_HEADER_HEIGHT,
  DEFAULT_TABLE_ROW_HEIGHT,
  fieldLayoutHeight,
  isCompactRow,
  LABEL_SPACE,
  needsAboveLabel,
  PAGE_HEIGHT,
  PAGE_MARGIN,
  PAGE_WIDTH,
  ROW_GAP,
  ROW_GAP_COMPACT,
  TABLE_TITLE_HEIGHT,
  tableBlockHeight
} from '@/lib/documents/form-layout'
import type {
  FormField,
  FormFieldType,
  TableConfig
} from '@/lib/documents/types'
import type { FormBuilderPaletteItem } from '@/lib/types/form-builder'

import { C } from './theme'

// Re-export layout constants used by canvas / index
export {
  CHECKBOX_LABEL_GAP,
  checkboxNaturalWidth,
  COLUMN_GUTTER,
  COMPACT_COLUMN_GAP,
  CONTENT_TOP,
  DEFAULT_CELL_PADDING,
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_STATIC_TEXT_HEIGHT,
  DEFAULT_TABLE_HEADER_HEIGHT,
  DEFAULT_TABLE_ROW_HEIGHT,
  fieldLayoutHeight,
  isCompactRow,
  LABEL_SPACE,
  needsAboveLabel,
  PAGE_HEIGHT,
  PAGE_MARGIN,
  PAGE_WIDTH,
  ROW_GAP,
  ROW_GAP_COMPACT,
  TABLE_TITLE_HEIGHT,
  tableBlockHeight
}

// ---- Canvas geometry ---------------------------------------------------------

export const CANVAS_WIDTH = 500
export const SCALE = CANVAS_WIDTH / PAGE_WIDTH
export const px = (points: number) => points * SCALE

// ---- Drag MIME types ---------------------------------------------------------

/** Identifies a palette item drag (the value is the field type). */
export const DRAG_MIME = 'application/x-payme-field-type'
/** Identifies a reorder drag (the value is the field id). */
export const DRAG_FIELD_MIME = 'application/x-payme-field-id'

export const isBuilderDrag = (e: React.DragEvent) =>
  e.dataTransfer.types.includes(DRAG_MIME) ||
  e.dataTransfer.types.includes(DRAG_FIELD_MIME)

// ---- Field defaults ----------------------------------------------------------

export const DEFAULT_HEIGHTS: Record<FormFieldType, number> = {
  text: 24,
  checkbox: 16,
  dropdown: 24,
  radio: 60,
  'static-text': DEFAULT_STATIC_TEXT_HEIGHT,
  image: DEFAULT_IMAGE_HEIGHT,
  divider: 2,
  table: DEFAULT_TABLE_HEADER_HEIGHT + 2 * DEFAULT_TABLE_ROW_HEIGHT
}

/** Field types that produce fillable PDF form fields (vs layout-only). */
export const FILLABLE_TYPES: FormFieldType[] = [
  'text',
  'checkbox',
  'dropdown',
  'radio'
]

// ---- Palette definition ------------------------------------------------------

export const PALETTE: FormBuilderPaletteItem[] = [
  {
    type: 'text',
    label: 'Text input',
    glyph: 'T',
    color: C.accent,
    tile: 'rgba(108,158,255,0.15)'
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    glyph: '☑',
    color: C.green,
    tile: 'rgba(76,195,138,0.15)'
  },
  {
    type: 'dropdown',
    label: 'Dropdown',
    glyph: '▾',
    color: C.amber,
    tile: 'rgba(224,168,58,0.15)'
  },
  {
    type: 'radio',
    label: 'Radio Group',
    glyph: '◉',
    color: '#a78bfa',
    tile: 'rgba(167,139,250,0.15)'
  },
  {
    type: 'radio',
    label: 'Single Radio',
    glyph: '○',
    color: '#a78bfa',
    tile: 'rgba(167,139,250,0.10)',
    dragToken: 'radio-single',
    initPatch: { options: [''], optionStyles: [{}], height: 20 }
  },
  {
    type: 'static-text',
    label: 'Static Text',
    glyph: 'Aa',
    color: C.muted,
    tile: 'rgba(154,161,178,0.12)'
  },
  {
    type: 'image',
    label: 'Image',
    glyph: '🖼',
    color: C.teal,
    tile: 'rgba(46,196,182,0.12)'
  },
  {
    type: 'divider',
    label: 'Divider',
    glyph: '—',
    color: C.muted,
    tile: 'rgba(154,161,178,0.08)'
  },
  {
    type: 'table',
    label: 'Table',
    glyph: '⊞',
    color: C.amber,
    tile: 'rgba(224,168,58,0.12)'
  }
]

// ---- Data helpers ------------------------------------------------------------

export function defaultTableConfig(): TableConfig {
  return {
    columns: [
      { key: 'col1', label: 'Column 1', widthWeight: 1 },
      { key: 'col2', label: 'Column 2', widthWeight: 1 }
    ],
    rows: [
      { id: 'r1', cells: { col1: { value: '' }, col2: { value: '' } } },
      { id: 'r2', cells: { col1: { value: '' }, col2: { value: '' } } }
    ],
    headerBg: '#3b4a6b',
    headerTextColor: '#ffffff',
    titleBg: '#2c3a57',
    titleTextColor: '#ffffff',
    titleFontSize: 11,
    rowBg: '#ffffff',
    altRowBg: '#f5f6f8',
    borderColor: '#d0d4dc',
    cellPadding: 4,
    rowHeight: 20
  }
}

export function makeField(
  type: FormFieldType,
  page: number,
  row: number,
  column: number
): FormField {
  const label =
    type === 'text'
      ? 'Text field'
      : type === 'checkbox'
        ? 'Checkbox'
        : type === 'dropdown'
          ? 'Dropdown'
          : type === 'radio'
            ? 'Radio'
            : type === 'static-text'
              ? 'Section heading'
              : type === 'image'
                ? 'Image'
                : type === 'divider'
                  ? ''
                  : 'Table'
  return {
    id: crypto.randomUUID(),
    type,
    label,
    page,
    row,
    column,
    span: 1,
    x: 0,
    y: 0,
    width: 0,
    height: DEFAULT_HEIGHTS[type],
    options:
      type === 'dropdown' || type === 'radio'
        ? ['Option 1', 'Option 2']
        : undefined,
    content: type === 'static-text' ? 'Text here' : undefined,
    tableConfig: type === 'table' ? defaultTableConfig() : undefined,
    fontSize: type === 'static-text' ? 12 : undefined
  }
}

/** Renumber rows 1..n per page (by row order) and columns 1..k per row. */
export function normalize(fields: FormField[]): FormField[] {
  const result = [...fields]
  const pages = new Set(result.map(f => f.page || 1))

  for (const page of pages) {
    const rowNumbers = [
      ...new Set(
        result.filter(f => (f.page || 1) === page && f.row).map(f => f.row!)
      )
    ].sort((a, b) => a - b)

    rowNumbers.forEach((oldRow, rowIdx) => {
      const inRow = result
        .filter(f => (f.page || 1) === page && f.row === oldRow)
        .sort((a, b) => (a.column ?? 0) - (b.column ?? 0))
      inRow.forEach((field, colIdx) => {
        const i = result.findIndex(f => f.id === field.id)
        result[i] = { ...result[i], row: rowIdx + 1, column: colIdx + 1 }
      })
    })
  }

  return result
}

/**
 * Rough static-text height estimate using Helvetica proportional metrics
 * (~0.578 × fontSize per character). Matches the export's pre-sizing closely
 * enough to keep the builder's rebalance in sync without needing pdf-lib fonts.
 */
export function approxStaticTextHeight(field: FormField): number {
  const size = field.fontSize ?? 12
  const lineH = size * 1.4
  const padT = field.paddingTop ?? 4
  const padB = field.paddingBottom ?? 4
  const fw =
    (field.width && field.width > 0
      ? field.width
      : PAGE_WIDTH - 2 * PAGE_MARGIN) - 8
  const text = (
    field.contentHtml ||
    field.content ||
    field.label ||
    ''
  ).replace(/<[^>]+>/g, ' ')
  const words = text.split(/\s+/).filter(Boolean)
  let lines = 1
  let lineW = 0
  for (const word of words) {
    const ww = (word.length + 1) * size * 0.578
    if (lineW + ww > fw && lineW > 0) {
      lines++
      lineW = 0
    }
    lineW += ww
  }
  return padT + padB + lines * lineH
}

/**
 * Detects rows whose computed Y position would fall below the bottom margin and
 * auto-advances them to the next page. Runs sequentially so cascading overflow
 * (many rows pushed from page 1 → 2 → 3…) is handled in a single pass.
 */
export function rebalanceOverflow(fields: FormField[]): {
  changed: boolean
  fields: FormField[]
  maxPage: number
} {
  const result = fields.map(f => ({ ...f }))

  const seen = new Set<string>()
  const allRows: { origPage: number; rowNum: number }[] = []
  for (const f of result) {
    if (!f.row) continue
    const key = `${f.page || 1}-${f.row}`
    if (!seen.has(key)) {
      seen.add(key)
      allRows.push({ origPage: f.page || 1, rowNum: f.row })
    }
  }
  allRows.sort((a, b) =>
    a.origPage !== b.origPage ? a.origPage - b.origPage : a.rowNum - b.rowNum
  )

  let effectivePage = 1
  let cursorY = CONTENT_TOP
  let changed = false

  for (const { origPage, rowNum } of allRows) {
    if (origPage > effectivePage) {
      effectivePage = origPage
      cursorY = CONTENT_TOP
    }

    const rowFields = result.filter(
      f => (f.page || 1) === origPage && f.row === rowNum
    )
    const spacingBefore = rowFields[0]?.spacingBefore ?? 0
    cursorY -= spacingBefore

    const labelSpace = rowFields.some(f => needsAboveLabel(f)) ? LABEL_SPACE : 0
    const rowH = Math.max(
      ...rowFields.map(f =>
        f.type === 'static-text'
          ? Math.max(fieldLayoutHeight(f), approxStaticTextHeight(f))
          : fieldLayoutHeight(f)
      )
    )
    let fieldY = cursorY - labelSpace - rowH

    if (fieldY < PAGE_MARGIN) {
      effectivePage++
      cursorY = CONTENT_TOP
      fieldY = cursorY - labelSpace - rowH
    }

    if (effectivePage !== origPage) {
      for (const f of result) {
        if ((f.page || 1) === origPage && f.row === rowNum) {
          f.page = effectivePage
          changed = true
        }
      }
    }

    const spacingAfter = rowFields[0]?.spacingAfter ?? 0
    cursorY =
      fieldY -
      (isCompactRow(rowFields) ? ROW_GAP_COMPACT : ROW_GAP) -
      spacingAfter
  }

  const maxPage = Math.max(1, ...result.map(f => f.page || 1))
  return { changed, fields: changed ? normalize(result) : fields, maxPage }
}

/** Legacy templates have manual x/y and no row — give each field its own row. */
export function migrateToRows(fields: FormField[]): FormField[] {
  if (fields.every(f => f.row)) return normalize(fields)

  const migrated = [...fields]
    .sort((a, b) => (a.page || 1) - (b.page || 1) || b.y - a.y)
    .map((f, i) => ({ ...f, row: f.row ?? i + 1, column: f.column ?? 1 }))
  return normalize(migrated)
}
