import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

import { createDocument } from '@/lib/documents/db'
import {
  createDocumentId,
  resolveRelativePath,
  savePdfFile
} from '@/lib/documents/storage'
import type { InvoiceRecord } from '@/lib/types/invoice'

import { hexToRgb } from '../documents/form-export'

import { getInvoice, setInvoiceExportedDocument } from './db'

// ---- constants --------------------------------------------------------------

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 40
const CONTENT_W = PAGE_W - MARGIN * 2

// Header red used for table header row
const HEADER_RED = { r: 0.753, g: 0.224, b: 0.169 } // #c0392b

// ---- helpers ----------------------------------------------------------------

function c(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  return rgb(r, g, b)
}

function fmt(value: string | number): string {
  return `$${Number(value).toFixed(2)}`
}

function drawHRule(
  page: ReturnType<PDFDocument['addPage']>,
  y: number,
  color = rgb(0.8, 0.8, 0.8)
) {
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_W, y },
    thickness: 0.5,
    color
  })
}

// ---- main render function ---------------------------------------------------

export async function renderInvoicePdf(
  invoice: InvoiceRecord
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`Invoice ${invoice.invoiceNumber}`)

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const page = pdfDoc.addPage([PAGE_W, PAGE_H])

  // Track current Y position (top of page = PAGE_H, we move downward)
  let curY = PAGE_H - MARGIN

  // ---- Logo (top-right) -------------------------------------------------------
  const logoData = invoice.sellerInfo?.logoImageData
  if (logoData) {
    try {
      const base64 = logoData.includes(',') ? logoData.split(',')[1] : logoData
      const bytes = Buffer.from(base64, 'base64')
      const img = logoData.includes('image/png')
        ? await pdfDoc.embedPng(bytes)
        : await pdfDoc.embedJpg(bytes)
      const maxW = 120
      const maxH = 40
      const scale = Math.min(maxW / img.width, maxH / img.height, 1)
      const logoW = img.width * scale
      const logoH = img.height * scale
      page.drawImage(img, {
        x: MARGIN + CONTENT_W - logoW,
        y: curY - logoH,
        width: logoW,
        height: logoH
      })
    } catch {
      // logo embed failed — skip silently
    }
  }

  // ---- Title ------------------------------------------------------------------
  page.drawText('Invoice', {
    x: MARGIN,
    y: curY - 28,
    size: 28,
    font: bold,
    color: c('#1a1a1a')
  })
  curY -= 44

  // ---- Invoice meta (number, issued, due) ------------------------------------
  const metaRows: [string, string][] = [
    ['Invoice #', invoice.invoiceNumber],
    [
      'Issued',
      new Date(invoice.issuedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    ]
  ]
  if (invoice.dueDate) {
    metaRows.push([
      'Due',
      new Date(invoice.dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    ])
  }

  const labelColW = 70
  const valueColX = MARGIN + labelColW
  for (const [label, value] of metaRows) {
    page.drawText(label, {
      x: MARGIN,
      y: curY,
      size: 9,
      font: bold,
      color: c('#666666')
    })
    page.drawText(value, {
      x: valueColX,
      y: curY,
      size: 9,
      font: regular,
      color: c('#1a1a1a')
    })
    curY -= 14
  }

  curY -= 10
  drawHRule(page, curY)
  curY -= 16

  // ---- From / Bill To two-column block ----------------------------------------
  const colW = CONTENT_W / 2 - 10
  const rightColX = MARGIN + CONTENT_W / 2 + 10

  function drawInfoBlock(
    startX: number,
    label: string,
    lines: string[],
    startY: number
  ): number {
    page.drawText(label.toUpperCase(), {
      x: startX,
      y: startY,
      size: 8,
      font: bold,
      color: c('#888888')
    })
    let y = startY - 14
    for (const line of lines) {
      if (!line.trim()) continue
      page.drawText(line, {
        x: startX,
        y,
        size: 9,
        font: regular,
        color: c('#1a1a1a'),
        maxWidth: colW
      })
      y -= 13
    }
    return y
  }

  const seller = invoice.sellerInfo
  const billed = invoice.billedTo

  const sellerLines = [
    seller.name,
    seller.address,
    seller.email,
    seller.phone
  ].filter(Boolean)

  const billedLines = [
    billed.name,
    billed.address,
    billed.email,
    billed.phone
  ].filter(Boolean)

  const fromEndY = drawInfoBlock(MARGIN, 'From', sellerLines, curY)
  const toEndY = drawInfoBlock(rightColX, 'Bill To', billedLines, curY)

  curY = Math.min(fromEndY, toEndY) - 10

  // Payment / Shipping methods
  if (invoice.paymentMethod || invoice.shippingMethod) {
    if (invoice.paymentMethod) {
      page.drawText('Payment Method', {
        x: MARGIN,
        y: curY,
        size: 8,
        font: bold,
        color: c('#888888')
      })
      page.drawText(invoice.paymentMethod, {
        x: MARGIN + 100,
        y: curY,
        size: 9,
        font: regular,
        color: c('#1a1a1a')
      })
      curY -= 14
    }
    if (invoice.shippingMethod) {
      page.drawText('Shipping Method', {
        x: MARGIN,
        y: curY,
        size: 8,
        font: bold,
        color: c('#888888')
      })
      page.drawText(invoice.shippingMethod, {
        x: MARGIN + 100,
        y: curY,
        size: 9,
        font: regular,
        color: c('#1a1a1a')
      })
      curY -= 14
    }
  }

  curY -= 10
  drawHRule(page, curY)
  curY -= 16

  // ---- Line items table -------------------------------------------------------
  // Column definitions: [label, xOffset, width, align]
  type ColDef = { label: string; x: number; w: number; align: 'left' | 'right' }
  const cols: ColDef[] = [
    { label: 'Item', x: MARGIN, w: 190, align: 'left' },
    { label: 'SKU', x: MARGIN + 190, w: 90, align: 'left' },
    { label: 'Qty', x: MARGIN + 280, w: 60, align: 'right' },
    { label: 'Unit Price', x: MARGIN + 340, w: 90, align: 'right' },
    { label: 'Subtotal', x: MARGIN + 430, w: 85, align: 'right' }
  ]

  const rowH = 18
  const headerH = 20

  // Header row background
  page.drawRectangle({
    x: MARGIN,
    y: curY - headerH,
    width: CONTENT_W,
    height: headerH,
    color: rgb(HEADER_RED.r, HEADER_RED.g, HEADER_RED.b)
  })

  // Header labels
  for (const col of cols) {
    const tw = bold.widthOfTextAtSize(col.label, 9)
    const tx = col.align === 'right' ? col.x + col.w - tw - 4 : col.x + 4
    page.drawText(col.label, {
      x: tx,
      y: curY - headerH + 5,
      size: 9,
      font: bold,
      color: rgb(1, 1, 1)
    })
  }
  curY -= headerH

  // Data rows
  const lineItems = (invoice.lineItems ?? []) as Array<{
    description: string
    sku?: string
    qty: number
    unitPrice: number
    subtotal: number
  }>

  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i]
    const rowBg = i % 2 === 0 ? c('#f9f9f9') : rgb(1, 1, 1)

    page.drawRectangle({
      x: MARGIN,
      y: curY - rowH,
      width: CONTENT_W,
      height: rowH,
      color: rowBg
    })

    const cells: [ColDef, string][] = [
      [cols[0], item.description ?? ''],
      [cols[1], item.sku ?? ''],
      [cols[2], String(item.qty ?? 0)],
      [cols[3], fmt(item.unitPrice ?? 0)],
      [cols[4], fmt(item.subtotal ?? 0)]
    ]

    for (const [col, text] of cells) {
      const tw = regular.widthOfTextAtSize(text, 9)
      const tx = col.align === 'right' ? col.x + col.w - tw - 4 : col.x + 4
      page.drawText(text, {
        x: tx,
        y: curY - rowH + 5,
        size: 9,
        font: regular,
        color: c('#1a1a1a'),
        maxWidth: col.w - 8
      })
    }

    // light separator
    if (i < lineItems.length - 1) {
      page.drawLine({
        start: { x: MARGIN, y: curY - rowH },
        end: { x: MARGIN + CONTENT_W, y: curY - rowH },
        thickness: 0.3,
        color: c('#dddddd')
      })
    }

    curY -= rowH
  }

  // Outer border around table
  const tableBottom = curY
  const tableTop = curY + headerH + lineItems.length * rowH
  page.drawRectangle({
    x: MARGIN,
    y: tableBottom,
    width: CONTENT_W,
    height: tableTop - tableBottom,
    borderColor: c('#dddddd'),
    borderWidth: 0.5,
    opacity: 0
  })

  curY -= 20

  // ---- Summary block (right-aligned) ------------------------------------------
  const sumLabelX = MARGIN + CONTENT_W - 220
  const sumValueX = MARGIN + CONTENT_W - 5

  function drawSummaryRow(
    label: string,
    value: string,
    isBold = false,
    fontSize = 9
  ) {
    const font = isBold ? bold : regular
    page.drawText(label, {
      x: sumLabelX,
      y: curY,
      size: fontSize,
      font,
      color: c('#555555')
    })
    const vw = font.widthOfTextAtSize(value, fontSize)
    page.drawText(value, {
      x: sumValueX - vw,
      y: curY,
      size: fontSize,
      font,
      color: c('#1a1a1a')
    })
    curY -= fontSize + 6
  }

  drawSummaryRow('Subtotal', fmt(invoice.subtotal))

  const discAmt = Number(invoice.discountAmount)
  if (discAmt > 0) {
    const discLabel = invoice.discountCode
      ? `Discount (${invoice.discountCode})`
      : 'Discount'
    drawSummaryRow(discLabel, `-${fmt(discAmt)}`)
  }

  const taxRate = Number(invoice.taxRate)
  if (taxRate > 0) {
    drawSummaryRow(`Tax (${taxRate}%)`, fmt(invoice.taxAmount))
  }

  const shipping = Number(invoice.shippingHandling)
  if (shipping > 0) {
    drawSummaryRow('Shipping & Handling', fmt(shipping))
  }

  curY -= 4
  drawHRule(page, curY + 2, c('#cccccc'))
  curY -= 8

  drawSummaryRow('Grand Total', fmt(invoice.grandTotal), true, 12)

  curY -= 10

  // ---- Notes ------------------------------------------------------------------
  if (invoice.notes) {
    drawHRule(page, curY)
    curY -= 14
    page.drawText('Notes', {
      x: MARGIN,
      y: curY,
      size: 9,
      font: bold,
      color: c('#888888')
    })
    curY -= 14
    page.drawText(invoice.notes, {
      x: MARGIN,
      y: curY,
      size: 9,
      font: regular,
      color: c('#333333'),
      maxWidth: CONTENT_W
    })
    curY -= 20
  }

  // ---- Footer -----------------------------------------------------------------
  const footerY = MARGIN + 40
  drawHRule(page, footerY + 20)

  const thankMsg = invoice.footerMessage ?? 'Thank you for your business!'
  const thankW = regular.widthOfTextAtSize(thankMsg, 9)
  page.drawText(thankMsg, {
    x: MARGIN + (CONTENT_W - thankW) / 2,
    y: footerY + 4,
    size: 9,
    font: regular,
    color: c('#888888')
  })

  const contactLine = [invoice.sellerInfo?.email, invoice.sellerInfo?.phone]
    .filter(Boolean)
    .join('  |  ')

  if (contactLine) {
    const cw = regular.widthOfTextAtSize(contactLine, 8)
    page.drawText(contactLine, {
      x: MARGIN + (CONTENT_W - cw) / 2,
      y: MARGIN + 20,
      size: 8,
      font: regular,
      color: c('#aaaaaa')
    })
  }

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}

// ---- exportInvoicePdf helper ------------------------------------------------

export async function exportInvoicePdf(
  userId: string,
  invoiceId: string
): Promise<{ documentId: string; pdfBuffer: Buffer }> {
  const invoice = await getInvoice(userId, invoiceId)
  if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`)

  const pdfBuffer = await renderInvoicePdf(invoice)

  const documentId = createDocumentId()
  const pdfPath = await savePdfFile(userId, documentId, pdfBuffer, 'invoice')
  const relativePath = resolveRelativePath(pdfPath)

  await createDocument({
    id: documentId,
    userId,
    originalFilename: `invoice-${invoice.invoiceNumber}.pdf`,
    originalMimeType: 'application/pdf',
    originalPath: relativePath,
    pdfPath: relativePath,
    status: 'ready',
    extractedText: null,
    jsonData: null
  })

  await setInvoiceExportedDocument(userId, invoiceId, documentId)

  return { documentId, pdfBuffer }
}
