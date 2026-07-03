import { PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib'

import {
  applyAutoLayout,
  CONTENT_TOP,
  DEFAULT_CELL_PADDING,
  DEFAULT_DIVIDER_HEIGHT,
  DEFAULT_TABLE_HEADER_HEIGHT,
  DEFAULT_TABLE_ROW_HEIGHT,
  TABLE_TITLE_HEIGHT,
  LABEL_SPACE,
  PAGE_HEIGHT,
  PAGE_MARGIN,
  PAGE_WIDTH,
  tableBlockHeight
} from './form-layout'
import type { PositionedField } from './form-layout'
import type { FormField, TableConfig } from './types'

// ---- helpers ----------------------------------------------------------------

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Handle rgb(r, g, b) format from Tiptap
  if (hex.trim().startsWith('rgb')) {
    const m = hex.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
    if (m) return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255 }
  }
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map(c => c + c)
          .join('')
      : clean
  const n = parseInt(full, 16)
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255
  }
}

function safeColor(hex: string | undefined, fallback = '#000000') {
  try {
    if (!hex) return hexToRgb(fallback)
    return hexToRgb(hex)
  } catch {
    return hexToRgb(fallback)
  }
}

/** Split text into lines that fit within maxWidth, respecting explicit newlines. */
export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const charsPerLine = Math.max(1, Math.floor(maxWidth / (fontSize * 0.55)))
  const result: string[] = []
  for (const paragraph of text.split('\n')) {
    if (!paragraph.trim()) { result.push(''); continue }
    const words = paragraph.split(' ')
    let current = ''
    for (const word of words) {
      const test = current ? `${current} ${word}` : word
      if (test.length > charsPerLine && current) {
        result.push(current)
        current = word
      } else {
        current = test
      }
    }
    if (current) result.push(current)
  }
  return result
}

// ---- HTML run parser for rich static-text --------------------------------------

type TextRun = {
  text: string
  bold?: boolean
  italic?: boolean
  color?: string
  fontSize?: number
  newline?: boolean
  align?: 'left' | 'center' | 'right'
}

/**
 * Strip HTML tags to plain text for PDF rendering.
 * Preserves line breaks from </p> and <br>.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Extract text-align from a labelHtml string (first paragraph). */
function labelAlign(html?: string): 'left' | 'center' | 'right' {
  if (!html) return 'left'
  const m = html.match(/<p[^>]*style="[^"]*text-align:\s*(left|center|right)/i)
  return (m?.[1]?.toLowerCase() ?? 'left') as 'left' | 'center' | 'right'
}

/**
 * Build an SVG path string for a rounded rectangle (SVG coord space, y-down).
 * Supports per-corner radii: TL, TR, BR, BL. Uniform `r` used as fallback.
 * Used with page.drawSvgPath where y: bottom+height (pdf-lib flips y).
 */
function roundedRectPath(w: number, h: number, r: number, tl?: number, tr?: number, br?: number, bl?: number): string {
  const cTL = Math.min(tl ?? r, w / 2, h / 2)
  const cTR = Math.min(tr ?? r, w / 2, h / 2)
  const cBR = Math.min(br ?? r, w / 2, h / 2)
  const cBL = Math.min(bl ?? r, w / 2, h / 2)
  if (cTL <= 0 && cTR <= 0 && cBR <= 0 && cBL <= 0) return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`
  return [
    `M ${cTL} 0`,
    `L ${w - cTR} 0`, `Q ${w} 0 ${w} ${cTR}`,
    `L ${w} ${h - cBR}`, `Q ${w} ${h} ${w - cBR} ${h}`,
    `L ${cBL} ${h}`, `Q 0 ${h} 0 ${h - cBL}`,
    `L 0 ${cTL}`, `Q 0 0 ${cTL} 0`, `Z`
  ].join(' ')
}

/** Compute drawX for a label given its alignment, container x/width, text width, and pad. */
function labelX(
  align: 'left' | 'center' | 'right',
  fieldX: number,
  fieldWidth: number,
  textWidth: number,
  pad = 3
): number {
  if (align === 'center') return fieldX + (fieldWidth - textWidth) / 2
  if (align === 'right') return fieldX + fieldWidth - pad - textWidth
  return fieldX + pad
}

/** Convert Tiptap HTML to flat styled runs for advanced use (server-side, no DOM). */
function parseHtmlRuns(html: string): TextRun[] {
  const runs: TextRun[] = []
  // Split on <p> tags to capture per-paragraph alignment
  const paragraphs = html.split(/<\/p>/gi).filter(Boolean)

  for (const para of paragraphs) {
    // Extract alignment from <p style="text-align: ...">
    const alignMatch = para.match(/<p[^>]*style="[^"]*text-align:\s*(left|center|right)/i)
    const align: TextRun['align'] = alignMatch
      ? (alignMatch[1].toLowerCase() as TextRun['align'])
      : 'left'

    // Strip the opening <p ...> tag
    const inner = para.replace(/<p[^>]*>/gi, '')

    // Replace <br> with newline markers
    const normalized = inner.replace(/<br\s*\/?>/gi, '___NL___')
    const parts = normalized.split(/(<[^>]+>)/g)
    let bold = false, italic = false, color: string | undefined, fontSize: number | undefined
    let isFirstInPara = true

    for (const part of parts) {
      if (!part) continue
      if (part.startsWith('<')) {
        const tag = part.toLowerCase()
        if (tag.startsWith('<strong') || tag.startsWith('<b')) bold = true
        else if (tag === '</strong>' || tag === '</b>') bold = false
        else if (tag.startsWith('<em') || tag.startsWith('<i')) italic = true
        else if (tag === '</em>' || tag === '</i>') italic = false
        else if (tag.startsWith('<span')) {
          const colorMatch = part.match(/color:\s*([^;"']+)/i)
          if (colorMatch) color = colorMatch[1].trim()
          const sizeMatch = part.match(/font-size:\s*([0-9.]+)px/i)
          if (sizeMatch) fontSize = parseFloat(sizeMatch[1])
        } else if (tag === '</span>') { color = undefined; fontSize = undefined }
      } else {
        const pieces = part.split('___NL___')
        pieces.forEach((piece, i) => {
          const text = piece
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
          if (text) {
            runs.push({ text, bold, italic, color, fontSize, align: isFirstInPara ? align : undefined, newline: i < pieces.length - 1 })
            isFirstInPara = false
          } else if (i < pieces.length - 1) {
            runs.push({ text: '', newline: true })
          }
        })
      }
    }
    // Paragraph break between paragraphs
    runs.push({ text: '', newline: true, align })
  }
  return runs.filter(r => r.text || r.newline)
}

// ---- row-level background pass -----------------------------------------------

function drawRowBackgrounds(
  page: PDFPage,
  fields: PositionedField[]
): void {
  // Group fields by row; draw rowBackgroundColor from first-column field.
  const byRow = new Map<number, PositionedField[]>()
  for (const f of fields) {
    if (!f.row) continue
    const list = byRow.get(f.row) ?? []
    list.push(f)
    byRow.set(f.row, list)
  }
  for (const rowFields of byRow.values()) {
    const first = rowFields.sort((a, b) => (a.column ?? 0) - (b.column ?? 0))[0]
    if (!first.rowBackgroundColor) continue
    const minY = Math.min(...rowFields.map(f => f.y)) - 4
    const maxY = Math.max(...rowFields.map(f => f.y + (f.height || 24))) + 4
    const { r, g, b } = hexToRgb(first.rowBackgroundColor)
    page.drawRectangle({
      x: PAGE_MARGIN - 4,
      y: minY,
      width: PAGE_WIDTH - 2 * PAGE_MARGIN + 8,
      height: maxY - minY,
      color: rgb(r, g, b)
    })
  }
}

// ---- table drawing -----------------------------------------------------------

function drawTable(
  page: PDFPage,
  field: PositionedField,
  cfg: TableConfig,
  form: ReturnType<PDFDocument['getForm']>,
  regularFont: Awaited<ReturnType<PDFDocument['embedFont']>>,
  boldFont: Awaited<ReturnType<PDFDocument['embedFont']>>
): void {
  const cellPad = cfg.cellPadding ?? DEFAULT_CELL_PADDING
  const rowH = cfg.rowHeight ?? DEFAULT_TABLE_ROW_HEIGHT
  const headerH = DEFAULT_TABLE_HEADER_HEIGHT
  const borderC = safeColor(cfg.borderColor, '#cccccc')
  const borderRgb = rgb(borderC.r, borderC.g, borderC.b)
  const { columns, rows } = cfg

  // Compute column widths proportionally
  const totalWeight = columns.reduce(
    (sum, col) => sum + (col.widthWeight ?? 1),
    0
  )
  const colWidths = columns.map(
    col => (field.width * (col.widthWeight ?? 1)) / totalWeight
  )

  let curY = field.y + tableBlockHeight(cfg, field.tableLabelPosition === 'above') // top of table in PDF coords

  // Optional title bar above the column headers
  if (field.tableLabelPosition === 'above' && field.label) {
    const titleBg = safeColor(cfg.titleBg ?? cfg.headerBg, '#2c3a57')
    const titleTxt = safeColor(cfg.titleTextColor ?? cfg.headerTextColor, '#ffffff')
    const titleSize = cfg.titleFontSize ?? 11
    page.drawRectangle({
      x: field.x,
      y: curY - TABLE_TITLE_HEIGHT,
      width: field.width,
      height: TABLE_TITLE_HEIGHT,
      color: rgb(titleBg.r, titleBg.g, titleBg.b)
    })
    const align = labelAlign(field.labelHtml)
    const tw = boldFont.widthOfTextAtSize(field.label, titleSize)
    const tx = labelX(align, field.x, field.width, tw, 6)
    page.drawText(field.label, {
      x: tx,
      y: curY - TABLE_TITLE_HEIGHT + (TABLE_TITLE_HEIGHT - titleSize) / 2,
      size: titleSize,
      font: boldFont,
      color: rgb(titleTxt.r, titleTxt.g, titleTxt.b)
    })
    curY -= TABLE_TITLE_HEIGHT
  }

  // Header row
  const headerBg = safeColor(cfg.headerBg, '#444444')
  const headerTxt = safeColor(cfg.headerTextColor, '#ffffff')
  let cx = field.x
  columns.forEach((col, ci) => {
    const cw = colWidths[ci]
    const colBg = col.bgColor ? safeColor(col.bgColor) : headerBg
    const colTxt = col.textColor ? safeColor(col.textColor) : headerTxt
    page.drawRectangle({
      x: cx,
      y: curY - headerH,
      width: cw,
      height: headerH,
      color: rgb(colBg.r, colBg.g, colBg.b)
    })
    // Resolve alignment and text from labelHtml if available
    const hAlign = labelAlign(col.labelHtml)
    const hText = col.label
    const hw = boldFont.widthOfTextAtSize(hText, 9)
    const hx = labelX(hAlign, cx, cw, hw, cellPad)
    page.drawText(hText, {
      x: hx,
      y: curY - headerH + cellPad,
      size: 9,
      font: boldFont,
      color: rgb(colTxt.r, colTxt.g, colTxt.b),
      maxWidth: cw - cellPad * 2
    })
    cx += cw
  })
  // line under header
  page.drawLine({
    start: { x: field.x, y: curY - headerH },
    end: { x: field.x + field.width, y: curY - headerH },
    thickness: 0.75,
    color: borderRgb
  })
  curY -= headerH

  const dataTop = curY // remember top of data area for outer border

  // Data rows
  rows.forEach((row, rowIdx) => {
    const isAlt = rowIdx % 2 === 1
    const activeBg = row.bgColor
      ? safeColor(row.bgColor)
      : isAlt && cfg.altRowBg
        ? safeColor(cfg.altRowBg)
        : cfg.rowBg ? safeColor(cfg.rowBg) : null
    const activeTxt = row.textColor
      ? safeColor(row.textColor)
      : safeColor('#1a1a1a')
    const rowBottom = curY - rowH
    cx = field.x

    columns.forEach((col, ci) => {
      const cw = colWidths[ci]
      if (activeBg) {
        page.drawRectangle({
          x: cx,
          y: rowBottom,
          width: cw,
          height: rowH,
          color: rgb(activeBg.r, activeBg.g, activeBg.b)
        })
      }
      const cell = row.cells[col.key]
      if (cell) {
        if (cell.isField || cfg.allowUserInput) {
          const cellField = form.createTextField(
            `tbl_${field.id.slice(0, 4)}_r${rowIdx}_${col.key}`
          )
          cellField.setText(cell.value || '')
          cellField.addToPage(page, {
            x: cx + cellPad,
            y: rowBottom + cellPad,
            width: cw - cellPad * 2,
            height: rowH - cellPad * 2,
            borderWidth: 0
          })
        } else {
          page.drawText(cell.value || '', {
            x: cx + cellPad,
            y: rowBottom + cellPad,
            size: 9,
            font: regularFont,
            color: rgb(activeTxt.r, activeTxt.g, activeTxt.b),
            maxWidth: cw - cellPad * 2
          })
        }
      }
      cx += cw
    })

    // light horizontal separator between rows (not after the last row)
    if (rowIdx < rows.length - 1) {
      page.drawLine({
        start: { x: field.x, y: rowBottom },
        end: { x: field.x + field.width, y: rowBottom },
        thickness: 0.3,
        color: borderRgb
      })
    }

    curY = rowBottom
  })

  // Outer border rectangle around the whole table
  const tableTop = field.y + tableBlockHeight(cfg, field.tableLabelPosition === 'above')
  page.drawRectangle({
    x: field.x,
    y: curY,
    width: field.width,
    height: tableTop - curY,
    borderColor: borderRgb,
    borderWidth: 0.75,
    color: rgb(1, 1, 1),
    opacity: 0
  })
}

// ---- main export function ---------------------------------------------------

export async function exportFormPdf(
  name: string,
  rawFields: FormField[],
  titleStyle?: { fontSize?: number; fontWeight?: 'bold' | 'normal'; color?: string; spacingBelow?: number }
): Promise<Buffer> {
  // Embed fonts first so we can measure static-text heights before layout
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(name)
  const form = pdfDoc.getForm()
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const boldObliqueFont = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique)

  // Pre-compute actual heights for static-text fields using real font metrics.
  // This lets applyAutoLayout push rows below them down correctly.
  const presizedFields = rawFields.map(field => {
    if (field.type !== 'static-text') return field
    const size = field.fontSize ?? 12
    const lineHeight = size * 1.4
    const padT = field.paddingTop  ?? 4
    const padB = field.paddingBottom ?? 4
    const runs = parseHtmlRuns(field.contentHtml ?? field.content ?? field.label)
    type Tok = { text: string; bold?: boolean; italic?: boolean; nl?: boolean }
    const tokens: Tok[] = []
    for (const run of runs) {
      if (run.newline) { tokens.push({ text: '', nl: true }); continue }
      for (const w of run.text.split(/\s+/).filter(Boolean)) {
        tokens.push({ text: w, bold: run.bold, italic: run.italic })
      }
    }
    // Use the field's actual width from layout approximation (PAGE_WIDTH - 2*PAGE_MARGIN)
    // Subtract 8 to match the 4pt horizontal inset used when drawing text.
    const fieldWidth = (field.width || (PAGE_WIDTH - 2 * 50)) - 8
    let lineCount = 0
    let curLineW = 0
    let hasContent = false
    for (const tok of tokens) {
      if (tok.nl) { lineCount++; curLineW = 0; continue }
      hasContent = true
      const font = tok.bold ? boldFont : tok.italic ? italicFont : regularFont
      const ww = font.widthOfTextAtSize(tok.text + ' ', size)
      if (curLineW + ww > fieldWidth && curLineW > 0) { lineCount++; curLineW = 0 }
      curLineW += ww
    }
    if (hasContent || curLineW > 0) lineCount++
    const computedH = Math.max(field.height || 18, padT + padB + lineCount * lineHeight)
    return { ...field, height: computedH }
  })

  const fields = applyAutoLayout(presizedFields, CONTENT_TOP - (titleStyle?.spacingBelow ?? 0))

  const tSize = titleStyle?.fontSize ?? 16
  const tWeight = titleStyle?.fontWeight ?? 'bold'
  const tFont = tWeight === 'bold' ? boldFont : regularFont
  const tColor = (() => {
    const c = hexToRgb(titleStyle?.color ?? '#1a1a1a')
    return c ? rgb(c.r, c.g, c.b) : rgb(0.1, 0.1, 0.1)
  })()

  const pagesNeeded = Math.max(1, ...fields.map(f => f.page), 0)
  for (let i = 0; i < pagesNeeded; i++) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    page.drawText(name, {
      x: 50,
      y: PAGE_HEIGHT - 40,
      size: tSize,
      font: tFont,
      color: tColor
    })
    // Page number: bottom-right, only when more than one page
    if (pagesNeeded > 1) {
      const pageLabel = `Page ${i + 1} of ${pagesNeeded}`
      const labelW = regularFont.widthOfTextAtSize(pageLabel, 9)
      page.drawText(pageLabel, {
        x: PAGE_WIDTH - 50 - labelW,
        y: 24,
        size: 9,
        font: regularFont,
        color: rgb(0.5, 0.5, 0.5)
      })
    }
  }

  // Group by page for row background pass
  const byPage = new Map<number, PositionedField[]>()
  for (const field of fields) {
    const p = field.page || 1
    const list = byPage.get(p) ?? []
    list.push(field)
    byPage.set(p, list)
  }
  for (const [pageIdx, pageFields] of byPage.entries()) {
    const page = pdfDoc.getPage(pageIdx - 1)
    drawRowBackgrounds(page, pageFields)
  }

  for (const field of fields) {
    const pageIndex = Math.max(0, (field.page || 1) - 1)
    while (pdfDoc.getPageCount() <= pageIndex) {
      pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    }
    const page = pdfDoc.getPage(pageIndex)

    // Per-field background — drawn behind the LABEL area (above the widget),
    // matching the canvas where the container bg shows in the label strip and
    // the white input box covers the area below.
    const fieldBg = field.backgroundColor
      ? hexToRgb(field.backgroundColor)
      : null

    const fieldName = `${field.label.replace(/\s+/g, '_')}_${field.id.slice(0, 6)}`

    /** Pull the first explicit font-size (px) from labelHtml, converted to pts. Falls back to defaultPt. */
    const labelFontPt = (defaultPt: number) => {
      const m = field.labelHtml?.match(/font-size:\s*([0-9.]+)px/i)
      const result = m ? Math.max(5, parseFloat(m[1])) : defaultPt
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[label-font] field=${field.label} labelHtml=${field.labelHtml?.slice(0, 80)} → size=${result}`)
      }
      return result
    }
    /** True when the label should be bold: default bold for new fields (no labelHtml), explicit when <strong> present. */
    const labelHasBold = !field.labelHtml || /<strong|<b[ >]/i.test(field.labelHtml)
    /** True when the label has italic markup. */
    const labelHasItalic = /<em|<i[ >]/i.test(field.labelHtml ?? '')
    /** True when the label has underline markup. */
    const labelHasUnderline = /<u[ >]/i.test(field.labelHtml ?? '')
    /** Pick the correct font variant for the label header. */
    const labelFont = labelHasBold && labelHasItalic ? boldObliqueFont
      : labelHasBold ? boldFont
      : labelHasItalic ? italicFont
      : regularFont

    if (field.type === 'text') {
      const labelC = safeColor(field.textColor, '#444444')
      const align = labelAlign(field.labelHtml)
      const lSize = labelFontPt(9)
      const labelText = field.label.toUpperCase()
      const lw = labelFont.widthOfTextAtSize(labelText, lSize)
      const lx = labelX(align, field.x, field.width, lw)
      const bw = field.borderWidth ?? 1
      const bc = safeColor(field.borderColor, '#999999')
      const bcRgb = rgb(bc.r, bc.g, bc.b)
      const r = field.borderRadius ?? 0
      const totalH = LABEL_SPACE + field.height
      const labelBg = fieldBg ?? { r: 1, g: 1, b: 1 }
      const rTL = field.borderTopLeftRadius     ?? r
      const rTR = field.borderTopRightRadius    ?? r
      const rBR = field.borderBottomRightRadius ?? r
      const rBL = field.borderBottomLeftRadius  ?? r
      // Widget inset per bottom corner only — top stays flush with separator
      // Always inset at least bw/2 so border lines are never covered by the widget
      const insL = rBL > 0 ? Math.max(bw * 0.5, rBL * 0.35) : bw / 2
      const insR = rBR > 0 ? Math.max(bw * 0.5, rBR * 0.35) : bw / 2
      const insB = Math.max(insL, insR)

      // Rounded background fill
      page.drawSvgPath(roundedRectPath(field.width, totalH, r, rTL, rTR, rBR, rBL), { x: field.x, y: field.y + totalH, color: rgb(labelBg.r, labelBg.g, labelBg.b) })
      // White input zone — curved at bottom corners to match rounded fill
      if (rBL > 0 || rBR > 0) {
        page.drawSvgPath(roundedRectPath(field.width, field.height, 0, 0, 0, rBR, rBL), { x: field.x, y: field.y + field.height, color: rgb(1, 1, 1) })
      } else {
        page.drawRectangle({ x: field.x, y: field.y, width: field.width, height: field.height, color: rgb(1, 1, 1) })
      }
      page.drawText(labelText, { x: lx, y: field.y + field.height + (LABEL_SPACE - lSize) / 2, size: lSize, font: labelFont, color: rgb(labelC.r, labelC.g, labelC.b) })
      if (labelHasUnderline) {
        const ulY = field.y + field.height + (LABEL_SPACE - lSize) / 2 - lSize * 0.12
        page.drawLine({ start: { x: lx, y: ulY }, end: { x: lx + lw, y: ulY }, thickness: Math.max(0.5, lSize * 0.07), color: rgb(labelC.r, labelC.g, labelC.b) })
      }
      // Straight border lines — same drawLine approach as all other fields, no thickness change
      if (bw > 0) {
        page.drawLine({ start: { x: field.x, y: field.y + totalH }, end: { x: field.x + field.width, y: field.y + totalH }, thickness: bw, color: bcRgb })
        page.drawLine({ start: { x: field.x, y: field.y }, end: { x: field.x + field.width, y: field.y }, thickness: bw, color: bcRgb })
        page.drawLine({ start: { x: field.x, y: field.y }, end: { x: field.x, y: field.y + totalH }, thickness: bw, color: bcRgb })
        page.drawLine({ start: { x: field.x + field.width, y: field.y }, end: { x: field.x + field.width, y: field.y + totalH }, thickness: bw, color: bcRgb })
      }
      page.drawLine({ start: { x: field.x, y: field.y + field.height }, end: { x: field.x + field.width, y: field.y + field.height }, thickness: Math.max(bw, 0.5), color: bcRgb })
      const textField = form.createTextField(fieldName)
      textField.setText('')
      textField.enableMultiline()
      textField.addToPage(page, { x: field.x + insL, y: field.y + insB, width: field.width - insL - insR, height: field.height - insB, borderWidth: 0, backgroundColor: rgb(1, 1, 1), font: regularFont })
      textField.setFontSize(field.fontSize ?? 12)
    } else if (field.type === 'checkbox') {
      const labelC = safeColor(field.textColor, '#444444')
      const align = labelAlign(field.labelHtml)
      const lSize = labelFontPt(9)
      const labelText = field.label.toUpperCase()
      const lw = labelFont.widthOfTextAtSize(labelText, lSize)
      const bw = field.borderWidth ?? 1
      const bc = safeColor(field.borderColor, '#999999')
      const checkBox = form.createCheckBox(fieldName)
      checkBox.addToPage(page, { x: field.x, y: field.y, width: field.height, height: field.height, borderWidth: bw, borderColor: rgb(bc.r, bc.g, bc.b), backgroundColor: rgb(1, 1, 1) })
      if (field.labelPosition === 'above') {
        const aboveW = Math.max(field.height, lw + 6)
        const lx = labelX(align, field.x, aboveW, lw)
        const labelBg = fieldBg ?? { r: 1, g: 1, b: 1 }
        page.drawRectangle({ x: field.x, y: field.y + field.height, width: aboveW, height: LABEL_SPACE, color: rgb(labelBg.r, labelBg.g, labelBg.b) })
        page.drawText(labelText, { x: lx, y: field.y + field.height + (LABEL_SPACE - lSize) / 2, size: lSize, font: labelFont, color: rgb(labelC.r, labelC.g, labelC.b) })
        if (labelHasUnderline) {
          const ulY = field.y + field.height + (LABEL_SPACE - lSize) / 2 - lSize * 0.12
          page.drawLine({ start: { x: lx, y: ulY }, end: { x: lx + lw, y: ulY }, thickness: Math.max(0.5, lSize * 0.07), color: rgb(labelC.r, labelC.g, labelC.b) })
        }
      } else {
        page.drawText(field.label, { x: field.x + field.height + 6, y: field.y + 2, size: 9, font: regularFont, color: rgb(labelC.r, labelC.g, labelC.b) })
      }
    } else if (field.type === 'dropdown') {
      const labelC = safeColor(field.textColor, '#444444')
      const align = labelAlign(field.labelHtml)
      const lSize = labelFontPt(9)
      const labelText = field.label.toUpperCase()
      const lw = labelFont.widthOfTextAtSize(labelText, lSize)
      const lx = labelX(align, field.x, field.width, lw)
      const bw = field.borderWidth ?? 1
      const bc = safeColor(field.borderColor, '#999999')
      const bcRgb = rgb(bc.r, bc.g, bc.b)
      const r = field.borderRadius ?? 0
      const totalH = LABEL_SPACE + field.height
      const labelBg = fieldBg ?? { r: 1, g: 1, b: 1 }
      const rTL = field.borderTopLeftRadius     ?? r
      const rTR = field.borderTopRightRadius    ?? r
      const rBR = field.borderBottomRightRadius ?? r
      const rBL = field.borderBottomLeftRadius  ?? r
      const insL = rBL > 0 ? Math.max(bw * 0.5, rBL * 0.35) : bw / 2
      const insR = rBR > 0 ? Math.max(bw * 0.5, rBR * 0.35) : bw / 2
      const insB = Math.max(insL, insR)

      page.drawSvgPath(roundedRectPath(field.width, totalH, r, rTL, rTR, rBR, rBL), { x: field.x, y: field.y + totalH, color: rgb(labelBg.r, labelBg.g, labelBg.b) })
      if (rBL > 0 || rBR > 0) {
        page.drawSvgPath(roundedRectPath(field.width, field.height, 0, 0, 0, rBR, rBL), { x: field.x, y: field.y + field.height, color: rgb(1, 1, 1) })
      } else {
        page.drawRectangle({ x: field.x, y: field.y, width: field.width, height: field.height, color: rgb(1, 1, 1) })
      }
      page.drawText(labelText, { x: lx, y: field.y + field.height + (LABEL_SPACE - lSize) / 2, size: lSize, font: labelFont, color: rgb(labelC.r, labelC.g, labelC.b) })
      if (labelHasUnderline) {
        const ulY = field.y + field.height + (LABEL_SPACE - lSize) / 2 - lSize * 0.12
        page.drawLine({ start: { x: lx, y: ulY }, end: { x: lx + lw, y: ulY }, thickness: Math.max(0.5, lSize * 0.07), color: rgb(labelC.r, labelC.g, labelC.b) })
      }
      if (bw > 0) {
        page.drawLine({ start: { x: field.x, y: field.y + totalH }, end: { x: field.x + field.width, y: field.y + totalH }, thickness: bw, color: bcRgb })
        page.drawLine({ start: { x: field.x, y: field.y }, end: { x: field.x + field.width, y: field.y }, thickness: bw, color: bcRgb })
        page.drawLine({ start: { x: field.x, y: field.y }, end: { x: field.x, y: field.y + totalH }, thickness: bw, color: bcRgb })
        page.drawLine({ start: { x: field.x + field.width, y: field.y }, end: { x: field.x + field.width, y: field.y + totalH }, thickness: bw, color: bcRgb })
      }
      page.drawLine({ start: { x: field.x, y: field.y + field.height }, end: { x: field.x + field.width, y: field.y + field.height }, thickness: Math.max(bw, 0.5), color: bcRgb })

      const placeholder = field.dropdownPlaceholder ?? ''
      const opts = field.options ?? ['Option 1']
      const allOpts = placeholder ? [placeholder, ...opts] : opts
      const dropdown = form.createDropdown(fieldName)
      dropdown.addOptions(allOpts)
      if (placeholder) dropdown.select(placeholder)
      const fw = field.fontWeight ?? 'normal'
      const fi = field.fontStyle  ?? 'normal'
      const dropFont = fw === 'bold' && fi === 'italic' ? boldObliqueFont
                     : fw === 'bold'                    ? boldFont
                     : fi === 'italic'                  ? italicFont
                     : regularFont
      dropdown.addToPage(page, { x: field.x + insL, y: field.y + insB, width: field.width - insL - insR, height: field.height - insB, borderWidth: 0, backgroundColor: rgb(1, 1, 1), font: dropFont })
      if (field.fontSize) dropdown.setFontSize(field.fontSize)
    } else if (field.type === 'radio') {
      const allOpts = field.options ?? ['Option 1']
      const optStyles = field.optionStyles ?? []
      const isSingle = allOpts.length <= 1
      const bw = field.borderWidth ?? 1
      const bc = safeColor(field.borderColor, '#999999')
      const bcRgb = rgb(bc.r, bc.g, bc.b)
      const radioGroup = form.createRadioGroup(fieldName)

      if (isSingle) {
        // Render exactly like a checkbox: circle widget + label text inline, no container
        const s = optStyles[0] ?? {}
        const fsize = s.fontSize ?? 10
        const ofw = s.fontWeight ?? 'normal'
        const ofi = s.fontStyle  ?? 'normal'
        const oFont = ofw === 'bold' ? boldFont : ofi === 'italic' ? italicFont : regularFont
        const tc = safeColor(s.textColor, '#333333')
        const radioSize = field.height
        const radioY = field.y
        radioGroup.addOptionToPage(allOpts[0] || fieldName, page, {
          x: field.x, y: radioY,
          width: radioSize, height: radioSize,
          borderColor: bcRgb, backgroundColor: rgb(1, 1, 1)
        })
        const textX = field.x + radioSize + 4
        const textY = field.y + (radioSize - fsize) / 2
        page.drawText(allOpts[0] || field.label, {
          x: textX, y: textY,
          size: fsize, font: oFont,
          color: rgb(tc.r, tc.g, tc.b),
          maxWidth: field.width - radioSize - 6
        })
      } else {
        const labelC = safeColor(field.textColor, '#444444')
        const align = labelAlign(field.labelHtml)
        const lSize = labelFontPt(9)
        const labelText = field.label.toUpperCase()
        const lw = labelFont.widthOfTextAtSize(labelText, lSize)
        const lx = labelX(align, field.x, field.width, lw)
        const r = field.borderRadius ?? 0
        const totalH = LABEL_SPACE + field.height
        const labelBg = fieldBg ?? { r: 1, g: 1, b: 1 }
        const insL = bw / 2
        const insR = bw / 2

        page.drawSvgPath(roundedRectPath(field.width, totalH, r, r, r, r, r), { x: field.x, y: field.y + totalH, color: rgb(labelBg.r, labelBg.g, labelBg.b) })
        page.drawRectangle({ x: field.x, y: field.y, width: field.width, height: field.height, color: rgb(1, 1, 1) })
        page.drawText(labelText, { x: lx, y: field.y + field.height + (LABEL_SPACE - lSize) / 2, size: lSize, font: labelFont, color: rgb(labelC.r, labelC.g, labelC.b) })
        if (bw > 0) {
          page.drawLine({ start: { x: field.x, y: field.y + totalH }, end: { x: field.x + field.width, y: field.y + totalH }, thickness: bw, color: bcRgb })
          page.drawLine({ start: { x: field.x, y: field.y }, end: { x: field.x + field.width, y: field.y }, thickness: bw, color: bcRgb })
          page.drawLine({ start: { x: field.x, y: field.y }, end: { x: field.x, y: field.y + totalH }, thickness: bw, color: bcRgb })
          page.drawLine({ start: { x: field.x + field.width, y: field.y }, end: { x: field.x + field.width, y: field.y + totalH }, thickness: bw, color: bcRgb })
        }

        const cols = Math.max(1, field.radioColumns ?? 1)
        const radioSize = 9
        const numRows = Math.ceil(allOpts.length / cols)
        const rowH = Math.max(field.height / Math.max(numRows, 1), radioSize + 4)
        const colW = field.width / cols

        for (let i = 0; i < allOpts.length; i++) {
          const s = optStyles[i] ?? {}
          const fsize = s.fontSize ?? field.fontSize ?? 10
          const ofw = s.fontWeight ?? 'normal'
          const ofi = s.fontStyle  ?? 'normal'
          const oFont = ofw === 'bold' && ofi === 'italic' ? boldObliqueFont
                      : ofw === 'bold'                     ? boldFont
                      : ofi === 'italic'                   ? italicFont
                      : regularFont
          const tc = safeColor(s.textColor, '#1a1a1a')
          const col   = i % cols
          const row   = Math.floor(i / cols)
          const cellX = field.x + col * colW
          const rowBottom = field.y + (numRows - 1 - row) * rowH

          if (col === 0 && row > 0) {
            page.drawLine({ start: { x: field.x, y: rowBottom + rowH }, end: { x: field.x + field.width, y: rowBottom + rowH }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) })
          }

          const radioY = rowBottom + (rowH - radioSize) / 2
          radioGroup.addOptionToPage(allOpts[i], page, {
            x: cellX + insL + 2, y: radioY,
            width: radioSize, height: radioSize,
            borderColor: bcRgb, backgroundColor: rgb(1, 1, 1)
          })

          page.drawText(allOpts[i], {
            x: cellX + insL + 2 + radioSize + 4,
            y: rowBottom + (rowH - fsize) / 2,
            size: fsize, font: oFont,
            color: rgb(tc.r, tc.g, tc.b),
            maxWidth: colW - insL - insR - radioSize - 10
          })
        }
      }
    } else if (field.type === 'static-text') {
      const size = field.fontSize ?? 12
      const lineHeight = size * 1.4
      const padT = field.paddingTop  ?? 4
      const padB = field.paddingBottom ?? 4
      const bw  = field.borderWidth   ?? 0
      const bc  = safeColor(field.borderColor, '#cccccc')
      const bcRgb = rgb(bc.r, bc.g, bc.b)
      const r   = field.borderRadius  ?? 0
      const btw = field.borderTopWidth    ?? bw
      const brw = field.borderRightWidth  ?? bw
      const bbw = field.borderBottomWidth ?? bw
      const blw = field.borderLeftWidth   ?? bw

      // Parse HTML into styled word tokens
      const runs = parseHtmlRuns(field.contentHtml ?? field.content ?? field.label)
      type Token = { text: string; bold?: boolean; italic?: boolean; color?: string; fontSize?: number; nl?: boolean; align?: 'left' | 'center' | 'right' }
      const tokens: Token[] = []
      let curAlign: 'left' | 'center' | 'right' = 'left'
      for (const run of runs) {
        if (run.align) curAlign = run.align
        if (run.newline) { tokens.push({ text: '', nl: true, align: curAlign }); continue }
        for (const w of run.text.split(/\s+/).filter(Boolean)) {
          tokens.push({ text: w, bold: run.bold, italic: run.italic, color: run.color, fontSize: run.fontSize, align: curAlign })
        }
      }

      // Resolve the font for a token so we can measure exact widths
      const tokenFont = (tok: Token) => tok.bold ? boldFont : tok.italic ? italicFont : regularFont
      const tokSize = (tok: Token) => tok.fontSize ?? size

      // Horizontal inset used when drawing text — word-wrap must respect it
      const PAD_H = 4
      const wrapWidth = field.width - PAD_H * 2

      // Word-wrap using real font metrics; carry alignment per visual line
      type Seg = { text: string; bold?: boolean; italic?: boolean; color?: string; fontSize?: number; w: number }
      const visualLines: Array<{ segs: Seg[]; align: 'left' | 'center' | 'right' }> = []
      let curLine: Seg[] = []
      let curLineW = 0
      let lineAlign: 'left' | 'center' | 'right' = 'left'
      for (const tok of tokens) {
        if (tok.nl) {
          visualLines.push({ segs: curLine, align: lineAlign })
          curLine = []; curLineW = 0; lineAlign = tok.align ?? 'left'
          continue
        }
        if (tok.align) lineAlign = tok.align
        const font = tokenFont(tok)
        const wordText = tok.text + ' '
        const ww = font.widthOfTextAtSize(wordText, tokSize(tok))
        if (curLineW + ww > wrapWidth && curLine.length > 0) {
          visualLines.push({ segs: curLine, align: lineAlign }); curLine = []; curLineW = 0
        }
        curLine.push({ text: wordText, bold: tok.bold, italic: tok.italic, color: tok.color, fontSize: tok.fontSize, w: ww })
        curLineW += ww
      }
      if (curLine.length > 0) visualLines.push({ segs: curLine, align: lineAlign })

      // field.height was pre-computed before layout to fit the actual content,
      // so we can use it directly — no overflow, no clipping needed.
      const staticH = field.height || 18
      const blockTop = field.y + staticH
      const bgBottom = field.y

      // Background
      if (fieldBg) {
        page.drawRectangle({
          x: field.x,
          y: bgBottom,
          width: field.width,
          height: staticH,
          color: rgb(fieldBg.r, fieldBg.g, fieldBg.b)
        })
      }

      // Draw lines top-down
      visualLines.forEach(({ segs, align }, i) => {
        const drawY = blockTop - padT - size - i * lineHeight
        const lineW = segs.reduce((s, seg) => s + seg.w, 0)
        let drawX: number
        if (align === 'center') {
          drawX = field.x + (field.width - lineW) / 2
        } else if (align === 'right') {
          drawX = field.x + field.width - PAD_H - lineW
        } else {
          drawX = field.x + PAD_H
        }
        for (const seg of segs) {
          const font = seg.bold ? boldFont : seg.italic ? italicFont : regularFont
          const c = safeColor(seg.color ?? field.textColor, '#1a1a1a')
          const segSize = seg.fontSize ?? size
          page.drawText(seg.text, { x: drawX, y: drawY, size: segSize, font, color: rgb(c.r, c.g, c.b) })
          drawX += seg.w
        }
      })
      // Border lines (drawn after text)
      if (r > 0 && bw > 0) {
        page.drawSvgPath(roundedRectPath(field.width, staticH, r, field.borderTopLeftRadius, field.borderTopRightRadius, field.borderBottomRightRadius, field.borderBottomLeftRadius), { x: field.x, y: field.y + staticH, borderColor: bcRgb, borderWidth: bw, opacity: 0 })
      } else {
        if (btw > 0) page.drawLine({ start: { x: field.x, y: field.y + staticH }, end: { x: field.x + field.width, y: field.y + staticH }, thickness: btw, color: bcRgb })
        if (bbw > 0) page.drawLine({ start: { x: field.x, y: field.y }, end: { x: field.x + field.width, y: field.y }, thickness: bbw, color: bcRgb })
        if (blw > 0) page.drawLine({ start: { x: field.x, y: field.y }, end: { x: field.x, y: field.y + staticH }, thickness: blw, color: bcRgb })
        if (brw > 0) page.drawLine({ start: { x: field.x + field.width, y: field.y }, end: { x: field.x + field.width, y: field.y + staticH }, thickness: brw, color: bcRgb })
      }
    } else if (field.type === 'image') {
      if (field.imageData) {
        try {
          const dataUrl = field.imageData
          const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
          const bytes = Buffer.from(base64, 'base64')
          const img = dataUrl.includes('image/png')
            ? await pdfDoc.embedPng(bytes)
            : await pdfDoc.embedJpg(bytes)
          page.drawImage(img, {
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height
          })
        } catch {
          // Image embed failed — skip silently
        }
      }
    } else if (field.type === 'divider') {
      const divC = safeColor(field.borderColor, '#888888')
      const thickness = Math.max(0.5, field.height || 1.5)
      // Center line within the allocated row height
      const rowH = field.height || DEFAULT_DIVIDER_HEIGHT
      const lineY = field.y + rowH / 2
      page.drawLine({
        start: { x: field.x, y: lineY },
        end: { x: field.x + field.width, y: lineY },
        thickness,
        color: rgb(divC.r, divC.g, divC.b)
      })
    } else if (field.type === 'table' && field.tableConfig) {
      drawTable(page, field, field.tableConfig, form, regularFont, boldFont)
    }
  }

  form.updateFieldAppearances(regularFont)
  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
