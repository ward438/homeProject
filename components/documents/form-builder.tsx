'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'

import { ColorPicker } from '@/components/documents/color-picker'
import { htmlToPlain, RichTextEditor } from '@/components/documents/rich-text-editor'
import {
  checkboxNaturalWidth,
  CHECKBOX_LABEL_GAP,
  COLUMN_GUTTER,
  COMPACT_COLUMN_GAP,
  CONTENT_TOP,
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_STATIC_TEXT_HEIGHT,
  DEFAULT_TABLE_HEADER_HEIGHT,
  DEFAULT_TABLE_ROW_HEIGHT,
  DEFAULT_CELL_PADDING,
  TABLE_TITLE_HEIGHT,
  fieldLayoutHeight,
  isCompactRow,
  LABEL_SPACE,
  needsAboveLabel,
  PAGE_HEIGHT,
  PAGE_MARGIN,
  PAGE_WIDTH,
  ROW_GAP,
  ROW_GAP_COMPACT,
  tableBlockHeight
} from '@/lib/documents/form-layout'
import type { FormField, FormFieldType, TableConfig, TableRow, TitleStyle } from '@/lib/documents/types'
import { DEFAULT_TITLE_STYLE } from '@/lib/documents/types'

// ---- mockup design tokens --------------------------------------------------

const C = {
  bg: '#0f1115',
  panel: '#171a21',
  panel2: '#1e2230',
  stage: '#0a0c10',
  border: '#2c3140',
  input: '#10131a',
  text: '#e8eaf0',
  muted: '#9aa1b2',
  accent: '#6c9eff',
  accentText: '#0b1020',
  green: '#4cc38a',
  amber: '#e0a83a',
  red: '#e5534b',
  teal: '#2ec4b6',
  purple: '#c084fc'
}

const darkInputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: C.input,
    color: C.text,
    fontSize: 13,
    '& fieldset': { borderColor: C.border },
    '&:hover fieldset': { borderColor: C.muted },
    '&.Mui-focused fieldset': { borderColor: C.accent }
  },
  '& .MuiInputLabel-root': { color: C.muted, fontSize: 13 },
  '& .MuiInputLabel-root.Mui-focused': { color: C.accent }
} as const

function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
        color: C.muted,
        fontWeight: 700,
        mb: 1
      }}
    >
      {children}
    </Typography>
  )
}

function SectionDivider() {
  return (
    <Box sx={{ height: '1px', bgcolor: C.border, my: 1 }} />
  )
}

function MockButton({
  children,
  primary,
  danger,
  dashed,
  disabled,
  onClick,
  sx
}: {
  children: React.ReactNode
  primary?: boolean
  danger?: boolean
  dashed?: boolean
  disabled?: boolean
  onClick?: () => void
  sx?: object
}) {
  return (
    <ButtonBase
      disabled={disabled}
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        fontSize: 12.5,
        fontWeight: 600,
        px: 1.75,
        py: 0.9,
        borderRadius: '6px',
        border: '1px solid',
        borderStyle: dashed ? 'dashed' : 'solid',
        borderColor: primary
          ? C.accent
          : danger
            ? 'rgba(229,83,75,0.4)'
            : C.border,
        bgcolor: primary ? C.accent : 'transparent',
        color: primary ? C.accentText : danger ? C.red : C.text,
        opacity: disabled ? 0.45 : 1,
        '&:hover': {
          borderColor: primary ? C.accent : danger ? C.red : C.muted
        },
        ...sx
      }}
    >
      {children}
    </ButtonBase>
  )
}

// ---- canvas geometry ---------------------------------------------------------

const CANVAS_WIDTH = 500
const SCALE = CANVAS_WIDTH / PAGE_WIDTH
const px = (points: number) => points * SCALE

const DRAG_MIME = 'application/x-payme-field-type'
const DRAG_FIELD_MIME = 'application/x-payme-field-id'

const isBuilderDrag = (e: React.DragEvent) =>
  e.dataTransfer.types.includes(DRAG_MIME) ||
  e.dataTransfer.types.includes(DRAG_FIELD_MIME)

const DEFAULT_HEIGHTS: Record<FormFieldType, number> = {
  text: 24,
  checkbox: 16,
  dropdown: 24,
  radio: 60,
  'static-text': DEFAULT_STATIC_TEXT_HEIGHT,
  image: DEFAULT_IMAGE_HEIGHT,
  divider: 2,
  table: DEFAULT_TABLE_HEADER_HEIGHT + 2 * DEFAULT_TABLE_ROW_HEIGHT
}

const FILLABLE_TYPES: FormFieldType[] = ['text', 'checkbox', 'dropdown', 'radio']

const PALETTE: {
  type: FormFieldType
  label: string
  glyph: string
  color: string
  tile: string
  dragToken?: string          // custom token sent via DRAG_MIME (overrides type)
  initPatch?: Partial<FormField>  // extra props applied when field is created
}[] = [
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

// ---- data helpers ------------------------------------------------------------

type FormTemplateResponse = {
  template: {
    id: string
    name: string
    fields: FormField[]
    exportedDocumentId?: string | null
  } | null
}

type FormBuilderProps = {
  sourceDocumentId: string | null
  onExported: (documentId?: string) => void
}

function defaultTableConfig(): TableConfig {
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

function makeField(
  type: FormFieldType,
  page: number,
  row: number,
  column: number
): FormField {
  let label =
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
    options: (type === 'dropdown' || type === 'radio') ? ['Option 1', 'Option 2'] : undefined,
    content: type === 'static-text' ? 'Text here' : undefined,
    tableConfig: type === 'table' ? defaultTableConfig() : undefined,
    fontSize: type === 'static-text' ? 12 : undefined
  }
}

/** Renumber rows 1..n per page (by row order) and columns 1..k per row. */
function normalize(fields: FormField[]): FormField[] {
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
function approxStaticTextHeight(field: FormField): number {
  const size = field.fontSize ?? 12
  const lineH = size * 1.4
  const padT = field.paddingTop ?? 4
  const padB = field.paddingBottom ?? 4
  // Use stored width if known, otherwise assume full content width minus margins
  const fw = (field.width && field.width > 0 ? field.width : PAGE_WIDTH - 2 * PAGE_MARGIN) - 8
  // Strip HTML tags for a plain-text char count
  const text = (field.contentHtml || field.content || field.label || '').replace(/<[^>]+>/g, ' ')
  const words = text.split(/\s+/).filter(Boolean)
  let lines = 1
  let lineW = 0
  for (const word of words) {
    const ww = (word.length + 1) * size * 0.578
    if (lineW + ww > fw && lineW > 0) { lines++; lineW = 0 }
    lineW += ww
  }
  return padT + padB + lines * lineH
}

/**
 * Detects rows whose computed Y position would fall below the bottom margin and
 * auto-advances them to the next page. Runs sequentially so cascading overflow
 * (many rows pushed from page 1 → 2 → 3…) is handled in a single pass.
 */
function rebalanceOverflow(fields: FormField[]): {
  changed: boolean
  fields: FormField[]
  maxPage: number
} {
  const result = fields.map(f => ({ ...f }))

  // Collect all rows sorted by (origPage, rowNumber)
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
    const rowH = Math.max(...rowFields.map(f =>
      f.type === 'static-text'
        ? Math.max(fieldLayoutHeight(f), approxStaticTextHeight(f))
        : fieldLayoutHeight(f)
    ))
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
    cursorY = fieldY - (isCompactRow(rowFields) ? ROW_GAP_COMPACT : ROW_GAP) - spacingAfter
  }

  const maxPage = Math.max(1, ...result.map(f => f.page || 1))
  return { changed, fields: changed ? normalize(result) : fields, maxPage }
}

/** Legacy templates have manual x/y and no row — give each field its own row. */
function migrateToRows(fields: FormField[]): FormField[] {
  if (fields.every(f => f.row)) return normalize(fields)

  const migrated = [...fields]
    .sort((a, b) => (a.page || 1) - (b.page || 1) || b.y - a.y)
    .map((f, i) => ({ ...f, row: f.row ?? i + 1, column: f.column ?? 1 }))
  return normalize(migrated)
}

// ---- table canvas preview ---------------------------------------------------

function TablePreview({ field }: { field: FormField }) {
  const cfg = field.tableConfig
  if (!cfg) return null
  const totalWeight = cfg.columns.reduce(
    (sum, col) => sum + (col.widthWeight ?? 1),
    0
  )
  const headerH = px(DEFAULT_TABLE_HEADER_HEIGHT)
  const rowH = px(cfg.rowHeight ?? DEFAULT_TABLE_ROW_HEIGHT)
  const cellPad = px(cfg.cellPadding ?? DEFAULT_CELL_PADDING)
  const borderColor = cfg.borderColor ?? '#cccccc'

  return (
    <Box sx={{ width: '100%', overflow: 'hidden', border: `0.75px solid ${borderColor}`, boxSizing: 'border-box' }}>
      {/* Optional title bar above the column headers */}
      {field.tableLabelPosition === 'above' && field.label && (
        <Box
          sx={{
            width: '100%',
            height: px(TABLE_TITLE_HEIGHT),
            display: 'flex',
            alignItems: 'center',
            px: `${px(4)}px`,
            bgcolor: cfg.titleBg ?? cfg.headerBg ?? '#2c3a57',
            color: cfg.titleTextColor ?? cfg.headerTextColor ?? '#fff',
            fontSize: px(cfg.titleFontSize ?? 11),
            fontWeight: 700,
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}
          dangerouslySetInnerHTML={{ __html: field.labelHtml ?? field.label }}
        />
      )}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: px(8),
          tableLayout: 'fixed'
        }}
      >
        <thead>
          <tr>
            {cfg.columns.map(col => (
              <th
                key={col.key}
                style={{
                  width: `${((col.widthWeight ?? 1) / totalWeight) * 100}%`,
                  background: col.bgColor ?? cfg.headerBg ?? '#444444',
                  color: col.textColor ?? cfg.headerTextColor ?? '#ffffff',
                  padding: 0,
                  paddingLeft: cellPad,
                  height: headerH,
                  textAlign: col.align ?? 'left',
                  fontWeight: 700,
                  border: 'none',
                  borderBottom: `0.75px solid ${borderColor}`,
                  boxSizing: 'border-box',
                  verticalAlign: 'middle',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cfg.rows.map((row, rowIdx) => {
            const isAlt = rowIdx % 2 === 1
            const bg = row.bgColor ?? (isAlt && cfg.altRowBg ? cfg.altRowBg : (cfg.rowBg ?? '#ffffff'))
            const tc = row.textColor ?? '#1a1a1a'
            const isLastRow = rowIdx === cfg.rows.length - 1
            return (
              <tr key={row.id}>
                {cfg.columns.map(col => {
                  const cell = row.cells[col.key]
                  return (
                    <td
                      key={col.key}
                      style={{
                        background: bg,
                        color: tc,
                        padding: 0,
                        paddingLeft: cellPad,
                        height: rowH,
                        textAlign: col.align ?? 'left',
                        border: 'none',
                        borderBottom: isLastRow ? 'none' : `0.3px solid ${borderColor}`,
                        boxSizing: 'border-box',
                        verticalAlign: 'middle',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {(cell?.isField || cfg.allowUserInput) ? (
                        <Box
                          sx={{
                            height: px(14),
                            bgcolor: '#ffffff',
                            borderRadius: '1px',
                            mx: `${px(2)}px`
                          }}
                        />
                      ) : (
                        cell?.value || ''
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </Box>
  )
}

// ---- table editor sub-panel -------------------------------------------------

function TableEditor({
  field,
  updateField
}: {
  field: FormField
  updateField: (id: string, patch: Partial<FormField>) => void
}) {
  const cfg = field.tableConfig ?? defaultTableConfig()

  const patchCfg = (patch: Partial<TableConfig>) => {
    updateField(field.id, { tableConfig: { ...cfg, ...patch } })
  }

  const addColumn = () => {
    const key = `col${Date.now()}`
    const columns = [...cfg.columns, { key, label: 'New Column', widthWeight: 1 }]
    const rows = cfg.rows.map(row => ({
      ...row,
      cells: { ...row.cells, [key]: { value: '' } }
    }))
    patchCfg({ columns, rows })
  }

  const removeColumn = (key: string) => {
    const columns = cfg.columns.filter(c => c.key !== key)
    const rows = cfg.rows.map(row => {
      const cells = { ...row.cells }
      delete cells[key]
      return { ...row, cells }
    })
    patchCfg({ columns, rows })
  }

  const updateColumn = (key: string, patch: Partial<TableConfig['columns'][0]>) => {
    patchCfg({
      columns: cfg.columns.map(c => (c.key === key ? { ...c, ...patch } : c))
    })
  }

  const addRow = () => {
    const newRow = {
      id: crypto.randomUUID(),
      cells: Object.fromEntries(cfg.columns.map(c => [c.key, { value: '' }]))
    }
    patchCfg({ rows: [...cfg.rows, newRow] })
  }

  const removeRow = (id: string) => {
    patchCfg({ rows: cfg.rows.filter(r => r.id !== id) })
  }

  const updateCell = (
    rowId: string,
    colKey: string,
    patch: Partial<{ value: string; isField: boolean }>
  ) => {
    patchCfg({
      rows: cfg.rows.map(r =>
        r.id === rowId
          ? { ...r, cells: { ...r.cells, [colKey]: { ...r.cells[colKey], ...patch } } }
          : r
      )
    })
  }

  const updateRow = (rowId: string, patch: Partial<TableRow>) => {
    patchCfg({ rows: cfg.rows.map(r => (r.id === rowId ? { ...r, ...patch } : r)) })
  }

  return (
    <Stack sx={{ gap: 1.5 }}>
      <PanelHeading>Table columns</PanelHeading>
      {cfg.columns.map(col => (
        <Box key={col.key} sx={{ border: `1px solid ${C.border}`, borderRadius: '6px', p: 1 }}>
          <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center', mb: 0.75 }}>
            <Typography sx={{ fontSize: 11, color: C.muted, flex: 1 }}>
              Width weight:
            </Typography>
            <TextField
              size="small"
              type="number"
              value={col.widthWeight ?? 1}
              onChange={e => updateColumn(col.key, { widthWeight: Number(e.target.value) || 1 })}
              sx={{ width: 52, ...darkInputSx }}
              slotProps={{ htmlInput: { min: 0.1, step: 0.1, style: { textAlign: 'center' } } }}
            />
            <IconButton
              size="small"
              onClick={() => removeColumn(col.key)}
              sx={{ color: C.red, flexShrink: 0 }}
            >
              <DeleteOutlinedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Stack>
          <RichTextEditor
            label="Column header"
            placeholder="Column label…"
            html={col.labelHtml ?? (col.label ? `<p><strong>${col.label}</strong></p>` : '')}
            onChange={(html, plain) =>
              updateColumn(col.key, { labelHtml: html, label: plain || col.label })
            }
          />
          <Stack direction="row" sx={{ gap: 1, mt: 0.75 }}>
            <Box sx={{ flex: 1 }}>
              <ColorPicker
                label="Col bg"
                value={col.bgColor ?? cfg.headerBg ?? '#3b4a6b'}
                onChange={v => updateColumn(col.key, { bgColor: v })}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <ColorPicker
                label="Col text"
                value={col.textColor ?? cfg.headerTextColor ?? '#ffffff'}
                onChange={v => updateColumn(col.key, { textColor: v })}
              />
            </Box>
          </Stack>
        </Box>
      ))}
      <MockButton dashed onClick={addColumn} sx={{ fontSize: 12, py: 0.6 }}>
        + Add column
      </MockButton>

      <SectionDivider />
      <PanelHeading>Table rows</PanelHeading>
      {cfg.rows.map((row, rowIdx) => (
        <Box key={row.id} sx={{ border: `1px solid ${C.border}`, borderRadius: '6px', p: 1 }}>
          <Stack direction="row" sx={{ alignItems: 'center', mb: 0.75, justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 11, color: C.muted }}>Row {rowIdx + 1}</Typography>
            <IconButton
              size="small"
              onClick={() => removeRow(row.id)}
              sx={{ color: C.red }}
            >
              <DeleteOutlinedIcon sx={{ fontSize: 12 }} />
            </IconButton>
          </Stack>
          {cfg.columns.map(col => {
            const cell = row.cells[col.key] ?? { value: '' }
            return (
              <Stack key={col.key} direction="row" sx={{ gap: 0.5, mb: 0.5, alignItems: 'center' }}>
                <Typography sx={{ fontSize: 10, color: C.muted, width: 55, flexShrink: 0 }} noWrap>
                  {col.label}
                </Typography>
                <TextField
                  size="small"
                  value={cell.value}
                  onChange={e => updateCell(row.id, col.key, { value: e.target.value })}
                  sx={{ flex: 1, ...darkInputSx }}
                  slotProps={{ htmlInput: { style: { fontSize: 11, padding: '3px 6px' } } }}
                />
                <Tooltip title={cell.isField ? 'Fillable (click to toggle)' : 'Static (click to toggle)'}>
                  <ButtonBase
                    onClick={() => updateCell(row.id, col.key, { isField: !cell.isField })}
                    sx={{
                      fontSize: 10,
                      px: 0.75,
                      py: 0.4,
                      borderRadius: '4px',
                      border: `1px solid ${C.border}`,
                      bgcolor: cell.isField ? 'rgba(108,158,255,0.2)' : 'transparent',
                      color: cell.isField ? C.accent : C.muted,
                      flexShrink: 0
                    }}
                  >
                    {cell.isField ? 'Field' : 'Text'}
                  </ButtonBase>
                </Tooltip>
              </Stack>
            )
          })}
          {/* Per-row styling */}
          <Stack direction="row" sx={{ gap: 1, mt: 0.75 }}>
            <Box sx={{ flex: 1 }}>
              <ColorPicker
                label="Row bg"
                value={row.bgColor ?? '#ffffff'}
                onChange={v => updateRow(row.id, { bgColor: v })}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <ColorPicker
                label="Row text"
                value={row.textColor ?? '#1a1a1a'}
                onChange={v => updateRow(row.id, { textColor: v })}
              />
            </Box>
          </Stack>
        </Box>
      ))}
      <MockButton dashed onClick={addRow} sx={{ fontSize: 12, py: 0.6 }}>
        + Add row
      </MockButton>

      <SectionDivider />
      <PanelHeading>Table appearance</PanelHeading>

      {/* Global row-input toggle */}
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 12, color: C.text }}>Allow row input</Typography>
        <Switch
          size="small"
          checked={cfg.allowUserInput ?? false}
          onChange={e => patchCfg({ allowUserInput: e.target.checked })}
          sx={{
            '& .MuiSwitch-thumb': { bgcolor: cfg.allowUserInput ? C.accent : C.muted },
            '& .MuiSwitch-track': { bgcolor: cfg.allowUserInput ? `${C.accent}55` : `${C.border}` }
          }}
        />
      </Stack>
      <Typography sx={{ fontSize: 10, color: C.muted, mt: -1 }}>
        {cfg.allowUserInput
          ? 'All data cells are fillable in the exported PDF.'
          : 'Only cells individually marked as "Field" are fillable.'}
      </Typography>
      <ColorPicker
        label="Header background"
        value={cfg.headerBg}
        onChange={v => patchCfg({ headerBg: v })}
      />
      <ColorPicker
        label="Header text color"
        value={cfg.headerTextColor}
        onChange={v => patchCfg({ headerTextColor: v })}
      />
      <ColorPicker
        label="Row background"
        value={cfg.rowBg}
        onChange={v => patchCfg({ rowBg: v })}
      />
      <ColorPicker
        label="Alt row background"
        value={cfg.altRowBg}
        onChange={v => patchCfg({ altRowBg: v })}
      />
      <ColorPicker
        label="Border color"
        value={cfg.borderColor}
        onChange={v => patchCfg({ borderColor: v })}
      />
      <Stack direction="row" sx={{ gap: 1 }}>
        <TextField
          label="Row height (pt)"
          size="small"
          type="number"
          value={cfg.rowHeight ?? 20}
          onChange={e => patchCfg({ rowHeight: Number(e.target.value) || 20 })}
          sx={{ flex: 1, ...darkInputSx }}
        />
        <TextField
          label="Cell padding"
          size="small"
          type="number"
          value={cfg.cellPadding ?? 4}
          onChange={e => patchCfg({ cellPadding: Number(e.target.value) || 4 })}
          sx={{ flex: 1, ...darkInputSx }}
        />
      </Stack>
    </Stack>
  )
}

// ---- component ---------------------------------------------------------------

export function FormBuilder({ sourceDocumentId, onExported }: FormBuilderProps) {
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [formName, setFormName] = useState('My Form')
  const [titleStyle, setTitleStyle] = useState<TitleStyle>(DEFAULT_TITLE_STYLE)
  const [fields, setFields] = useState<FormField[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [dropRow, setDropRow] = useState<number | null>(null)
  const [dropGap, setDropGap] = useState<number | null>(null)
  const [dropNewRow, setDropNewRow] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showTableEditor, setShowTableEditor] = useState(false)
  const [deleteConfirmPage, setDeleteConfirmPage] = useState<number | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  // Free-drag state for absolutely-positioned image fields
  const freeDragRef = useRef<{
    fieldId: string
    startMouseX: number
    startMouseY: number
    startFieldX: number
    startFieldY: number
  } | null>(null)

  const loadTemplate = useCallback(async () => {
    if (!sourceDocumentId) {
      setTemplateId(null)
      setFields([])
      setSelectedId(null)
      return
    }

    setLoadingTemplate(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/documents/forms/by-document/${sourceDocumentId}`
      )
      const data = (await res.json()) as FormTemplateResponse
      if (!res.ok) throw new Error('Could not load form template')

      if (data.template) {
        const migrated = migrateToRows(data.template.fields ?? [])
        setTemplateId(data.template.id)
        setFormName(data.template.name)
        const tpl = data.template as any
        if (tpl.titleStyle) setTitleStyle(tpl.titleStyle as TitleStyle)
        else if (tpl.config?.titleStyle) setTitleStyle(tpl.config.titleStyle as TitleStyle)
        setFields(migrated)
        setPageCount(Math.max(1, ...migrated.map(f => f.page || 1)))
      } else {
        setTemplateId(null)
        setFields([])
      }
      setSelectedId(null)
      setPage(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Template load failed')
    } finally {
      setLoadingTemplate(false)
    }
  }, [sourceDocumentId])

  useEffect(() => {
    loadTemplate()
  }, [loadTemplate])

  const rows = useMemo(() => {
    const onPage = fields.filter(f => (f.page || 1) === page && f.row)
    const byRow = new Map<number, FormField[]>()
    for (const field of onPage) {
      const list = byRow.get(field.row!) ?? []
      list.push(field)
      byRow.set(field.row!, list)
    }
    return [...byRow.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rowNumber, rowFields]) => ({
        rowNumber,
        fields: rowFields.sort((a, b) => (a.column ?? 0) - (b.column ?? 0))
      }))
  }, [fields, page])

  const selected = fields.find(f => f.id === selectedId) ?? null

  const selectedRowDivisor = useMemo(() => {
    if (!selected) return 1
    const total = fields
      .filter(
        f =>
          (f.page || 1) === (selected.page || 1) &&
          f.row === selected.row &&
          f.type !== 'checkbox'
      )
      .reduce((sum, f) => sum + (f.span && f.span > 0 ? f.span : 1), 0)
    return Math.max(total, 1)
  }, [fields, selected])

  // ---- auto-rebalance overflow rows ----------------------------------------

  useEffect(() => {
    // First sync static-text heights so the canvas shows the full container
    // and the overflow calc uses accurate heights
    let heightsChanged = false
    const heightSynced = fields.map(f => {
      if (f.type !== 'static-text') return f
      const needed = approxStaticTextHeight(f)
      if (needed > (f.height || 0)) {
        heightsChanged = true
        return { ...f, height: needed }
      }
      return f
    })

    const base = heightsChanged ? heightSynced : fields
    const { changed, fields: rebalanced, maxPage } = rebalanceOverflow(base)

    if (heightsChanged || changed) {
      setFields(rebalanced)
      setPageCount(c => Math.max(c, maxPage))
    }
  }, [fields])

  // ---- mutations ----------------------------------------------------------

  const addToNewRow = (type: FormFieldType, patch?: Partial<FormField>) => {
    setFields(current => {
      const pageRows = current
        .filter(f => (f.page || 1) === page && f.row)
        .map(f => f.row!)
      const maxRow = pageRows.length ? Math.max(...pageRows) : 0
      const field = { ...makeField(type, page, maxRow + 1, 1), ...(patch ?? {}) }
      setSelectedId(field.id)
      return normalize([...current, field])
    })
  }

  const addToRow = (type: FormFieldType, rowNumber: number) => {
    setFields(current => {
      const cols = current.filter(
        f => (f.page || 1) === page && f.row === rowNumber
      ).length
      const field = makeField(type, page, rowNumber, cols + 1)
      setSelectedId(field.id)
      return normalize([...current, field])
    })
  }

  const moveFieldToRow = (id: string, rowNumber: number) => {
    setFields(current => {
      const cols = current.filter(
        f => (f.page || 1) === page && f.row === rowNumber && f.id !== id
      ).length
      return normalize(
        current.map(f =>
          f.id === id ? { ...f, page, row: rowNumber, column: cols + 1 } : f
        )
      )
    })
    setSelectedId(id)
  }

  const moveFieldToNewRowAt = (id: string, beforeRow: number) => {
    setFields(current => {
      const shifted = current.map(f =>
        (f.page || 1) === page && f.row && f.row >= beforeRow && f.id !== id
          ? { ...f, row: f.row + 1 }
          : f
      )
      return normalize(
        shifted.map(f =>
          f.id === id ? { ...f, page, row: beforeRow, column: 1 } : f
        )
      )
    })
    setSelectedId(id)
  }

  const insertNewRowAt = (type: FormFieldType, beforeRow: number) => {
    setFields(current => {
      const shifted = current.map(f =>
        (f.page || 1) === page && f.row && f.row >= beforeRow
          ? { ...f, row: f.row + 1 }
          : f
      )
      const field = makeField(type, page, beforeRow, 1)
      setSelectedId(field.id)
      return normalize([...shifted, field])
    })
  }

  const moveRow = (rowNumber: number, delta: -1 | 1) => {
    const target = rowNumber + delta
    setFields(current =>
      normalize(
        current.map(f => {
          if ((f.page || 1) !== page || !f.row) return f
          if (f.row === rowNumber) return { ...f, row: target }
          if (f.row === target) return { ...f, row: rowNumber }
          return f
        })
      )
    )
  }

  const removeField = (id: string) => {
    setFields(current => normalize(current.filter(f => f.id !== id)))
    setSelectedId(current => (current === id ? null : current))
  }

  const deletePage = (pageNum: number) => {
    setFields(current => {
      const filtered = current.filter(f => (f.page || 1) !== pageNum)
      const shifted = filtered.map(f => {
        const p = f.page || 1
        return p > pageNum ? { ...f, page: p - 1 } : f
      })
      return normalize(shifted)
    })
    setPageCount(c => Math.max(1, c - 1))
    setPage(p => (p >= pageNum ? Math.max(1, p - 1) : p))
    setSelectedId(null)
    setDeleteConfirmPage(null)
  }

  const updateField = (id: string, patch: Partial<FormField>) => {
    setFields(current =>
      current.map(f => (f.id === id ? { ...f, ...patch } : f))
    )
  }

  // ---- drag & drop --------------------------------------------------------

  type DragPayload =
    | { kind: 'new'; type: FormFieldType; patch?: Partial<FormField> }
    | { kind: 'move'; id: string }

  const readDrag = (e: React.DragEvent): DragPayload | null => {
    const moveId = e.dataTransfer.getData(DRAG_FIELD_MIME)
    if (moveId) return { kind: 'move', id: moveId }
    const raw = e.dataTransfer.getData(DRAG_MIME)
    if (raw === 'radio-single') {
      return { kind: 'new', type: 'radio', patch: { options: [''], optionStyles: [{}], height: DEFAULT_HEIGHTS['checkbox'] } }
    }
    const t = raw as FormFieldType
    if (
      t === 'text' ||
      t === 'checkbox' ||
      t === 'dropdown' ||
      t === 'radio' ||
      t === 'static-text' ||
      t === 'image' ||
      t === 'divider' ||
      t === 'table'
    ) {
      return { kind: 'new', type: t }
    }
    return null
  }

  const onDropInRow = (e: React.DragEvent, rowNumber: number) => {
    e.preventDefault()
    setDropRow(null)
    const payload = readDrag(e)
    if (!payload) return
    if (payload.kind === 'new') {
      setFields(current => {
        const cols = current.filter(f => (f.page || 1) === page && f.row === rowNumber).length
        const field = { ...makeField(payload.type, page, rowNumber, cols + 1), ...(payload.patch ?? {}) }
        setSelectedId(field.id)
        return normalize([...current, field])
      })
    } else moveFieldToRow(payload.id, rowNumber)
  }

  const onDropInGap = (e: React.DragEvent, beforeRow: number) => {
    e.preventDefault()
    setDropGap(null)
    const payload = readDrag(e)
    if (!payload) return
    if (payload.kind === 'new') {
      setFields(current => {
        const shifted = current.map(f =>
          (f.page || 1) === page && f.row && f.row >= beforeRow ? { ...f, row: f.row + 1 } : f
        )
        const field = { ...makeField(payload.type, page, beforeRow, 1), ...(payload.patch ?? {}) }
        setSelectedId(field.id)
        return normalize([...shifted, field])
      })
    } else moveFieldToNewRowAt(payload.id, beforeRow)
  }

  const onDropNewRow = (e: React.DragEvent) => {
    e.preventDefault()
    setDropNewRow(false)
    const payload = readDrag(e)
    if (!payload) return
    if (payload.kind === 'new') {
      setFields(current => {
        const pageRows = current.filter(f => (f.page || 1) === page && f.row).map(f => f.row!)
        const maxRow = pageRows.length ? Math.max(...pageRows) : 0
        const field = { ...makeField(payload.type, page, maxRow + 1, 1), ...(payload.patch ?? {}) }
        setSelectedId(field.id)
        return normalize([...current, field])
      })
    } else moveFieldToNewRowAt(payload.id, rows.length + 1)
  }

  // ---- free-position drag (image fields without a row) --------------------

  // PAGE_WIDTH/HEIGHT in PDF pts; SCALE converts to canvas px
  const startFreeDrag = (
    e: React.MouseEvent,
    field: FormField
  ) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedId(field.id)
    freeDragRef.current = {
      fieldId: field.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startFieldX: field.x,
      startFieldY: field.y
    }

    const onMove = (ev: MouseEvent) => {
      const drag = freeDragRef.current
      if (!drag) return
      const dxPt = (ev.clientX - drag.startMouseX) / SCALE
      const dyPt = -(ev.clientY - drag.startMouseY) / SCALE // canvas y is inverted
      const newX = Math.max(0, drag.startFieldX + dxPt)
      const newY = Math.max(0, drag.startFieldY + dyPt)
      setFields(current =>
        current.map(f => f.id === drag.fieldId ? { ...f, x: newX, y: newY } : f)
      )
    }

    const onUp = () => {
      freeDragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ---- save ---------------------------------------------------------------

  const save = async () => {
    if (fields.length === 0) {
      setError('Add at least one field before exporting')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const endpoint = templateId
        ? `/api/documents/forms/${templateId}`
        : '/api/documents/forms/export'
      const method = templateId ? 'PUT' : 'POST'
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          titleStyle,
          fields,
          sourceDocumentId: sourceDocumentId ?? undefined
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')

      setSuccess(templateId ? 'Saved and re-exported PDF' : 'Exported new form')
      if (!templateId && data.template?.id) setTemplateId(data.template.id)
      onExported(data.document?.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ---- row's first-column field (holds row-level props) -------------------
  const getRowFirst = (rowNumber: number) =>
    fields.find(
      f => (f.page || 1) === page && f.row === rowNumber && (f.column ?? 1) === 1
    )

  // ---- render -------------------------------------------------------------

  return (
    <Box
      sx={{
        border: `1px solid ${C.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
        bgcolor: C.panel,
        color: C.text,
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)'
      }}
    >
      {/* Toolbar */}
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          px: 2,
          py: 1.5,
          bgcolor: C.panel2,
          borderBottom: `1px solid ${C.border}`
        }}
      >
        <TextField
          label="Form name"
          size="small"
          value={formName}
          onChange={e => setFormName(e.target.value)}
          sx={{ width: 220, ...darkInputSx }}
        />

        <Box sx={{ width: '1px', height: 22, bgcolor: C.border, mx: 0.75 }} />

        {Array.from({ length: pageCount }, (_, i) => (
          <Box key={i + 1} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
            <MockButton
              primary={page === i + 1}
              onClick={() => {
                setPage(i + 1)
                setSelectedId(null)
              }}
              sx={{ borderTopRightRadius: i > 0 ? 0 : undefined, borderBottomRightRadius: i > 0 ? 0 : undefined }}
            >
              Page {i + 1}
            </MockButton>
            {i > 0 && (
              <Tooltip title="Delete page">
                <IconButton
                  size="small"
                  onClick={() => setDeleteConfirmPage(i + 1)}
                  sx={{
                    height: '100%',
                    borderRadius: '0 6px 6px 0',
                    border: `1px solid ${page === i + 1 ? C.accent : C.border}`,
                    borderLeft: 'none',
                    px: 0.5,
                    color: C.muted,
                    '&:hover': { color: C.red }
                  }}
                >
                  <DeleteOutlinedIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ))}
        <MockButton
          dashed
          onClick={() => {
            setPageCount(c => c + 1)
            setPage(pageCount + 1)
          }}
        >
          + Page
        </MockButton>

        <Box sx={{ flex: 1 }} />

        <MockButton primary disabled={saving || loadingTemplate} onClick={save}>
          {saving
            ? 'Saving…'
            : templateId
              ? 'Save & re-export'
              : 'Export PDF form'}
        </MockButton>
      </Stack>

      {(error || success) && (
        <Box sx={{ px: 2, pt: 1.5 }}>
          {error && (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" variant="outlined">
              {success}
            </Alert>
          )}
        </Box>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }}>
        {/* Palette */}
        <Box
          sx={{
            width: { md: 200 },
            flexShrink: 0,
            p: 2,
            bgcolor: C.panel2,
            borderRight: { md: `1px solid ${C.border}` },
            borderBottom: { xs: `1px solid ${C.border}`, md: 'none' }
          }}
        >
          <PanelHeading>Fillable fields</PanelHeading>
          <Stack sx={{ gap: 0.75, mb: 2 }}>
            {PALETTE.filter(p => FILLABLE_TYPES.includes(p.type)).map(item => (
              <PaletteItem key={item.label} item={item} onAdd={addToNewRow} />
            ))}
          </Stack>
          <PanelHeading>Layout &amp; Style</PanelHeading>
          <Stack sx={{ gap: 0.75 }}>
            {PALETTE.filter(p => !FILLABLE_TYPES.includes(p.type)).map(item => (
              <PaletteItem key={item.label} item={item} onAdd={addToNewRow} />
            ))}
          </Stack>
          <Typography sx={{ fontSize: 11, color: C.muted, mt: 1.5, lineHeight: 1.5 }}>
            Drag onto the page or click to add. Drop onto an existing row to add
            a column. Drag placed fields to rearrange them.
          </Typography>
        </Box>

        {/* Stage */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            p: 3.25,
            bgcolor: C.stage,
            overflow: 'auto'
          }}
        >
          <Box
            ref={canvasRef}
            onClick={() => setSelectedId(null)}
            sx={{
              width: CANVAS_WIDTH,
              minHeight: px(PAGE_HEIGHT),
              flexShrink: 0,
              bgcolor: '#ffffff',
              color: '#1a1a1a',
              borderRadius: '4px',
              boxShadow: '0 10px 34px rgba(0,0,0,0.6)',
              position: 'relative',
              px: `${px(PAGE_MARGIN)}px`,
              pt: `${px(PAGE_HEIGHT - CONTENT_TOP + titleStyle.spacingBelow)}px`,
              pb: 3
            }}
          >
            <Box sx={{ position: 'absolute', top: px(24), left: px(PAGE_MARGIN) }}>
              <Typography sx={{
                fontSize: px(titleStyle.fontSize),
                fontWeight: titleStyle.fontWeight === 'bold' ? 700 : 400,
                color: titleStyle.color
              }}>
                {formName || 'Untitled form'}
              </Typography>
            </Box>
            {pageCount > 1 && (
              <Box sx={{ position: 'absolute', bottom: px(16), right: px(PAGE_MARGIN) }}>
                <Typography sx={{ fontSize: px(9), color: '#aaa' }}>
                  Page {page} of {pageCount}
                </Typography>
              </Box>
            )}

            {/* Page bottom boundary — dashed line at the printable bottom margin */}
            <Box
              sx={{
                position: 'absolute',
                top: `${px(PAGE_HEIGHT - PAGE_MARGIN)}px`,
                left: 0,
                right: 0,
                borderTop: '1px dashed rgba(220, 80, 80, 0.45)',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            />

            {rows.map((row, rowIdx) => {
              const rowHeight = Math.max(...row.fields.map(f => f.height || 24))
              const rowLabelSpace = row.fields.some(needsAboveLabel)
                ? LABEL_SPACE
                : 0
              const fixedTotalPt = row.fields.reduce(
                (sum, f) =>
                  sum + (f.type === 'checkbox' ? checkboxNaturalWidth(f) : 0),
                0
              )
              const weightTotal = row.fields.reduce(
                (sum, f) =>
                  sum +
                  (f.type === 'checkbox'
                    ? 0
                    : f.span && f.span > 0
                      ? f.span
                      : 1),
                0
              )
              const rowIsCompact = isCompactRow(row.fields)
              const weightDivisor = Math.max(weightTotal, 1)
              const availablePt = Math.max(
                0,
                PAGE_WIDTH -
                  2 * PAGE_MARGIN -
                  (row.fields.length - 1) * (rowIsCompact ? COMPACT_COLUMN_GAP : COLUMN_GUTTER) -
                  fixedTotalPt
              )
              const prevRow = rowIdx > 0 ? rows[rowIdx - 1] : null
              const gapHeight = px(
                prevRow && isCompactRow(prevRow.fields)
                  ? ROW_GAP_COMPACT
                  : ROW_GAP
              )
              const rowFirst = getRowFirst(row.rowNumber)
              const spacingBefore = rowFirst?.spacingBefore ?? 0
              const rowBg = rowFirst?.rowBackgroundColor

              return (
                <Fragment key={row.rowNumber}>
                  {/* Gap drop zone */}
                  <Box
                    onDragOver={(e: React.DragEvent) => {
                      if (isBuilderDrag(e)) {
                        e.preventDefault()
                        setDropGap(row.rowNumber)
                      }
                    }}
                    onDragLeave={() => setDropGap(null)}
                    onDrop={e => onDropInGap(e, row.rowNumber)}
                    sx={{
                      height: gapHeight + px(spacingBefore),
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        borderTop:
                          dropGap === row.rowNumber
                            ? `2px dashed ${C.accent}`
                            : '2px dashed transparent'
                      }}
                    />
                  </Box>

                  <Box
                    onDragOver={(e: React.DragEvent) => {
                      if (isBuilderDrag(e)) {
                        e.preventDefault()
                        setDropRow(row.rowNumber)
                      }
                    }}
                    onDragLeave={() => setDropRow(null)}
                    onDrop={e => onDropInRow(e, row.rowNumber)}
                    sx={{
                      position: 'relative',
                      display: 'flex',
                      gap: `${px(isCompactRow(row.fields) ? COMPACT_COLUMN_GAP : COLUMN_GUTTER)}px`,
                      borderRadius: '2px',
                      bgcolor: rowBg ?? 'transparent',
                      outline:
                        dropRow === row.rowNumber
                          ? `2px dashed ${C.accent}`
                          : 'none',
                      outlineOffset: 3,
                      '&:hover .row-tools': { opacity: 1 }
                    }}
                  >
                    {row.fields.map(field => {
                      const fieldWidth =
                        field.type === 'checkbox'
                          ? undefined
                          : px(
                              (availablePt *
                                (field.span && field.span > 0
                                  ? field.span
                                  : 1)) /
                                weightDivisor
                            )

                      return (
                        <Box
                          key={field.id}
                          draggable
                          onDragStart={(e: React.DragEvent) => {
                            e.dataTransfer.setData(DRAG_FIELD_MIME, field.id)
                            e.dataTransfer.effectAllowed = 'move'
                            setSelectedId(field.id)
                          }}
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedId(field.id)
                            if (field.type === 'table') setShowTableEditor(false)
                          }}
                          sx={{
                            flex: '0 0 auto',
                            width:
                              field.type === 'checkbox' ? 'max-content' : fieldWidth,
                            minWidth:
                              field.type === 'checkbox'
                                ? px(checkboxNaturalWidth(field))
                                : 0,
                            cursor: 'grab',
                            '&:active': { cursor: 'grabbing' },
                            outline:
                              selectedId === field.id
                                ? `2px solid ${C.accent}`
                                : 'none',
                            outlineOffset: 3
                          }}
                        >
                          <FieldCanvas
                            field={field}
                            rowLabelSpace={rowLabelSpace}
                            rowHeight={rowHeight}
                          />
                        </Box>
                      )
                    })}

                    {/* Row tools */}
                    <Stack
                      className="row-tools"
                      direction="row"
                      sx={{
                        position: 'absolute',
                        right: 0,
                        top: -34,
                        opacity: 0,
                        transition: 'opacity 120ms',
                        bgcolor: C.panel,
                        border: `1px solid ${C.border}`,
                        borderRadius: '6px',
                        px: 0.5,
                        py: 0.25,
                        zIndex: 2,
                        '& .MuiIconButton-root': { color: C.muted },
                        '& .MuiIconButton-root:hover': { color: C.text },
                        '& .MuiIconButton-root.Mui-disabled': {
                          color: C.border
                        }
                      }}
                    >
                      <Tooltip title="Add column (text field)">
                        <IconButton
                          size="small"
                          onClick={() => addToRow('text', row.rowNumber)}
                        >
                          <AddIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Move row up">
                        <span>
                          <IconButton
                            size="small"
                            disabled={row.rowNumber <= 1}
                            onClick={() => moveRow(row.rowNumber, -1)}
                          >
                            <ArrowUpwardIcon fontSize="inherit" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Move row down">
                        <span>
                          <IconButton
                            size="small"
                            disabled={row.rowNumber >= rows.length}
                            onClick={() => moveRow(row.rowNumber, 1)}
                          >
                            <ArrowDownwardIcon fontSize="inherit" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Box>
                  {(rowFirst?.spacingAfter ?? 0) > 0 && (
                    <Box sx={{ height: px(rowFirst?.spacingAfter ?? 0) }} />
                  )}
                </Fragment>
              )
            })}

            {/* New-row drop zone */}
            <Box
              onDragOver={(e: React.DragEvent) => {
                if (isBuilderDrag(e)) {
                  e.preventDefault()
                  setDropNewRow(true)
                }
              }}
              onDragLeave={() => setDropNewRow(false)}
              onDrop={onDropNewRow}
              sx={{
                border: dropNewRow ? `2px dashed ${C.accent}` : '1px dashed #bbb',
                color: dropNewRow ? C.accent : '#888',
                borderRadius: '4px',
                textAlign: 'center',
                mt: `${px(ROW_GAP)}px`,
                py: `${px(10)}px`,
                fontSize: px(10),
                fontWeight: 600
              }}
            >
              {rows.length === 0
                ? 'Drag a field here (or click one in the palette) to start'
                : '+ Add row'}
            </Box>
            {/* Free-positioned field overlays (any field without a row) */}
            {fields
              .filter(f => (f.page || 1) === page && !f.row)
              .map(field => {
                const fieldH = field.height || DEFAULT_HEIGHTS[field.type]
                const fieldW = field.width || (
                  field.type === 'checkbox'
                    ? checkboxNaturalWidth(field)
                    : PAGE_WIDTH - 2 * PAGE_MARGIN
                )
                return (
                  <Box
                    key={field.id}
                    onMouseDown={e => startFreeDrag(e, field)}
                    onClick={e => { e.stopPropagation(); setSelectedId(field.id) }}
                    sx={{
                      position: 'absolute',
                      left: px(field.x),
                      top: px(PAGE_HEIGHT - field.y - fieldH),
                      width: field.type === 'checkbox' ? 'max-content' : px(fieldW),
                      minWidth: px(fieldW),
                      cursor: 'move',
                      outline: selectedId === field.id ? `2px solid ${C.accent}` : '1px dashed rgba(0,0,0,0.2)',
                      outlineOffset: 2,
                      userSelect: 'none',
                      '& *': { pointerEvents: 'none' }
                    }}
                  >
                    <FieldCanvas
                      field={field}
                      rowLabelSpace={needsAboveLabel(field) ? LABEL_SPACE : 0}
                      rowHeight={fieldH}
                    />
                  </Box>
                )
              })
            }
          </Box>
        </Box>

        {/* Inspector */}
        <Box
          sx={{
            width: { md: 290 },
            flexShrink: 0,
            p: 2,
            bgcolor: C.panel2,
            borderLeft: { md: `1px solid ${C.border}` },
            borderTop: { xs: `1px solid ${C.border}`, md: 'none' },
            overflowY: 'auto',
            maxHeight: { md: `${px(PAGE_HEIGHT) + 100}px` }
          }}
        >
          {/* Selected field type badge + label — always visible at top of inspector */}
          {selected ? (() => {
            const palItem = PALETTE.find(p => p.type === selected.type)
            return (
              <Box sx={{ mb: 2, pb: 1.5, borderBottom: `1px solid ${C.border}` }}>
                <Box sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.5,
                  px: 1, py: 0.3, borderRadius: '4px',
                  bgcolor: palItem?.tile ?? 'rgba(255,255,255,0.08)',
                  color: palItem?.color ?? C.text,
                  fontSize: 10, fontWeight: 800, letterSpacing: '1.2px',
                  textTransform: 'uppercase', mb: 0.75
                }}>
                  {palItem?.glyph} {palItem?.label ?? selected.type}
                </Box>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>
                  {selected.label || '(unnamed field)'}
                </Typography>
              </Box>
            )
          })() : (
            <PanelHeading>Title Style</PanelHeading>
          )}

          {!selected ? (
            <Stack sx={{ gap: 1.75 }}>
              <Stack direction="row" sx={{ gap: 1 }}>
                <TextField
                  label="Font size (pt)"
                  size="small"
                  type="number"
                  value={titleStyle.fontSize}
                  onChange={e => setTitleStyle(s => ({ ...s, fontSize: Number(e.target.value) || 16 }))}
                  sx={{ flex: 1, ...darkInputSx }}
                  slotProps={{ htmlInput: { min: 8, max: 48, step: 1 } }}
                />
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {(['bold', 'normal'] as const).map(w => (
                    <ButtonBase
                      key={w}
                      onClick={() => setTitleStyle(s => ({ ...s, fontWeight: w }))}
                      sx={{
                        width: 36, height: 36, borderRadius: '6px',
                        border: `1px solid ${C.border}`,
                        bgcolor: titleStyle.fontWeight === w ? C.accent : 'transparent',
                        color: titleStyle.fontWeight === w ? C.accentText : C.muted,
                        fontWeight: w === 'bold' ? 700 : 400, fontSize: 13
                      }}
                    >
                      {w === 'bold' ? 'B' : 'N'}
                    </ButtonBase>
                  ))}
                </Box>
              </Stack>
              <ColorPicker
                label="Title color"
                value={titleStyle.color}
                onChange={v => setTitleStyle(s => ({ ...s, color: v }))}
              />
              <TextField
                label="Spacing below title (pt)"
                size="small"
                type="number"
                value={titleStyle.spacingBelow}
                onChange={e => setTitleStyle(s => ({ ...s, spacingBelow: Number(e.target.value) || 0 }))}
                sx={{ ...darkInputSx }}
                slotProps={{ htmlInput: { min: -200, max: 200, step: 4 } }}
              />
            </Stack>
          ) : selected.type === 'table' && showTableEditor ? (
            <>
              <MockButton onClick={() => setShowTableEditor(false)} sx={{ mb: 1.5, fontSize: 12, py: 0.6 }}>
                ← Back to field
              </MockButton>
              <TableEditor field={selected} updateField={updateField} />
            </>
          ) : (
            <Stack sx={{ gap: 1.75 }}>
              {/* Label / Content — rich text for all field types */}
              {selected.type === 'static-text' ? (
                <RichTextEditor
                  label="Content"
                  multiline
                  placeholder="Enter static text…"
                  html={selected.contentHtml ?? (selected.content ? `<p>${selected.content}</p>` : '')}
                  onChange={(html, plain) =>
                    updateField(selected.id, { contentHtml: html, content: plain })
                  }
                />
              ) : selected.type !== 'table' ? (
                <RichTextEditor
                  label="Label"
                  placeholder="Field label…"
                  html={selected.labelHtml ?? (selected.label ? `<p><strong>${selected.label}</strong></p>` : '')}
                  onChange={(html, plain) =>
                    updateField(selected.id, { labelHtml: html, label: plain || selected.label })
                  }
                />
              ) : (
                <RichTextEditor
                  label="Table title / label"
                  placeholder="Table label…"
                  html={selected.labelHtml ?? (selected.label ? `<p><strong>${selected.label}</strong></p>` : '')}
                  onChange={(html, plain) =>
                    updateField(selected.id, { labelHtml: html, label: plain || selected.label })
                  }
                />
              )}

              {/* Type indicator for non-fillable */}
              {!FILLABLE_TYPES.includes(selected.type) ? (
                <Typography sx={{ fontSize: 11.5, color: C.muted }}>
                  Type: <strong style={{ color: C.text }}>{selected.type}</strong>
                </Typography>
              ) : (
                /* Type segmented control for fillable */
                <Box>
                  <Typography sx={{ fontSize: 11, color: C.muted, mb: 0.5 }}>
                    Type
                  </Typography>
                  <Stack
                    direction="row"
                    sx={{
                      border: `1px solid ${C.border}`,
                      borderRadius: '6px',
                      overflow: 'hidden'
                    }}
                  >
                    {(['text', 'checkbox', 'dropdown', 'radio'] as const).map(type => (
                      <ButtonBase
                        key={type}
                        onClick={() =>
                          updateField(selected.id, {
                            type,
                            height: DEFAULT_HEIGHTS[type],
                            options:
                              (type === 'dropdown' || type === 'radio')
                                ? (selected.options ?? ['Option 1', 'Option 2'])
                                : undefined
                          })
                        }
                        sx={{
                          flex: 1,
                          fontSize: 11.5,
                          py: 0.9,
                          fontWeight: selected.type === type ? 700 : 400,
                          bgcolor:
                            selected.type === type ? C.accent : 'transparent',
                          color:
                            selected.type === type ? C.accentText : C.muted
                        }}
                      >
                        {type === 'text'
                          ? 'Text'
                          : type === 'checkbox'
                            ? 'Check'
                            : type === 'dropdown'
                              ? 'Drop'
                              : 'Radio'}
                      </ButtonBase>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Free-position toggle — all fillable fields */}
              {FILLABLE_TYPES.includes(selected.type) && (
                <Box>
                  <Typography sx={{ fontSize: 11, color: C.muted, mb: 0.5 }}>
                    Positioning
                  </Typography>
                  <Stack
                    direction="row"
                    sx={{ border: `1px solid ${C.border}`, borderRadius: '6px', overflow: 'hidden' }}
                  >
                    {(['grid', 'free'] as const).map(mode => {
                      const active = mode === 'free' ? !selected.row : !!selected.row
                      return (
                        <ButtonBase
                          key={mode}
                          onClick={() => {
                            if (mode === 'free') {
                              setFields(current => {
                                const rest = normalize(current.filter(f => f.id !== selected.id))
                                const fieldH = selected.height || DEFAULT_HEIGHTS[selected.type]
                                const fieldW =
                                  selected.type === 'checkbox'
                                    ? checkboxNaturalWidth(selected)
                                    : PAGE_WIDTH - 2 * PAGE_MARGIN
                                return [
                                  ...rest,
                                  {
                                    ...selected,
                                    row: undefined,
                                    column: undefined,
                                    x: selected.x || PAGE_MARGIN,
                                    y: selected.y || 400,
                                    width: fieldW,
                                    height: fieldH,
                                    page
                                  }
                                ]
                              })
                            } else {
                              setFields(current => {
                                const pageRows = current
                                  .filter(f => (f.page || 1) === page && f.row)
                                  .map(f => f.row!)
                                const maxRow = pageRows.length ? Math.max(...pageRows) : 0
                                return normalize(
                                  current.map(f =>
                                    f.id === selected.id
                                      ? { ...f, row: maxRow + 1, column: 1, page }
                                      : f
                                  )
                                )
                              })
                            }
                          }}
                          sx={{
                            flex: 1, fontSize: 11.5, py: 0.9,
                            fontWeight: active ? 700 : 400,
                            bgcolor: active ? C.accent : 'transparent',
                            color: active ? C.accentText : C.muted
                          }}
                        >
                          {mode === 'grid' ? 'Grid' : 'Free drag'}
                        </ButtonBase>
                      )
                    })}
                  </Stack>
                  {!selected.row && (
                    <Typography sx={{ fontSize: 11, color: C.muted, mt: 0.5, lineHeight: 1.4 }}>
                      Drag the field on the canvas to position it freely.
                    </Typography>
                  )}
                </Box>
              )}

              {/* Checkbox label position */}
              {selected.type === 'checkbox' && (
                <Box>
                  <Typography sx={{ fontSize: 11, color: C.muted, mb: 0.5 }}>
                    Label position
                  </Typography>
                  <Stack
                    direction="row"
                    sx={{
                      border: `1px solid ${C.border}`,
                      borderRadius: '6px',
                      overflow: 'hidden'
                    }}
                  >
                    {(['side', 'above'] as const).map(position => {
                      const active =
                        (selected.labelPosition ?? 'side') === position
                      return (
                        <ButtonBase
                          key={position}
                          onClick={() =>
                            updateField(selected.id, { labelPosition: position })
                          }
                          sx={{
                            flex: 1,
                            fontSize: 11.5,
                            py: 0.9,
                            fontWeight: active ? 700 : 400,
                            bgcolor: active ? C.accent : 'transparent',
                            color: active ? C.accentText : C.muted
                          }}
                        >
                          {position === 'side' ? 'Beside box' : 'Above box'}
                        </ButtonBase>
                      )
                    })}
                  </Stack>
                </Box>
              )}

              {/* Width slider */}
              {selected.type !== 'checkbox' && (
                <Box>
                  <Typography sx={{ fontSize: 11, color: C.muted, mb: 0.5 }}>
                    Width —{' '}
                    {Math.round(
                      (((selected.span ?? 1) || 1) / selectedRowDivisor) * 100
                    )}
                    % of row
                  </Typography>
                  <Slider
                    size="small"
                    min={0.1}
                    max={3}
                    step={0.05}
                    value={selected.span && selected.span > 0 ? selected.span : 1}
                    onChange={(_, value) =>
                      updateField(selected.id, { span: value as number })
                    }
                    marks={[
                      { value: 0.1, label: '' },
                      { value: 0.25, label: '¼×' },
                      { value: 0.5, label: '½×' },
                      { value: 1, label: '1×' },
                      { value: 2, label: '2×' },
                      { value: 3, label: '3×' }
                    ]}
                    sx={{
                      color: C.accent,
                      mx: 1,
                      width: 'calc(100% - 16px)',
                      '& .MuiSlider-markLabel': { color: C.muted, fontSize: 10 }
                    }}
                  />
                </Box>
              )}

              {/* Height */}
              {selected.type !== 'divider' && (
                <TextField
                  label="Height (pt)"
                  size="small"
                  type="number"
                  value={selected.height}
                  onChange={e =>
                    updateField(selected.id, {
                      height: Number(e.target.value) || DEFAULT_HEIGHTS[selected.type]
                    })
                  }
                  sx={darkInputSx}
                />
              )}

              {/* Dropdown / Radio options */}
              {(selected.type === 'dropdown' || selected.type === 'radio') && (
                <Box>
                  {selected.type === 'dropdown' && (
                    <TextField
                      label="Placeholder text"
                      size="small"
                      placeholder="Select..."
                      value={selected.dropdownPlaceholder ?? ''}
                      onChange={e => updateField(selected.id, { dropdownPlaceholder: e.target.value || undefined })}
                      sx={{ ...darkInputSx, mb: 1 }}
                    />
                  )}
                  {selected.type === 'radio' && (selected.options ?? []).length > 1 && (
                    <TextField
                      label="Columns"
                      size="small"
                      type="number"
                      value={selected.radioColumns ?? 1}
                      onChange={e => updateField(selected.id, { radioColumns: Math.max(1, Number(e.target.value) || 1) })}
                      sx={{ ...darkInputSx, mb: 1 }}
                      slotProps={{ htmlInput: { min: 1, max: 6, step: 1 } }}
                    />
                  )}
                  <Typography sx={{ fontSize: 11, color: C.muted, mb: 0.5 }}>Options</Typography>
                  <Stack spacing={0.5}>
                    {(selected.options ?? ['Option 1', 'Option 2']).map((opt, idx) => {
                      const isRadio = selected.type === 'radio'
                      const style = (selected.optionStyles ?? [])[idx] ?? {}
                      const updateStyle = (patch: Partial<typeof style>) => {
                        setFields(cur => cur.map(f => {
                          if (f.id !== selected.id) return f
                          const existing = f.optionStyles ?? []
                          const opts     = f.options ?? []
                          const next     = opts.map((_, i) => ({ ...(existing[i] ?? {}) }))
                          next[idx]      = { ...next[idx], ...patch }
                          return { ...f, optionStyles: next }
                        }))
                      }
                      const isBold   = style.fontWeight === 'bold'
                      const isItalic = style.fontStyle  === 'italic'
                      return (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TextField
                            size="small"
                            placeholder={`Option ${idx + 1}`}
                            value={opt}
                            onChange={e => {
                              const next = [...(selected.options ?? [])]
                              next[idx] = e.target.value
                              updateField(selected.id, { options: next })
                            }}
                            sx={{ ...darkInputSx, flex: 1, minWidth: 0 }}
                          />
                          {/* Radio-only: font size, B/I, color */}
                          {isRadio && (
                            <>
                              <TextField
                                size="small"
                                type="number"
                                value={style.fontSize ?? ''}
                                placeholder="sz"
                                onChange={e => updateStyle({ fontSize: Number(e.target.value) || undefined })}
                                slotProps={{ htmlInput: { min: 6, max: 72, step: 1 } }}
                                sx={{ ...darkInputSx, width: 38, '& input': { px: '4px', py: '4px', textAlign: 'center', fontSize: 11 } }}
                              />
                              {(['bold', 'italic'] as const).map(s => {
                                const active = s === 'bold' ? isBold : isItalic
                                return (
                                  <ButtonBase
                                    key={s}
                                    onClick={() => updateStyle(
                                      s === 'bold'
                                        ? { fontWeight: active ? 'normal' : 'bold' }
                                        : { fontStyle: active ? 'normal' : 'italic' }
                                    )}
                                    sx={{
                                      width: 24, height: 24, borderRadius: '4px',
                                      border: `1px solid ${C.border}`,
                                      bgcolor: active ? C.accent : 'transparent',
                                      color: active ? C.accentText : C.muted,
                                      fontWeight: s === 'bold' ? 700 : 400,
                                      fontStyle: s === 'italic' ? 'italic' : 'normal',
                                      fontSize: 12, flexShrink: 0
                                    }}
                                  >
                                    {s === 'bold' ? 'B' : 'I'}
                                  </ButtonBase>
                                )
                              })}
                              <Tooltip title="Text color">
                                <Box
                                  component="label"
                                  sx={{
                                    width: 24, height: 24, borderRadius: '4px',
                                    border: `1px solid ${C.border}`,
                                    bgcolor: style.textColor ?? '#1a1a1a',
                                    cursor: 'pointer', flexShrink: 0,
                                    position: 'relative', overflow: 'hidden'
                                  }}
                                >
                                  <input
                                    type="color"
                                    value={style.textColor ?? '#1a1a1a'}
                                    onChange={e => updateStyle({ textColor: e.target.value })}
                                    style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none', padding: 0 }}
                                  />
                                </Box>
                              </Tooltip>
                            </>
                          )}
                          <Tooltip title="Remove">
                            <IconButton
                              size="small"
                              onClick={() => {
                                const nextOpts   = (selected.options ?? []).filter((_, i) => i !== idx)
                                const nextStyles = (selected.optionStyles ?? []).filter((_, i) => i !== idx)
                                updateField(selected.id, { options: nextOpts.length ? nextOpts : [''], optionStyles: nextStyles })
                              }}
                              sx={{ color: C.muted, '&:hover': { color: '#e57373' }, p: '2px', flexShrink: 0 }}
                            >
                              <DeleteOutlinedIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )
                    })}
                  </Stack>
                  <ButtonBase
                    onClick={() => updateField(selected.id, {
                      options: [...(selected.options ?? []), ''],
                      optionStyles: [...(selected.optionStyles ?? []), {}]
                    })}
                    sx={{
                      mt: 0.75, display: 'flex', alignItems: 'center', gap: '4px',
                      fontSize: 11, color: C.accent, px: 0.5, py: 0.25,
                      borderRadius: '4px', '&:hover': { bgcolor: 'rgba(108,158,255,0.1)' }
                    }}
                  >
                    <AddIcon sx={{ fontSize: 14 }} />
                    Add option
                  </ButtonBase>
                </Box>
              )}

              {/* Static-text specific */}
              {selected.type === 'static-text' && (
                <>
                  <SectionDivider />
                  <PanelHeading>Text style</PanelHeading>
                  <Stack direction="row" sx={{ gap: 1 }}>
                    <TextField
                      label="Font size (pt)"
                      size="small"
                      type="number"
                      value={selected.fontSize ?? 12}
                      onChange={e =>
                        updateField(selected.id, { fontSize: Number(e.target.value) || 12 })
                      }
                      sx={{ flex: 1, ...darkInputSx }}
                    />
                    <Stack direction="row" sx={{ gap: 0.5 }}>
                      {(['bold', 'italic'] as const).map(style => {
                        const isWeight = style === 'bold'
                        const active = isWeight
                          ? selected.fontWeight === 'bold'
                          : selected.fontStyle === 'italic'
                        return (
                          <ButtonBase
                            key={style}
                            onClick={() =>
                              updateField(selected.id,
                                isWeight
                                  ? { fontWeight: active ? 'normal' : 'bold' }
                                  : { fontStyle: active ? 'normal' : 'italic' }
                              )
                            }
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: '6px',
                              border: `1px solid ${C.border}`,
                              bgcolor: active ? C.accent : 'transparent',
                              color: active ? C.accentText : C.muted,
                              fontWeight: style === 'bold' ? 700 : 400,
                              fontStyle: style === 'italic' ? 'italic' : 'normal',
                              fontSize: 13
                            }}
                          >
                            {style === 'bold' ? 'B' : 'I'}
                          </ButtonBase>
                        )
                      })}
                    </Stack>
                  </Stack>
                  <ColorPicker
                    label="Text color"
                    value={selected.textColor ?? '#1a1a1a'}
                    onChange={v => updateField(selected.id, { textColor: v })}
                  />
                  <Box>
                    <Typography sx={{ fontSize: 11, color: C.muted, mb: 0.5 }}>
                      Alignment
                    </Typography>
                    <Stack
                      direction="row"
                      sx={{
                        border: `1px solid ${C.border}`,
                        borderRadius: '6px',
                        overflow: 'hidden'
                      }}
                    >
                      {(['left', 'center', 'right'] as const).map(align => {
                        const active = (selected.textAlign ?? 'left') === align
                        return (
                          <ButtonBase
                            key={align}
                            onClick={() => updateField(selected.id, { textAlign: align })}
                            sx={{
                              flex: 1,
                              fontSize: 11.5,
                              py: 0.9,
                              fontWeight: active ? 700 : 400,
                              bgcolor: active ? C.accent : 'transparent',
                              color: active ? C.accentText : C.muted
                            }}
                          >
                            {align.charAt(0).toUpperCase() + align.slice(1)}
                          </ButtonBase>
                        )
                      })}
                    </Stack>
                  </Box>
                </>
              )}

              {/* Spacing for static-text */}
              {selected.type === 'static-text' && (
                <>
                  <SectionDivider />
                  <PanelHeading>Spacing</PanelHeading>
                  <Stack direction="row" sx={{ gap: 1 }}>
                    <TextField
                      label="Padding top (pt)"
                      size="small"
                      type="number"
                      value={selected.paddingTop ?? 4}
                      onChange={e => updateField(selected.id, { paddingTop: Math.max(0, Number(e.target.value)) })}
                      sx={{ flex: 1, ...darkInputSx }}
                    />
                    <TextField
                      label="Padding bottom (pt)"
                      size="small"
                      type="number"
                      value={selected.paddingBottom ?? 4}
                      onChange={e => updateField(selected.id, { paddingBottom: Math.max(0, Number(e.target.value)) })}
                      sx={{ flex: 1, ...darkInputSx }}
                    />
                  </Stack>
                </>
              )}

              {/* Border for static-text */}
              {selected.type === 'static-text' && (
                <>
                  <SectionDivider />
                  <PanelHeading>Border</PanelHeading>
                  <ColorPicker
                    label="Border color"
                    value={selected.borderColor ?? '#cccccc'}
                    onChange={v => updateField(selected.id, { borderColor: v })}
                  />
                  <Stack direction="row" sx={{ gap: 1 }}>
                    <TextField
                      label="All sides (pt)"
                      size="small"
                      type="number"
                      value={selected.borderWidth ?? 0}
                      onChange={e => updateField(selected.id, { borderWidth: Number(e.target.value) })}
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                    />
                    <TextField
                      label="Radius (pt)"
                      size="small"
                      type="number"
                      value={selected.borderRadius ?? 0}
                      onChange={e => updateField(selected.id, { borderRadius: Number(e.target.value) })}
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                  </Stack>
                  <Typography sx={{ fontSize: 10, color: C.muted, mb: 0.5 }}>Per-corner radius (overrides "Radius")</Typography>
                  <Stack direction="row" sx={{ gap: 1 }}>
                    <TextField
                      label="Top Left"
                      size="small"
                      type="number"
                      placeholder={String(selected.borderRadius ?? 0)}
                      value={selected.borderTopLeftRadius ?? ''}
                      onChange={e => updateField(selected.id, { borderTopLeftRadius: e.target.value === '' ? undefined : Number(e.target.value) })}
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                    <TextField
                      label="Top Right"
                      size="small"
                      type="number"
                      placeholder={String(selected.borderRadius ?? 0)}
                      value={selected.borderTopRightRadius ?? ''}
                      onChange={e => updateField(selected.id, { borderTopRightRadius: e.target.value === '' ? undefined : Number(e.target.value) })}
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                  </Stack>
                  <Stack direction="row" sx={{ gap: 1 }}>
                    <TextField
                      label="Bottom Left"
                      size="small"
                      type="number"
                      placeholder={String(selected.borderRadius ?? 0)}
                      value={selected.borderBottomLeftRadius ?? ''}
                      onChange={e => updateField(selected.id, { borderBottomLeftRadius: e.target.value === '' ? undefined : Number(e.target.value) })}
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                    <TextField
                      label="Bottom Right"
                      size="small"
                      type="number"
                      placeholder={String(selected.borderRadius ?? 0)}
                      value={selected.borderBottomRightRadius ?? ''}
                      onChange={e => updateField(selected.id, { borderBottomRightRadius: e.target.value === '' ? undefined : Number(e.target.value) })}
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                  </Stack>
                </>
              )}

              {/* Image specific */}
              {selected.type === 'image' && (
                <>
                  <SectionDivider />
                  <PanelHeading>Image</PanelHeading>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = ev => {
                        updateField(selected.id, { imageData: ev.target?.result as string })
                      }
                      reader.readAsDataURL(file)
                    }}
                  />
                  <MockButton onClick={() => imageInputRef.current?.click()}>
                    {selected.imageData ? 'Replace image' : 'Upload image (PNG / JPEG)'}
                  </MockButton>

                  {/* Free position toggle */}
                  <Box>
                    <Typography sx={{ fontSize: 11, color: C.muted, mb: 0.5 }}>
                      Positioning
                    </Typography>
                    <Stack
                      direction="row"
                      sx={{
                        border: `1px solid ${C.border}`,
                        borderRadius: '6px',
                        overflow: 'hidden'
                      }}
                    >
                      {(['grid', 'free'] as const).map(mode => {
                        const isFree = !selected.row
                        const active = mode === 'free' ? isFree : !isFree
                        return (
                          <ButtonBase
                            key={mode}
                            onClick={() => {
                              if (mode === 'free') {
                                // Remove from grid — use last known or default coordinates
                                setFields(current => {
                                  const updated = normalize(
                                    current.filter(f => f.id !== selected.id)
                                  )
                                  return [
                                    ...updated,
                                    {
                                      ...selected,
                                      row: undefined,
                                      column: undefined,
                                      x: selected.x || PAGE_MARGIN,
                                      y: selected.y || 400,
                                      width: selected.width || PAGE_WIDTH - 2 * PAGE_MARGIN,
                                      height: selected.height || DEFAULT_IMAGE_HEIGHT,
                                      page
                                    }
                                  ]
                                })
                              } else {
                                // Put back into a new grid row
                                setFields(current => {
                                  const pageRows = current
                                    .filter(f => (f.page || 1) === page && f.row)
                                    .map(f => f.row!)
                                  const maxRow = pageRows.length ? Math.max(...pageRows) : 0
                                  return normalize(
                                    current.map(f =>
                                      f.id === selected.id
                                        ? { ...f, row: maxRow + 1, column: 1, page }
                                        : f
                                    )
                                  )
                                })
                              }
                            }}
                            sx={{
                              flex: 1,
                              fontSize: 11.5,
                              py: 0.9,
                              fontWeight: active ? 700 : 400,
                              bgcolor: active ? C.accent : 'transparent',
                              color: active ? C.accentText : C.muted
                            }}
                          >
                            {mode === 'grid' ? 'Grid' : 'Free drag'}
                          </ButtonBase>
                        )
                      })}
                    </Stack>
                    {!selected.row && (
                      <Typography sx={{ fontSize: 11, color: C.muted, mt: 0.5, lineHeight: 1.4 }}>
                        Drag the image on the canvas to position it freely.
                      </Typography>
                    )}
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 11, color: C.muted, mb: 0.5 }}>
                      Object fit
                    </Typography>
                    <Stack
                      direction="row"
                      sx={{
                        border: `1px solid ${C.border}`,
                        borderRadius: '6px',
                        overflow: 'hidden'
                      }}
                    >
                      {(['contain', 'fill'] as const).map(fit => {
                        const active = (selected.imageObjectFit ?? 'contain') === fit
                        return (
                          <ButtonBase
                            key={fit}
                            onClick={() => updateField(selected.id, { imageObjectFit: fit })}
                            sx={{
                              flex: 1,
                              fontSize: 11.5,
                              py: 0.9,
                              fontWeight: active ? 700 : 400,
                              bgcolor: active ? C.accent : 'transparent',
                              color: active ? C.accentText : C.muted
                            }}
                          >
                            {fit.charAt(0).toUpperCase() + fit.slice(1)}
                          </ButtonBase>
                        )
                      })}
                    </Stack>
                  </Box>
                </>
              )}

              {/* Divider specific */}
              {selected.type === 'divider' && (
                <>
                  <SectionDivider />
                  <PanelHeading>Divider</PanelHeading>
                  <TextField
                    label="Thickness (pt)"
                    size="small"
                    type="number"
                    value={selected.height ?? 1}
                    onChange={e =>
                      updateField(selected.id, { height: Number(e.target.value) || 1 })
                    }
                    sx={darkInputSx}
                  />
                  <ColorPicker
                    label="Line color"
                    value={selected.borderColor ?? '#cccccc'}
                    onChange={v => updateField(selected.id, { borderColor: v })}
                  />
                </>
              )}

              {/* Table specific */}
              {selected.type === 'table' && (
                <>
                  <SectionDivider />
                  {/* Label position picker */}
                  <Box>
                    <Typography sx={{ fontSize: 11, color: C.muted, mb: 0.5 }}>Label position</Typography>
                    <Stack direction="row" sx={{ border: `1px solid ${C.border}`, borderRadius: '6px', overflow: 'hidden' }}>
                      {(['above', 'none'] as const).map(pos => (
                        <ButtonBase
                          key={pos}
                          onClick={() => updateField(selected.id, { tableLabelPosition: pos })}
                          sx={{
                            flex: 1, fontSize: 12, py: 0.8,
                            fontWeight: (selected.tableLabelPosition ?? 'none') === pos ? 700 : 400,
                            bgcolor: (selected.tableLabelPosition ?? 'none') === pos ? C.accent : 'transparent',
                            color: (selected.tableLabelPosition ?? 'none') === pos ? C.accentText : C.muted
                          }}
                        >
                          {pos === 'above' ? 'Above table' : 'Hidden'}
                        </ButtonBase>
                      ))}
                    </Stack>
                  </Box>
                  {/* Title bar styling — only when visible */}
                  {selected.tableLabelPosition === 'above' && (() => {
                    const cfg = selected.tableConfig ?? defaultTableConfig()
                    const patchCfg = (patch: Partial<TableConfig>) =>
                      updateField(selected.id, { tableConfig: { ...cfg, ...patch } })
                    return (
                      <Stack sx={{ gap: 1 }}>
                        <ColorPicker
                          label="Title background"
                          value={cfg.titleBg ?? '#2c3a57'}
                          onChange={v => patchCfg({ titleBg: v })}
                        />
                        <ColorPicker
                          label="Title text color"
                          value={cfg.titleTextColor ?? '#ffffff'}
                          onChange={v => patchCfg({ titleTextColor: v })}
                        />
                        <TextField
                          label="Title font size (pt)"
                          size="small"
                          type="number"
                          value={cfg.titleFontSize ?? 11}
                          onChange={e => patchCfg({ titleFontSize: Number(e.target.value) || 11 })}
                          sx={{ ...darkInputSx }}
                          slotProps={{ htmlInput: { min: 6, max: 24, step: 1 } }}
                        />
                      </Stack>
                    )
                  })()}
                  <MockButton onClick={() => setShowTableEditor(true)} sx={{ width: '100%', justifyContent: 'center' }}>
                    Edit table structure
                  </MockButton>
                </>
              )}

              <SectionDivider />
              <PanelHeading>Style</PanelHeading>
              {FILLABLE_TYPES.includes(selected.type) && (
                <ColorPicker
                  label="Text color"
                  value={selected.textColor ?? '#1a1a1a'}
                  onChange={v => updateField(selected.id, { textColor: v })}
                />
              )}
              {selected.type === 'dropdown' && (
                <Stack direction="row" sx={{ gap: 1 }}>
                  <TextField
                    label="Font size (pt)"
                    size="small"
                    type="number"
                    value={selected.fontSize ?? 10}
                    onChange={e => updateField(selected.id, { fontSize: Number(e.target.value) || 10 })}
                    sx={{ flex: 1, ...darkInputSx }}
                    slotProps={{ htmlInput: { min: 6, max: 48, step: 1 } }}
                  />
                  <Stack direction="row" sx={{ gap: 0.5 }}>
                    {(['bold', 'italic'] as const).map(s => {
                      const isWeight = s === 'bold'
                      const active = isWeight ? selected.fontWeight === 'bold' : selected.fontStyle === 'italic'
                      return (
                        <ButtonBase
                          key={s}
                          onClick={() => updateField(selected.id,
                            isWeight
                              ? { fontWeight: active ? 'normal' : 'bold' }
                              : { fontStyle: active ? 'normal' : 'italic' }
                          )}
                          sx={{
                            width: 32, height: 32, borderRadius: '6px',
                            border: `1px solid ${C.border}`,
                            bgcolor: active ? C.accent : 'transparent',
                            color: active ? C.accentText : C.muted,
                            fontWeight: s === 'bold' ? 700 : 400,
                            fontStyle: s === 'italic' ? 'italic' : 'normal',
                            fontSize: 13
                          }}
                        >
                          {s === 'bold' ? 'B' : 'I'}
                        </ButtonBase>
                      )
                    })}
                  </Stack>
                </Stack>
              )}
              <ColorPicker
                label="Background color"
                value={selected.backgroundColor ?? '#ffffff'}
                onChange={v => updateField(selected.id, { backgroundColor: v })}
              />

              {/* Border controls — shown for fillable fields */}
              {FILLABLE_TYPES.includes(selected.type) && (
                <>
                  <SectionDivider />
                  <PanelHeading>Border</PanelHeading>
                  <ColorPicker
                    label="Border color"
                    value={selected.borderColor ?? '#999999'}
                    onChange={v => updateField(selected.id, { borderColor: v })}
                  />
                  <Stack direction="row" sx={{ gap: 1 }}>
                    <TextField
                      label="All sides (pt)"
                      size="small"
                      type="number"
                      value={selected.borderWidth ?? 1}
                      onChange={e => updateField(selected.id, { borderWidth: Number(e.target.value) })}
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                    />
                    <TextField
                      label="Radius (pt)"
                      size="small"
                      type="number"
                      value={selected.borderRadius ?? 2}
                      onChange={e => updateField(selected.id, { borderRadius: Number(e.target.value) })}
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                  </Stack>
                  {/* Per-corner radius overrides */}
                  <Typography sx={{ fontSize: 10, color: C.muted, mb: 0.5 }}>Per-corner radius (overrides "Radius")</Typography>
                  <Stack direction="row" sx={{ gap: 1 }}>
                    <TextField
                      label="Top Left"
                      size="small"
                      type="number"
                      placeholder={String(selected.borderRadius ?? 0)}
                      value={selected.borderTopLeftRadius ?? ''}
                      onChange={e => updateField(selected.id, { borderTopLeftRadius: e.target.value === '' ? undefined : Number(e.target.value) })}
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                    <TextField
                      label="Top Right"
                      size="small"
                      type="number"
                      placeholder={String(selected.borderRadius ?? 0)}
                      value={selected.borderTopRightRadius ?? ''}
                      onChange={e => updateField(selected.id, { borderTopRightRadius: e.target.value === '' ? undefined : Number(e.target.value) })}
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                  </Stack>
                  <Stack direction="row" sx={{ gap: 1 }}>
                    <TextField
                      label="Bottom Left"
                      size="small"
                      type="number"
                      placeholder={String(selected.borderRadius ?? 0)}
                      value={selected.borderBottomLeftRadius ?? ''}
                      onChange={e => updateField(selected.id, { borderBottomLeftRadius: e.target.value === '' ? undefined : Number(e.target.value) })}
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                    <TextField
                      label="Bottom Right"
                      size="small"
                      type="number"
                      placeholder={String(selected.borderRadius ?? 0)}
                      value={selected.borderBottomRightRadius ?? ''}
                      onChange={e => updateField(selected.id, { borderBottomRightRadius: e.target.value === '' ? undefined : Number(e.target.value) })}
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                  </Stack>
                </>
              )}
              <ColorPicker
                label="Row background (full width)"
                value={
                  getRowFirst(selected.row ?? 0)?.rowBackgroundColor ?? '#ffffff'
                }
                onChange={v => {
                  const first = getRowFirst(selected.row ?? 0)
                  if (first) updateField(first.id, { rowBackgroundColor: v })
                  else updateField(selected.id, { rowBackgroundColor: v })
                }}
              />
              <TextField
                label="Gap above row (pt)"
                size="small"
                type="number"
                value={getRowFirst(selected.row ?? 0)?.spacingBefore ?? 0}
                onChange={e => {
                  const first = getRowFirst(selected.row ?? 0)
                  const val = Number(e.target.value) || 0
                  if (first) updateField(first.id, { spacingBefore: val })
                  else updateField(selected.id, { spacingBefore: val })
                }}
                sx={darkInputSx}
              />
              <TextField
                label="Gap below row (pt)"
                size="small"
                type="number"
                value={getRowFirst(selected.row ?? 0)?.spacingAfter ?? 0}
                onChange={e => {
                  const first = getRowFirst(selected.row ?? 0)
                  const val = Number(e.target.value) || 0
                  if (first) updateField(first.id, { spacingAfter: val })
                  else updateField(selected.id, { spacingAfter: val })
                }}
                sx={darkInputSx}
              />

              <SectionDivider />
              {/* Page */}
              <Box>
                <Typography sx={{ fontSize: 11, color: C.muted, mb: 0.5 }}>
                  Page
                </Typography>
                <Select
                  size="small"
                  fullWidth
                  value={selected.page || 1}
                  onChange={e => {
                    const targetPage = Number(e.target.value)
                    const targetRows = fields
                      .filter(f => (f.page || 1) === targetPage && f.row)
                      .map(f => f.row!)
                    const nextRow = targetRows.length
                      ? Math.max(...targetRows) + 1
                      : 1
                    setFields(current =>
                      normalize(
                        current.map(f =>
                          f.id === selected.id
                            ? { ...f, page: targetPage, row: nextRow, column: 1 }
                            : f
                        )
                      )
                    )
                  }}
                  sx={{
                    bgcolor: C.input,
                    color: C.text,
                    fontSize: 13,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: C.border
                    },
                    '& .MuiSvgIcon-root': { color: C.muted }
                  }}
                >
                  {Array.from({ length: pageCount }, (_, i) => (
                    <MenuItem key={i + 1} value={i + 1}>
                      Page {i + 1}
                    </MenuItem>
                  ))}
                </Select>
              </Box>

              <Typography sx={{ fontSize: 11, color: C.muted }}>
                Row {selected.row}, column {selected.column}
              </Typography>

              <MockButton
                danger
                onClick={() => removeField(selected.id)}
                sx={{ justifyContent: 'center', width: '100%' }}
              >
                <DeleteOutlinedIcon sx={{ fontSize: 15 }} /> Delete field
              </MockButton>
            </Stack>
          )}
        </Box>
      </Stack>

      {/* Delete page confirmation modal */}
      <Dialog
        open={deleteConfirmPage !== null}
        onClose={() => setDeleteConfirmPage(null)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: C.panel,
              color: C.text,
              border: `1px solid ${C.border}`,
              borderRadius: '8px',
              minWidth: 320
            }
          }
        }}
      >
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, pb: 1 }}>
          Delete Page {deleteConfirmPage}?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: C.muted }}>
            All fields on Page {deleteConfirmPage} will be permanently removed. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
          <Button
            size="small"
            onClick={() => setDeleteConfirmPage(null)}
            sx={{ color: C.muted, fontSize: 12 }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => deleteConfirmPage !== null && deletePage(deleteConfirmPage)}
            sx={{
              bgcolor: 'rgba(229,83,75,0.85)',
              color: '#fff',
              fontSize: 12,
              '&:hover': { bgcolor: C.red }
            }}
          >
            Delete Page
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

// ---- palette item sub-component ---------------------------------------------

function PaletteItem({
  item,
  onAdd
}: {
  item: (typeof PALETTE)[0]
  onAdd: (type: FormFieldType, patch?: Partial<FormField>) => void
}) {
  return (
    <Box
      draggable
      onDragStart={(e: React.DragEvent) => {
        e.dataTransfer.setData(DRAG_MIME, item.dragToken ?? item.type)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => onAdd(item.type, item.initPatch)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        border: `1px solid ${C.border}`,
        borderRadius: '8px',
        px: 1.5,
        py: 1,
        fontSize: 13,
        bgcolor: C.panel,
        cursor: 'grab',
        userSelect: 'none',
        '&:hover': { borderColor: C.accent }
      }}
    >
      <Box
        sx={{
          width: 26,
          height: 26,
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          bgcolor: item.tile,
          color: item.color,
          flexShrink: 0
        }}
      >
        {item.glyph}
      </Box>
      {item.label}
    </Box>
  )
}

// ---- field canvas renderer --------------------------------------------------

function FieldCanvas({
  field,
  rowLabelSpace,
  rowHeight
}: {
  field: FormField
  rowLabelSpace: number
  rowHeight: number
}) {
  if (field.type === 'static-text') {
    const bw  = field.borderWidth   ?? 0
    const bc  = field.borderColor   ?? '#cccccc'
    const br  = field.borderRadius  ?? 0
    const btw = field.borderTopWidth    ?? bw
    const brw = field.borderRightWidth  ?? bw
    const bbw = field.borderBottomWidth ?? bw
    const blw = field.borderLeftWidth   ?? bw
    // Per-corner radius (CSS order: TL TR BR BL)
    const rTL = field.borderTopLeftRadius     ?? br
    const rTR = field.borderTopRightRadius    ?? br
    const rBR = field.borderBottomRightRadius ?? br
    const rBL = field.borderBottomLeftRadius  ?? br
    const radiusCss = `${px(rTL)}px ${px(rTR)}px ${px(rBR)}px ${px(rBL)}px`
    const size = field.fontSize ?? 12
    const lineH = size * 1.4
    return (
      <Box
        sx={{
          borderTop:    btw > 0 ? `${btw}px solid ${bc}` : 'none',
          borderRight:  brw > 0 ? `${brw}px solid ${bc}` : 'none',
          borderBottom: bbw > 0 ? `${bbw}px solid ${bc}` : 'none',
          borderLeft:   blw > 0 ? `${blw}px solid ${bc}` : 'none',
          borderRadius: radiusCss,
          overflow: 'hidden',
          boxSizing: 'border-box',
          minHeight: px(field.height || DEFAULT_STATIC_TEXT_HEIGHT)
        }}
      >
        <Box
          sx={{
          pt: `${px(field.paddingTop ?? 4)}px`,
          pb: `${px(field.paddingBottom ?? 4)}px`,
          px: `${px(4)}px`,
            fontSize: px(size),
            fontWeight: field.fontWeight === 'bold' ? 700 : 400,
            fontStyle: field.fontStyle === 'italic' ? 'italic' : 'normal',
            color: field.textColor ?? '#1a1a1a',
            textAlign: field.textAlign ?? 'left',
            lineHeight: 1.4,
            wordBreak: 'break-word',
            bgcolor: field.backgroundColor ?? 'transparent',
            // Each <p> is a new paragraph line; add spacing between them matching PDF lineHeight
            '& p': { margin: 0, minHeight: `${px(lineH)}px` },
            '& p + p': { marginTop: 0 },
            '& strong': { fontWeight: 700 },
            '& em': { fontStyle: 'italic' },
            '& u': { textDecoration: 'underline' }
          }}
          dangerouslySetInnerHTML={{
            __html: field.contentHtml ?? field.content ?? '<em style="color:#aaa">Static text</em>'
          }}
        />
      </Box>
    )
  }

  if (field.type === 'image') {
    return (
      <Box
        sx={{
          width: '100%',
          height: px(field.height || DEFAULT_IMAGE_HEIGHT),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px dashed #ccc',
          bgcolor: '#f9f9f9',
          borderRadius: '2px',
          overflow: 'hidden'
        }}
      >
        {field.imageData ? (
          <img
            src={field.imageData}
            alt=""
            style={{
              objectFit: field.imageObjectFit ?? 'contain',
              width: '100%',
              height: '100%'
            }}
          />
        ) : (
          <Typography sx={{ fontSize: px(9), color: '#aaa' }}>
            🖼 No image
          </Typography>
        )}
      </Box>
    )
  }

  if (field.type === 'divider') {
    return (
      <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', height: '100%' }}>
        <Box
          sx={{
            width: '100%',
            height: Math.max(1, px(field.height || 1.5)),
            bgcolor: field.borderColor ?? '#888888'
          }}
        />
      </Box>
    )
  }

  if (field.type === 'table') {
    return <TablePreview field={field} />
  }

  // Fillable: checkbox, text, dropdown
  if (field.type === 'checkbox' && field.labelPosition === 'above') {
    return (
      <Box>
        <Typography
          sx={{
            fontSize: px(9.5),
            fontWeight: 600,
            color: field.textColor ?? '#444',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            whiteSpace: 'nowrap',
            overflow: 'visible',
            width: 'max-content',
            height: px(rowLabelSpace),
            display: 'flex',
            alignItems: 'flex-end',
            pb: `${px(3)}px`,
            '& p': { margin: 0 }, '& strong': { fontWeight: 700 }, '& em': { fontStyle: 'italic' }, '& u': { textDecoration: 'underline' }
          }}
          dangerouslySetInnerHTML={{ __html: field.labelHtml ?? field.label }}
        />
        <Box
          sx={{
            width: px(field.height),
            height: px(field.height),
            border: '1px solid #999',
            borderRadius: '2px',
            bgcolor: '#fafafa'
          }}
        />
      </Box>
    )
  }

  // Single radio — renders inline like a checkbox (circle + label, no container)
  if (field.type === 'radio' && (field.options ?? []).length <= 1) {
    const opt = (field.options ?? [''])[0]
    const s = (field.optionStyles ?? [])[0] ?? {}
    return (
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          gap: `${px(CHECKBOX_LABEL_GAP)}px`,
          height: px(rowLabelSpace + rowHeight),
          pt: `${px(rowLabelSpace)}px`
        }}
      >
        <Box
          sx={{
            width: px(field.height),
            height: px(field.height),
            border: `1px solid ${field.borderColor ?? '#999'}`,
            borderRadius: '50%',
            bgcolor: '#fafafa',
            flexShrink: 0
          }}
        />
        <Typography sx={{
          fontSize: px(s.fontSize ?? 10),
          fontWeight: s.fontWeight ?? 'normal',
          fontStyle: s.fontStyle ?? 'normal',
          color: s.textColor ?? '#333',
          whiteSpace: 'nowrap'
        }}>
          {opt || field.label}
        </Typography>
      </Stack>
    )
  }

  if (field.type === 'checkbox') {
    return (
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          gap: `${px(CHECKBOX_LABEL_GAP)}px`,
          height: px(rowLabelSpace + rowHeight),
          pt: `${px(rowLabelSpace)}px`
        }}
      >
        <Box
          sx={{
            width: px(field.height),
            height: px(field.height),
            border: `${field.borderWidth ?? 1}px solid ${field.borderColor ?? '#999'}`,
            borderRadius: `${px(field.borderRadius ?? 2)}px`,
            bgcolor: '#fafafa',
            flexShrink: 0
          }}
        />
        <Box
          sx={{
            fontSize: px(10),
            color: field.textColor ?? '#333',
            whiteSpace: 'nowrap',
            overflow: 'visible',
            width: 'max-content',
            flexShrink: 0,
            '& p': { margin: 0 }, '& strong': { fontWeight: 700 }, '& em': { fontStyle: 'italic' }, '& u': { textDecoration: 'underline' }
          }}
          dangerouslySetInnerHTML={{ __html: field.labelHtml ?? field.label }}
        />
      </Stack>
    )
  }

  // text / dropdown
  const bw = field.borderWidth ?? 1
  const bc = field.borderColor ?? '#999999'
  const br = field.borderRadius ?? 2
  // Per-side widths fall back to the uniform borderWidth
  const btw = field.borderTopWidth    ?? bw
  const brw = field.borderRightWidth  ?? bw
  const bbw = field.borderBottomWidth ?? bw
  const blw = field.borderLeftWidth   ?? bw
  // Per-corner radius (CSS order: TL TR BR BL)
  const rTL = field.borderTopLeftRadius     ?? br
  const rTR = field.borderTopRightRadius    ?? br
  const rBR = field.borderBottomRightRadius ?? br
  const rBL = field.borderBottomLeftRadius  ?? br
  const radiusCss = `${px(rTL)}px ${px(rTR)}px ${px(rBR)}px ${px(rBL)}px`
  // Divider between label strip and input uses the top+bottom sides
  const midW = Math.max(btw, bbw, 0.5)
  // Read alignment from labelHtml the same way the PDF export does
  const align = (() => {
    if (!field.labelHtml) return 'flex-start'
    const m = field.labelHtml.match(/<p[^>]*style="[^"]*text-align:\s*(left|center|right)/i)
    const a = m?.[1]?.toLowerCase()
    return a === 'center' ? 'center' : a === 'right' ? 'flex-end' : 'flex-start'
  })()
  // Bold: default true when no labelHtml (new field); detect <strong> when HTML exists
  const labelHasBold = !field.labelHtml || /<strong|<b[ >]/i.test(field.labelHtml)
  // Italic: detect <em> or <i> in HTML
  const labelHasItalic = /<em|<i[ >]/i.test(field.labelHtml ?? '')
  // Underline: detect <u> in HTML
  const labelHasUnderline = /<u[ >]/i.test(field.labelHtml ?? '')
  return (
    <Box
      sx={{
        borderTop:    `${btw}px solid ${bc}`,
        borderRight:  `${brw}px solid ${bc}`,
        borderBottom: `${bbw}px solid ${bc}`,
        borderLeft:   `${blw}px solid ${bc}`,
        borderRadius: radiusCss,
        overflow: 'hidden',
        height: px(LABEL_SPACE + field.height),
        boxSizing: 'border-box'
      }}
    >
      <Box
        sx={{
          fontWeight: labelHasBold ? 700 : 400,
          fontStyle: labelHasItalic ? 'italic' : 'normal',
          textDecoration: labelHasUnderline ? 'underline' : 'none',
          color: field.textColor ?? '#444',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          height: px(LABEL_SPACE),
          display: 'flex',
          alignItems: 'center',
          justifyContent: align,
          px: `${px(4)}px`,
          bgcolor: field.backgroundColor ?? '#ffffff',
          flexShrink: 0,
          overflow: 'hidden',
          '& p': { margin: 0, fontSize: 'inherit' },
          '& strong': { fontWeight: 800 },
          '& em': { fontStyle: 'italic' },
          '& u': { textDecoration: 'underline' }
        }}
        dangerouslySetInnerHTML={{ __html: field.labelHtml ?? field.label }}
      />
      <Box
        sx={{
          height: px(field.height),
          bgcolor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: `${px(5)}px`,
          borderTop: `${midW}px solid ${bc}`
        }}
      >
        {field.type === 'dropdown' && (() => {
          const hasPlaceholder = !!field.dropdownPlaceholder
          const displayText = field.dropdownPlaceholder || (field.options ?? [])[0] || 'Select…'
          // Only apply option styling when actually showing that option (no placeholder)
          const optStyle = hasPlaceholder ? null : (field.optionStyles?.[0] ?? null)
          return (
            <>
              <Typography sx={{
                fontSize: px(optStyle?.fontSize ?? field.fontSize ?? 10),
                fontWeight: optStyle?.fontWeight ?? 'normal',
                fontStyle: optStyle?.fontStyle ?? 'normal',
                color: hasPlaceholder ? '#aaa' : (optStyle?.textColor ?? '#555'),
                flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
              }}>
                {displayText}
              </Typography>
              <Typography sx={{ fontSize: px(9), color: '#777', ml: 0.5, flexShrink: 0 }}>▾</Typography>
            </>
          )
        })()}
        {field.type === 'radio' && (() => {
          const opts = field.options ?? []
          const cols = Math.max(1, field.radioColumns ?? 1)
          const isSingle = opts.length <= 1
          if (isSingle) {
            // handled above as a special render path — won't reach here
            return null
          }
          return (
            <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, width: '100%', gap: `${px(2)}px 0` }}>
              {opts.map((opt, i) => {
                const s = (field.optionStyles ?? [])[i] ?? {}
                return (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: `${px(3)}px` }}>
                    <Box sx={{ width: px(7), height: px(7), borderRadius: '50%', border: `${px(1)}px solid #999`, bgcolor: '#fff', flexShrink: 0 }} />
                    <Typography sx={{
                      fontSize: px(s.fontSize ?? field.fontSize ?? 10),
                      fontWeight: s.fontWeight ?? 'normal',
                      fontStyle: s.fontStyle ?? 'normal',
                      color: s.textColor ?? '#1a1a1a',
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                    }}>
                      {opt}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
          )
        })()}
      </Box>
    </Box>
  )
}
