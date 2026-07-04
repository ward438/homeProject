'use client'

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

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

import type {
  FormField,
  FormFieldType,
  TableConfig,
  TableRow,
  TitleStyle
} from '@/lib/documents/types'
import { DEFAULT_TITLE_STYLE } from '@/lib/documents/types'
import type {
  FormBuilderProps,
  FormTemplateApiResponse
} from '@/lib/types/form-builder'

import { ColorPicker } from '@/components/documents/color-picker'
import {
  htmlToPlain,
  RichTextEditor
} from '@/components/documents/rich-text-editor'

import { FieldCanvas, PaletteItem } from './canvas'
import {
  approxStaticTextHeight,
  CANVAS_WIDTH,
  checkboxNaturalWidth,
  COLUMN_GUTTER,
  COMPACT_COLUMN_GAP,
  CONTENT_TOP,
  DEFAULT_HEIGHTS,
  DEFAULT_IMAGE_HEIGHT,
  defaultTableConfig,
  DRAG_FIELD_MIME,
  DRAG_MIME,
  FILLABLE_TYPES,
  isBuilderDrag,
  isCompactRow,
  LABEL_SPACE,
  makeField,
  migrateToRows,
  needsAboveLabel,
  normalize,
  PAGE_HEIGHT,
  PAGE_MARGIN,
  PAGE_WIDTH,
  PALETTE,
  px,
  rebalanceOverflow,
  ROW_GAP,
  ROW_GAP_COMPACT,
  SCALE} from './field-factory'
import { TableEditor } from './table-editor'
import {
  C,
  darkInputSx,
  MockButton,
  PanelHeading,
  SectionDivider
} from './theme'

type FormTemplateResponse = FormTemplateApiResponse
// ---- component ---------------------------------------------------------------

export function FormBuilder({
  sourceDocumentId,
  onExported
}: FormBuilderProps) {
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
  const [deleteConfirmPage, setDeleteConfirmPage] = useState<number | null>(
    null
  )
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
        else if (tpl.config?.titleStyle)
          setTitleStyle(tpl.config.titleStyle as TitleStyle)
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      const field = {
        ...makeField(type, page, maxRow + 1, 1),
        ...(patch ?? {})
      }
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
      return {
        kind: 'new',
        type: 'radio',
        patch: {
          options: [''],
          optionStyles: [{}],
          height: DEFAULT_HEIGHTS['checkbox']
        }
      }
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
        const cols = current.filter(
          f => (f.page || 1) === page && f.row === rowNumber
        ).length
        const field = {
          ...makeField(payload.type, page, rowNumber, cols + 1),
          ...(payload.patch ?? {})
        }
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
          (f.page || 1) === page && f.row && f.row >= beforeRow
            ? { ...f, row: f.row + 1 }
            : f
        )
        const field = {
          ...makeField(payload.type, page, beforeRow, 1),
          ...(payload.patch ?? {})
        }
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
        const pageRows = current
          .filter(f => (f.page || 1) === page && f.row)
          .map(f => f.row!)
        const maxRow = pageRows.length ? Math.max(...pageRows) : 0
        const field = {
          ...makeField(payload.type, page, maxRow + 1, 1),
          ...(payload.patch ?? {})
        }
        setSelectedId(field.id)
        return normalize([...current, field])
      })
    } else moveFieldToNewRowAt(payload.id, rows.length + 1)
  }

  // ---- free-position drag (image fields without a row) --------------------

  // PAGE_WIDTH/HEIGHT in PDF pts; SCALE converts to canvas px
  const startFreeDrag = (e: React.MouseEvent, field: FormField) => {
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
        current.map(f =>
          f.id === drag.fieldId ? { ...f, x: newX, y: newY } : f
        )
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
      f =>
        (f.page || 1) === page && f.row === rowNumber && (f.column ?? 1) === 1
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
          <Box
            key={i + 1}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}
          >
            <MockButton
              primary={page === i + 1}
              onClick={() => {
                setPage(i + 1)
                setSelectedId(null)
              }}
              sx={{
                borderTopRightRadius: i > 0 ? 0 : undefined,
                borderBottomRightRadius: i > 0 ? 0 : undefined
              }}
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
            ? 'Savingâ€¦'
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
          <Typography
            sx={{ fontSize: 11, color: C.muted, mt: 1.5, lineHeight: 1.5 }}
          >
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
            <Box
              sx={{ position: 'absolute', top: px(24), left: px(PAGE_MARGIN) }}
            >
              <Typography
                sx={{
                  fontSize: px(titleStyle.fontSize),
                  fontWeight: titleStyle.fontWeight === 'bold' ? 700 : 400,
                  color: titleStyle.color
                }}
              >
                {formName || 'Untitled form'}
              </Typography>
            </Box>
            {pageCount > 1 && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: px(16),
                  right: px(PAGE_MARGIN)
                }}
              >
                <Typography sx={{ fontSize: px(9), color: '#aaa' }}>
                  Page {page} of {pageCount}
                </Typography>
              </Box>
            )}

            {/* Page bottom boundary â€” dashed line at the printable bottom margin */}
            <Box
              sx={{
                position: 'absolute',
                top: `${px(PAGE_HEIGHT - PAGE_MARGIN)}px`,
                left: 0,
                right: 0,
                borderTop: '1px dashed rgba(220, 80, 80, 0.45)',
                pointerEvents: 'none',
                zIndex: 10
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
                  (row.fields.length - 1) *
                    (rowIsCompact ? COMPACT_COLUMN_GAP : COLUMN_GUTTER) -
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
                            if (field.type === 'table')
                              setShowTableEditor(false)
                          }}
                          sx={{
                            flex: '0 0 auto',
                            width:
                              field.type === 'checkbox'
                                ? 'max-content'
                                : fieldWidth,
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
                border: dropNewRow
                  ? `2px dashed ${C.accent}`
                  : '1px dashed #bbb',
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
                const fieldW =
                  field.width ||
                  (field.type === 'checkbox'
                    ? checkboxNaturalWidth(field)
                    : PAGE_WIDTH - 2 * PAGE_MARGIN)
                return (
                  <Box
                    key={field.id}
                    onMouseDown={e => startFreeDrag(e, field)}
                    onClick={e => {
                      e.stopPropagation()
                      setSelectedId(field.id)
                    }}
                    sx={{
                      position: 'absolute',
                      left: px(field.x),
                      top: px(PAGE_HEIGHT - field.y - fieldH),
                      width:
                        field.type === 'checkbox' ? 'max-content' : px(fieldW),
                      minWidth: px(fieldW),
                      cursor: 'move',
                      outline:
                        selectedId === field.id
                          ? `2px solid ${C.accent}`
                          : '1px dashed rgba(0,0,0,0.2)',
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
              })}
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
          {/* Selected field type badge + label â€” always visible at top of inspector */}
          {selected ? (
            (() => {
              const palItem = PALETTE.find(p => p.type === selected.type)
              return (
                <Box
                  sx={{ mb: 2, pb: 1.5, borderBottom: `1px solid ${C.border}` }}
                >
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1,
                      py: 0.3,
                      borderRadius: '4px',
                      bgcolor: palItem?.tile ?? 'rgba(255,255,255,0.08)',
                      color: palItem?.color ?? C.text,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '1.2px',
                      textTransform: 'uppercase',
                      mb: 0.75
                    }}
                  >
                    {palItem?.glyph} {palItem?.label ?? selected.type}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.text,
                      lineHeight: 1.3
                    }}
                  >
                    {selected.label || '(unnamed field)'}
                  </Typography>
                </Box>
              )
            })()
          ) : (
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
                  onChange={e =>
                    setTitleStyle(s => ({
                      ...s,
                      fontSize: Number(e.target.value) || 16
                    }))
                  }
                  sx={{ flex: 1, ...darkInputSx }}
                  slotProps={{ htmlInput: { min: 8, max: 48, step: 1 } }}
                />
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {(['bold', 'normal'] as const).map(w => (
                    <ButtonBase
                      key={w}
                      onClick={() =>
                        setTitleStyle(s => ({ ...s, fontWeight: w }))
                      }
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '6px',
                        border: `1px solid ${C.border}`,
                        bgcolor:
                          titleStyle.fontWeight === w
                            ? C.accent
                            : 'transparent',
                        color:
                          titleStyle.fontWeight === w ? C.accentText : C.muted,
                        fontWeight: w === 'bold' ? 700 : 400,
                        fontSize: 13
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
                onChange={e =>
                  setTitleStyle(s => ({
                    ...s,
                    spacingBelow: Number(e.target.value) || 0
                  }))
                }
                sx={{ ...darkInputSx }}
                slotProps={{ htmlInput: { min: -200, max: 200, step: 4 } }}
              />
            </Stack>
          ) : selected.type === 'table' && showTableEditor ? (
            <>
              <MockButton
                onClick={() => setShowTableEditor(false)}
                sx={{ mb: 1.5, fontSize: 12, py: 0.6 }}
              >
                â† Back to field
              </MockButton>
              <TableEditor field={selected} updateField={updateField} />
            </>
          ) : (
            <Stack sx={{ gap: 1.75 }}>
              {/* Label / Content â€” rich text for all field types */}
              {selected.type === 'static-text' ? (
                <RichTextEditor
                  label="Content"
                  multiline
                  placeholder="Enter static textâ€¦"
                  html={
                    selected.contentHtml ??
                    (selected.content ? `<p>${selected.content}</p>` : '')
                  }
                  onChange={(html, plain) =>
                    updateField(selected.id, {
                      contentHtml: html,
                      content: plain
                    })
                  }
                />
              ) : selected.type !== 'table' ? (
                <RichTextEditor
                  label="Label"
                  placeholder="Field labelâ€¦"
                  html={
                    selected.labelHtml ??
                    (selected.label
                      ? `<p><strong>${selected.label}</strong></p>`
                      : '')
                  }
                  onChange={(html, plain) =>
                    updateField(selected.id, {
                      labelHtml: html,
                      label: plain || selected.label
                    })
                  }
                />
              ) : (
                <RichTextEditor
                  label="Table title / label"
                  placeholder="Table labelâ€¦"
                  html={
                    selected.labelHtml ??
                    (selected.label
                      ? `<p><strong>${selected.label}</strong></p>`
                      : '')
                  }
                  onChange={(html, plain) =>
                    updateField(selected.id, {
                      labelHtml: html,
                      label: plain || selected.label
                    })
                  }
                />
              )}

              {/* Type indicator for non-fillable */}
              {!FILLABLE_TYPES.includes(selected.type) ? (
                <Typography sx={{ fontSize: 11.5, color: C.muted }}>
                  Type:{' '}
                  <strong style={{ color: C.text }}>{selected.type}</strong>
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
                    {(['text', 'checkbox', 'dropdown', 'radio'] as const).map(
                      type => (
                        <ButtonBase
                          key={type}
                          onClick={() =>
                            updateField(selected.id, {
                              type,
                              height: DEFAULT_HEIGHTS[type],
                              options:
                                type === 'dropdown' || type === 'radio'
                                  ? (selected.options ?? [
                                      'Option 1',
                                      'Option 2'
                                    ])
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
                      )
                    )}
                  </Stack>
                </Box>
              )}

              {/* Free-position toggle â€” all fillable fields */}
              {FILLABLE_TYPES.includes(selected.type) && (
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
                      const active =
                        mode === 'free' ? !selected.row : !!selected.row
                      return (
                        <ButtonBase
                          key={mode}
                          onClick={() => {
                            if (mode === 'free') {
                              setFields(current => {
                                const rest = normalize(
                                  current.filter(f => f.id !== selected.id)
                                )
                                const fieldH =
                                  selected.height ||
                                  DEFAULT_HEIGHTS[selected.type]
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
                                const maxRow = pageRows.length
                                  ? Math.max(...pageRows)
                                  : 0
                                return normalize(
                                  current.map(f =>
                                    f.id === selected.id
                                      ? {
                                          ...f,
                                          row: maxRow + 1,
                                          column: 1,
                                          page
                                        }
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
                    <Typography
                      sx={{
                        fontSize: 11,
                        color: C.muted,
                        mt: 0.5,
                        lineHeight: 1.4
                      }}
                    >
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
                            updateField(selected.id, {
                              labelPosition: position
                            })
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
                    Width â€”{' '}
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
                    value={
                      selected.span && selected.span > 0 ? selected.span : 1
                    }
                    onChange={(_, value) =>
                      updateField(selected.id, { span: value as number })
                    }
                    marks={[
                      { value: 0.1, label: '' },
                      { value: 0.25, label: 'Â¼Ã—' },
                      { value: 0.5, label: 'Â½Ã—' },
                      { value: 1, label: '1Ã—' },
                      { value: 2, label: '2Ã—' },
                      { value: 3, label: '3Ã—' }
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
                      height:
                        Number(e.target.value) || DEFAULT_HEIGHTS[selected.type]
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
                      onChange={e =>
                        updateField(selected.id, {
                          dropdownPlaceholder: e.target.value || undefined
                        })
                      }
                      sx={{ ...darkInputSx, mb: 1 }}
                    />
                  )}
                  {selected.type === 'radio' &&
                    (selected.options ?? []).length > 1 && (
                      <TextField
                        label="Columns"
                        size="small"
                        type="number"
                        value={selected.radioColumns ?? 1}
                        onChange={e =>
                          updateField(selected.id, {
                            radioColumns: Math.max(
                              1,
                              Number(e.target.value) || 1
                            )
                          })
                        }
                        sx={{ ...darkInputSx, mb: 1 }}
                        slotProps={{ htmlInput: { min: 1, max: 6, step: 1 } }}
                      />
                    )}
                  <Typography sx={{ fontSize: 11, color: C.muted, mb: 0.5 }}>
                    Options
                  </Typography>
                  <Stack spacing={0.5}>
                    {(selected.options ?? ['Option 1', 'Option 2']).map(
                      (opt, idx) => {
                        const isRadio = selected.type === 'radio'
                        const style = (selected.optionStyles ?? [])[idx] ?? {}
                        const updateStyle = (patch: Partial<typeof style>) => {
                          setFields(cur =>
                            cur.map(f => {
                              if (f.id !== selected.id) return f
                              const existing = f.optionStyles ?? []
                              const opts = f.options ?? []
                              const next = opts.map((_, i) => ({
                                ...(existing[i] ?? {})
                              }))
                              next[idx] = { ...next[idx], ...patch }
                              return { ...f, optionStyles: next }
                            })
                          )
                        }
                        const isBold = style.fontWeight === 'bold'
                        const isItalic = style.fontStyle === 'italic'
                        return (
                          <Box
                            key={idx}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5
                            }}
                          >
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
                                  onChange={e =>
                                    updateStyle({
                                      fontSize:
                                        Number(e.target.value) || undefined
                                    })
                                  }
                                  slotProps={{
                                    htmlInput: { min: 6, max: 72, step: 1 }
                                  }}
                                  sx={{
                                    ...darkInputSx,
                                    width: 38,
                                    '& input': {
                                      px: '4px',
                                      py: '4px',
                                      textAlign: 'center',
                                      fontSize: 11
                                    }
                                  }}
                                />
                                {(['bold', 'italic'] as const).map(s => {
                                  const active =
                                    s === 'bold' ? isBold : isItalic
                                  return (
                                    <ButtonBase
                                      key={s}
                                      onClick={() =>
                                        updateStyle(
                                          s === 'bold'
                                            ? {
                                                fontWeight: active
                                                  ? 'normal'
                                                  : 'bold'
                                              }
                                            : {
                                                fontStyle: active
                                                  ? 'normal'
                                                  : 'italic'
                                              }
                                        )
                                      }
                                      sx={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: '4px',
                                        border: `1px solid ${C.border}`,
                                        bgcolor: active
                                          ? C.accent
                                          : 'transparent',
                                        color: active ? C.accentText : C.muted,
                                        fontWeight: s === 'bold' ? 700 : 400,
                                        fontStyle:
                                          s === 'italic' ? 'italic' : 'normal',
                                        fontSize: 12,
                                        flexShrink: 0
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
                                      width: 24,
                                      height: 24,
                                      borderRadius: '4px',
                                      border: `1px solid ${C.border}`,
                                      bgcolor: style.textColor ?? '#1a1a1a',
                                      cursor: 'pointer',
                                      flexShrink: 0,
                                      position: 'relative',
                                      overflow: 'hidden'
                                    }}
                                  >
                                    <input
                                      type="color"
                                      value={style.textColor ?? '#1a1a1a'}
                                      onChange={e =>
                                        updateStyle({
                                          textColor: e.target.value
                                        })
                                      }
                                      style={{
                                        position: 'absolute',
                                        inset: 0,
                                        opacity: 0,
                                        width: '100%',
                                        height: '100%',
                                        cursor: 'pointer',
                                        border: 'none',
                                        padding: 0
                                      }}
                                    />
                                  </Box>
                                </Tooltip>
                              </>
                            )}
                            <Tooltip title="Remove">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const nextOpts = (
                                    selected.options ?? []
                                  ).filter((_, i) => i !== idx)
                                  const nextStyles = (
                                    selected.optionStyles ?? []
                                  ).filter((_, i) => i !== idx)
                                  updateField(selected.id, {
                                    options: nextOpts.length ? nextOpts : [''],
                                    optionStyles: nextStyles
                                  })
                                }}
                                sx={{
                                  color: C.muted,
                                  '&:hover': { color: '#e57373' },
                                  p: '2px',
                                  flexShrink: 0
                                }}
                              >
                                <DeleteOutlinedIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )
                      }
                    )}
                  </Stack>
                  <ButtonBase
                    onClick={() =>
                      updateField(selected.id, {
                        options: [...(selected.options ?? []), ''],
                        optionStyles: [...(selected.optionStyles ?? []), {}]
                      })
                    }
                    sx={{
                      mt: 0.75,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: 11,
                      color: C.accent,
                      px: 0.5,
                      py: 0.25,
                      borderRadius: '4px',
                      '&:hover': { bgcolor: 'rgba(108,158,255,0.1)' }
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
                        updateField(selected.id, {
                          fontSize: Number(e.target.value) || 12
                        })
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
                              updateField(
                                selected.id,
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
                              fontStyle:
                                style === 'italic' ? 'italic' : 'normal',
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
                            onClick={() =>
                              updateField(selected.id, { textAlign: align })
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
                      onChange={e =>
                        updateField(selected.id, {
                          paddingTop: Math.max(0, Number(e.target.value))
                        })
                      }
                      sx={{ flex: 1, ...darkInputSx }}
                    />
                    <TextField
                      label="Padding bottom (pt)"
                      size="small"
                      type="number"
                      value={selected.paddingBottom ?? 4}
                      onChange={e =>
                        updateField(selected.id, {
                          paddingBottom: Math.max(0, Number(e.target.value))
                        })
                      }
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
                      onChange={e =>
                        updateField(selected.id, {
                          borderWidth: Number(e.target.value)
                        })
                      }
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                    />
                    <TextField
                      label="Radius (pt)"
                      size="small"
                      type="number"
                      value={selected.borderRadius ?? 0}
                      onChange={e =>
                        updateField(selected.id, {
                          borderRadius: Number(e.target.value)
                        })
                      }
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                  </Stack>
                  <Typography sx={{ fontSize: 10, color: C.muted, mb: 0.5 }}>
                    {`Per-corner radius (overrides "Radius")`}
                  </Typography>
                  <Stack direction="row" sx={{ gap: 1 }}>
                    <TextField
                      label="Top Left"
                      size="small"
                      type="number"
                      placeholder={String(selected.borderRadius ?? 0)}
                      value={selected.borderTopLeftRadius ?? ''}
                      onChange={e =>
                        updateField(selected.id, {
                          borderTopLeftRadius:
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value)
                        })
                      }
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                    <TextField
                      label="Top Right"
                      size="small"
                      type="number"
                      placeholder={String(selected.borderRadius ?? 0)}
                      value={selected.borderTopRightRadius ?? ''}
                      onChange={e =>
                        updateField(selected.id, {
                          borderTopRightRadius:
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value)
                        })
                      }
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
                      onChange={e =>
                        updateField(selected.id, {
                          borderBottomLeftRadius:
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value)
                        })
                      }
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                    <TextField
                      label="Bottom Right"
                      size="small"
                      type="number"
                      placeholder={String(selected.borderRadius ?? 0)}
                      value={selected.borderBottomRightRadius ?? ''}
                      onChange={e =>
                        updateField(selected.id, {
                          borderBottomRightRadius:
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value)
                        })
                      }
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
                        updateField(selected.id, {
                          imageData: ev.target?.result as string
                        })
                      }
                      reader.readAsDataURL(file)
                    }}
                  />
                  <MockButton onClick={() => imageInputRef.current?.click()}>
                    {selected.imageData
                      ? 'Replace image'
                      : 'Upload image (PNG / JPEG)'}
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
                                // Remove from grid â€” use last known or default coordinates
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
                                      width:
                                        selected.width ||
                                        PAGE_WIDTH - 2 * PAGE_MARGIN,
                                      height:
                                        selected.height || DEFAULT_IMAGE_HEIGHT,
                                      page
                                    }
                                  ]
                                })
                              } else {
                                // Put back into a new grid row
                                setFields(current => {
                                  const pageRows = current
                                    .filter(
                                      f => (f.page || 1) === page && f.row
                                    )
                                    .map(f => f.row!)
                                  const maxRow = pageRows.length
                                    ? Math.max(...pageRows)
                                    : 0
                                  return normalize(
                                    current.map(f =>
                                      f.id === selected.id
                                        ? {
                                            ...f,
                                            row: maxRow + 1,
                                            column: 1,
                                            page
                                          }
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
                      <Typography
                        sx={{
                          fontSize: 11,
                          color: C.muted,
                          mt: 0.5,
                          lineHeight: 1.4
                        }}
                      >
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
                        const active =
                          (selected.imageObjectFit ?? 'contain') === fit
                        return (
                          <ButtonBase
                            key={fit}
                            onClick={() =>
                              updateField(selected.id, { imageObjectFit: fit })
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
                      updateField(selected.id, {
                        height: Number(e.target.value) || 1
                      })
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
                      {(['above', 'none'] as const).map(pos => (
                        <ButtonBase
                          key={pos}
                          onClick={() =>
                            updateField(selected.id, {
                              tableLabelPosition: pos
                            })
                          }
                          sx={{
                            flex: 1,
                            fontSize: 12,
                            py: 0.8,
                            fontWeight:
                              (selected.tableLabelPosition ?? 'none') === pos
                                ? 700
                                : 400,
                            bgcolor:
                              (selected.tableLabelPosition ?? 'none') === pos
                                ? C.accent
                                : 'transparent',
                            color:
                              (selected.tableLabelPosition ?? 'none') === pos
                                ? C.accentText
                                : C.muted
                          }}
                        >
                          {pos === 'above' ? 'Above table' : 'Hidden'}
                        </ButtonBase>
                      ))}
                    </Stack>
                  </Box>
                  {/* Title bar styling â€” only when visible */}
                  {selected.tableLabelPosition === 'above' &&
                    (() => {
                      const cfg = selected.tableConfig ?? defaultTableConfig()
                      const patchCfg = (patch: Partial<TableConfig>) =>
                        updateField(selected.id, {
                          tableConfig: { ...cfg, ...patch }
                        })
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
                            onChange={e =>
                              patchCfg({
                                titleFontSize: Number(e.target.value) || 11
                              })
                            }
                            sx={{ ...darkInputSx }}
                            slotProps={{
                              htmlInput: { min: 6, max: 24, step: 1 }
                            }}
                          />
                        </Stack>
                      )
                    })()}
                  <MockButton
                    onClick={() => setShowTableEditor(true)}
                    sx={{ width: '100%', justifyContent: 'center' }}
                  >
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
                    onChange={e =>
                      updateField(selected.id, {
                        fontSize: Number(e.target.value) || 10
                      })
                    }
                    sx={{ flex: 1, ...darkInputSx }}
                    slotProps={{ htmlInput: { min: 6, max: 48, step: 1 } }}
                  />
                  <Stack direction="row" sx={{ gap: 0.5 }}>
                    {(['bold', 'italic'] as const).map(s => {
                      const isWeight = s === 'bold'
                      const active = isWeight
                        ? selected.fontWeight === 'bold'
                        : selected.fontStyle === 'italic'
                      return (
                        <ButtonBase
                          key={s}
                          onClick={() =>
                            updateField(
                              selected.id,
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

              {/* Border controls â€” shown for fillable fields */}
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
                      onChange={e =>
                        updateField(selected.id, {
                          borderWidth: Number(e.target.value)
                        })
                      }
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                    />
                    <TextField
                      label="Radius (pt)"
                      size="small"
                      type="number"
                      value={selected.borderRadius ?? 2}
                      onChange={e =>
                        updateField(selected.id, {
                          borderRadius: Number(e.target.value)
                        })
                      }
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                  </Stack>
                  {/* Per-corner radius overrides */}
                  <Typography sx={{ fontSize: 10, color: C.muted, mb: 0.5 }}>
                    {`Per-corner radius (overrides "Radius")`}
                  </Typography>
                  <Stack direction="row" sx={{ gap: 1 }}>
                    <TextField
                      label="Top Left"
                      size="small"
                      type="number"
                      placeholder={String(selected.borderRadius ?? 0)}
                      value={selected.borderTopLeftRadius ?? ''}
                      onChange={e =>
                        updateField(selected.id, {
                          borderTopLeftRadius:
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value)
                        })
                      }
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                    <TextField
                      label="Top Right"
                      size="small"
                      type="number"
                      placeholder={String(selected.borderRadius ?? 0)}
                      value={selected.borderTopRightRadius ?? ''}
                      onChange={e =>
                        updateField(selected.id, {
                          borderTopRightRadius:
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value)
                        })
                      }
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
                      onChange={e =>
                        updateField(selected.id, {
                          borderBottomLeftRadius:
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value)
                        })
                      }
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                    <TextField
                      label="Bottom Right"
                      size="small"
                      type="number"
                      placeholder={String(selected.borderRadius ?? 0)}
                      value={selected.borderBottomRightRadius ?? ''}
                      onChange={e =>
                        updateField(selected.id, {
                          borderBottomRightRadius:
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value)
                        })
                      }
                      sx={{ flex: 1, ...darkInputSx }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                  </Stack>
                </>
              )}
              <ColorPicker
                label="Row background (full width)"
                value={
                  getRowFirst(selected.row ?? 0)?.rowBackgroundColor ??
                  '#ffffff'
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
                            ? {
                                ...f,
                                page: targetPage,
                                row: nextRow,
                                column: 1
                              }
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
            All fields on Page {deleteConfirmPage} will be permanently removed.
            This cannot be undone.
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
            onClick={() =>
              deleteConfirmPage !== null && deletePage(deleteConfirmPage)
            }
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
