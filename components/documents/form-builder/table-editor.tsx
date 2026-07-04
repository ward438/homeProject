'use client'

import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import type { FormField, TableConfig, TableRow } from '@/lib/documents/types'

import { ColorPicker } from '@/components/documents/color-picker'
import { RichTextEditor } from '@/components/documents/rich-text-editor'

import {
  DEFAULT_CELL_PADDING,
  DEFAULT_TABLE_HEADER_HEIGHT,
  DEFAULT_TABLE_ROW_HEIGHT,
  px,
  TABLE_TITLE_HEIGHT
} from './field-factory'
import { defaultTableConfig } from './field-factory'
import {
  C,
  darkInputSx,
  MockButton,
  PanelHeading,
  SectionDivider
} from './theme'

// ---- Table canvas preview ---------------------------------------------------

export function TablePreview({ field }: { field: FormField }) {
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
    <Box
      sx={{
        width: '100%',
        overflow: 'hidden',
        border: `0.75px solid ${borderColor}`,
        boxSizing: 'border-box'
      }}
    >
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
            const bg =
              row.bgColor ??
              (isAlt && cfg.altRowBg ? cfg.altRowBg : (cfg.rowBg ?? '#ffffff'))
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
                        borderBottom: isLastRow
                          ? 'none'
                          : `0.3px solid ${borderColor}`,
                        boxSizing: 'border-box',
                        verticalAlign: 'middle',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {cell?.isField || cfg.allowUserInput ? (
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

// ---- Table editor sub-panel -------------------------------------------------

type TableEditorProps = {
  field: FormField
  updateField: (id: string, patch: Partial<FormField>) => void
}

export function TableEditor({ field, updateField }: TableEditorProps) {
  const cfg = field.tableConfig ?? defaultTableConfig()

  const patchCfg = (patch: Partial<TableConfig>) => {
    updateField(field.id, { tableConfig: { ...cfg, ...patch } })
  }

  const addColumn = () => {
    const key = `col${Date.now()}`
    const columns = [
      ...cfg.columns,
      { key, label: 'New Column', widthWeight: 1 }
    ]
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

  const updateColumn = (
    key: string,
    patch: Partial<TableConfig['columns'][0]>
  ) => {
    patchCfg({
      columns: cfg.columns.map(c => (c.key === key ? { ...c, ...patch } : c))
    })
  }

  const addRow = () => {
    const newRow: TableRow = {
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
          ? {
              ...r,
              cells: { ...r.cells, [colKey]: { ...r.cells[colKey], ...patch } }
            }
          : r
      )
    })
  }

  const updateRow = (rowId: string, patch: Partial<TableRow>) => {
    patchCfg({
      rows: cfg.rows.map(r => (r.id === rowId ? { ...r, ...patch } : r))
    })
  }

  return (
    <Stack sx={{ gap: 1.5 }}>
      <PanelHeading>Table columns</PanelHeading>
      {cfg.columns.map(col => (
        <Box
          key={col.key}
          sx={{ border: `1px solid ${C.border}`, borderRadius: '6px', p: 1 }}
        >
          <Stack
            direction="row"
            sx={{ gap: 0.75, alignItems: 'center', mb: 0.75 }}
          >
            <Typography sx={{ fontSize: 11, color: C.muted, flex: 1 }}>
              Width weight:
            </Typography>
            <TextField
              size="small"
              type="number"
              value={col.widthWeight ?? 1}
              onChange={e =>
                updateColumn(col.key, {
                  widthWeight: Number(e.target.value) || 1
                })
              }
              sx={{ width: 52, ...darkInputSx }}
              slotProps={{
                htmlInput: {
                  min: 0.1,
                  step: 0.1,
                  style: { textAlign: 'center' }
                }
              }}
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
            html={
              col.labelHtml ??
              (col.label ? `<p><strong>${col.label}</strong></p>` : '')
            }
            onChange={(html, plain) =>
              updateColumn(col.key, {
                labelHtml: html,
                label: plain || col.label
              })
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
        <Box
          key={row.id}
          sx={{ border: `1px solid ${C.border}`, borderRadius: '6px', p: 1 }}
        >
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              mb: 0.75,
              justifyContent: 'space-between'
            }}
          >
            <Typography sx={{ fontSize: 11, color: C.muted }}>
              Row {rowIdx + 1}
            </Typography>
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
              <Stack
                key={col.key}
                direction="row"
                sx={{ gap: 0.5, mb: 0.5, alignItems: 'center' }}
              >
                <Typography
                  sx={{
                    fontSize: 10,
                    color: C.muted,
                    width: 55,
                    flexShrink: 0
                  }}
                  noWrap
                >
                  {col.label}
                </Typography>
                <TextField
                  size="small"
                  value={cell.value}
                  onChange={e =>
                    updateCell(row.id, col.key, { value: e.target.value })
                  }
                  sx={{ flex: 1, ...darkInputSx }}
                  slotProps={{
                    htmlInput: { style: { fontSize: 11, padding: '3px 6px' } }
                  }}
                />
                <Tooltip
                  title={
                    cell.isField
                      ? 'Fillable (click to toggle)'
                      : 'Static (click to toggle)'
                  }
                >
                  <ButtonBase
                    onClick={() =>
                      updateCell(row.id, col.key, { isField: !cell.isField })
                    }
                    sx={{
                      fontSize: 10,
                      px: 0.75,
                      py: 0.4,
                      borderRadius: '4px',
                      border: `1px solid ${C.border}`,
                      bgcolor: cell.isField
                        ? 'rgba(108,158,255,0.2)'
                        : 'transparent',
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

      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography sx={{ fontSize: 12, color: C.text }}>
          Allow row input
        </Typography>
        <Switch
          size="small"
          checked={cfg.allowUserInput ?? false}
          onChange={e => patchCfg({ allowUserInput: e.target.checked })}
          sx={{
            '& .MuiSwitch-thumb': {
              bgcolor: cfg.allowUserInput ? C.accent : C.muted
            },
            '& .MuiSwitch-track': {
              bgcolor: cfg.allowUserInput ? `${C.accent}55` : `${C.border}`
            }
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
