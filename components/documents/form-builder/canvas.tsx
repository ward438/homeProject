/* eslint-disable @next/next/no-img-element */
'use client'

import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import type { FormField, FormFieldType } from '@/lib/documents/types'
import type { FormBuilderPaletteItem } from '@/lib/types/form-builder'

import {
  CHECKBOX_LABEL_GAP,
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_STATIC_TEXT_HEIGHT,
  DRAG_MIME,
  LABEL_SPACE,
  px
} from './field-factory'
import { TablePreview } from './table-editor'
import { C } from './theme'

// ---- Palette item sub-component ---------------------------------------------

type PaletteItemProps = {
  item: FormBuilderPaletteItem
  onAdd: (type: FormFieldType, patch?: Partial<FormField>) => void
}

export function PaletteItem({ item, onAdd }: PaletteItemProps) {
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

// ---- Field canvas renderer --------------------------------------------------

type FieldCanvasProps = {
  field: FormField
  rowLabelSpace: number
  rowHeight: number
}

export function FieldCanvas({
  field,
  rowLabelSpace,
  rowHeight
}: FieldCanvasProps) {
  if (field.type === 'static-text') {
    const bw = field.borderWidth ?? 0
    const bc = field.borderColor ?? '#cccccc'
    const br = field.borderRadius ?? 0
    const btw = field.borderTopWidth ?? bw
    const brw = field.borderRightWidth ?? bw
    const bbw = field.borderBottomWidth ?? bw
    const blw = field.borderLeftWidth ?? bw
    const rTL = field.borderTopLeftRadius ?? br
    const rTR = field.borderTopRightRadius ?? br
    const rBR = field.borderBottomRightRadius ?? br
    const rBL = field.borderBottomLeftRadius ?? br
    const radiusCss = `${px(rTL)}px ${px(rTR)}px ${px(rBR)}px ${px(rBL)}px`
    const size = field.fontSize ?? 12
    const lineH = size * 1.4
    return (
      <Box
        sx={{
          borderTop: btw > 0 ? `${btw}px solid ${bc}` : 'none',
          borderRight: brw > 0 ? `${brw}px solid ${bc}` : 'none',
          borderBottom: bbw > 0 ? `${bbw}px solid ${bc}` : 'none',
          borderLeft: blw > 0 ? `${blw}px solid ${bc}` : 'none',
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
            '& p': { margin: 0, minHeight: `${px(lineH)}px` },
            '& p + p': { marginTop: 0 },
            '& strong': { fontWeight: 700 },
            '& em': { fontStyle: 'italic' },
            '& u': { textDecoration: 'underline' }
          }}
          dangerouslySetInnerHTML={{
            __html:
              field.contentHtml ??
              field.content ??
              '<em style="color:#aaa">Static text</em>'
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
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          height: '100%'
        }}
      >
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
            '& p': { margin: 0 },
            '& strong': { fontWeight: 700 },
            '& em': { fontStyle: 'italic' },
            '& u': { textDecoration: 'underline' }
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
        <Typography
          sx={{
            fontSize: px(s.fontSize ?? 10),
            fontWeight: s.fontWeight ?? 'normal',
            fontStyle: s.fontStyle ?? 'normal',
            color: s.textColor ?? '#333',
            whiteSpace: 'nowrap'
          }}
        >
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
            '& p': { margin: 0 },
            '& strong': { fontWeight: 700 },
            '& em': { fontStyle: 'italic' },
            '& u': { textDecoration: 'underline' }
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
  const btw = field.borderTopWidth ?? bw
  const brw = field.borderRightWidth ?? bw
  const bbw = field.borderBottomWidth ?? bw
  const blw = field.borderLeftWidth ?? bw
  const rTL = field.borderTopLeftRadius ?? br
  const rTR = field.borderTopRightRadius ?? br
  const rBR = field.borderBottomRightRadius ?? br
  const rBL = field.borderBottomLeftRadius ?? br
  const radiusCss = `${px(rTL)}px ${px(rTR)}px ${px(rBR)}px ${px(rBL)}px`
  const midW = Math.max(btw, bbw, 0.5)
  const align = (() => {
    if (!field.labelHtml) return 'flex-start'
    const m = field.labelHtml.match(
      /<p[^>]*style="[^"]*text-align:\s*(left|center|right)/i
    )
    const a = m?.[1]?.toLowerCase()
    return a === 'center' ? 'center' : a === 'right' ? 'flex-end' : 'flex-start'
  })()
  const labelHasBold =
    !field.labelHtml || /<strong|<b[ >]/i.test(field.labelHtml)
  const labelHasItalic = /<em|<i[ >]/i.test(field.labelHtml ?? '')
  const labelHasUnderline = /<u[ >]/i.test(field.labelHtml ?? '')
  return (
    <Box
      sx={{
        borderTop: `${btw}px solid ${bc}`,
        borderRight: `${brw}px solid ${bc}`,
        borderBottom: `${bbw}px solid ${bc}`,
        borderLeft: `${blw}px solid ${bc}`,
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
        {field.type === 'dropdown' &&
          (() => {
            const hasPlaceholder = !!field.dropdownPlaceholder
            const displayText =
              field.dropdownPlaceholder || (field.options ?? [])[0] || 'Select…'
            const optStyle = hasPlaceholder
              ? null
              : (field.optionStyles?.[0] ?? null)
            return (
              <>
                <Typography
                  sx={{
                    fontSize: px(optStyle?.fontSize ?? field.fontSize ?? 10),
                    fontWeight: optStyle?.fontWeight ?? 'normal',
                    fontStyle: optStyle?.fontStyle ?? 'normal',
                    color: hasPlaceholder
                      ? '#aaa'
                      : (optStyle?.textColor ?? '#555'),
                    flex: 1,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {displayText}
                </Typography>
                <Typography
                  sx={{
                    fontSize: px(9),
                    color: '#777',
                    ml: 0.5,
                    flexShrink: 0
                  }}
                >
                  ▾
                </Typography>
              </>
            )
          })()}
        {field.type === 'radio' &&
          (() => {
            const opts = field.options ?? []
            const cols = Math.max(1, field.radioColumns ?? 1)
            const isSingle = opts.length <= 1
            if (isSingle) return null
            return (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  width: '100%',
                  gap: `${px(2)}px 0`
                }}
              >
                {opts.map((opt, i) => {
                  const s = (field.optionStyles ?? [])[i] ?? {}
                  return (
                    <Box
                      key={i}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: `${px(3)}px`
                      }}
                    >
                      <Box
                        sx={{
                          width: px(7),
                          height: px(7),
                          borderRadius: '50%',
                          border: `${px(1)}px solid #999`,
                          bgcolor: '#fff',
                          flexShrink: 0
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: px(s.fontSize ?? field.fontSize ?? 10),
                          fontWeight: s.fontWeight ?? 'normal',
                          fontStyle: s.fontStyle ?? 'normal',
                          color: s.textColor ?? '#1a1a1a',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis'
                        }}
                      >
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
