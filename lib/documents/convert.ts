import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

import { getGotenbergUrl } from './constants'

const PDF_MIME = 'application/pdf'
const TXT_MIME = 'text/plain'
const DOCX_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
])

export async function convertToPdf(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<{ pdfBuffer: Buffer; converted: boolean }> {
  if (mimeType === PDF_MIME) {
    return { pdfBuffer: buffer, converted: false }
  }

  if (mimeType === TXT_MIME) {
    const pdfBuffer = await convertTxtToPdf(buffer.toString('utf-8'))
    return { pdfBuffer, converted: true }
  }

  if (DOCX_MIMES.has(mimeType)) {
    const pdfBuffer = await convertDocxViaGotenberg(buffer, filename)
    return { pdfBuffer, converted: true }
  }

  throw new Error(`Unsupported mime type for conversion: ${mimeType}`)
}

async function convertTxtToPdf(text: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontSize = 11
  const margin = 50
  const pageWidth = 612
  const pageHeight = 792
  const maxWidth = pageWidth - margin * 2
  const lineHeight = fontSize * 1.4

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const lines = wrapText(text, font, fontSize, maxWidth)

  for (const line of lines) {
    if (y < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
    page.drawText(line, {
      x: margin,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0)
    })
    y -= lineHeight
  }

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}

function wrapText(
  text: string,
  font: Awaited<ReturnType<typeof PDFDocument.prototype.embedFont>>,
  fontSize: number,
  maxWidth: number
): string[] {
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n')
  const lines: string[] = []

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('')
      continue
    }

    const words = paragraph.split(/\s+/)
    let current = ''

    for (const word of words) {
      const test = current ? `${current} ${word}` : word
      const width = font.widthOfTextAtSize(test, fontSize)
      if (width > maxWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = test
      }
    }
    if (current) lines.push(current)
  }

  return lines.length > 0 ? lines : ['']
}

async function convertDocxViaGotenberg(
  buffer: Buffer,
  filename: string
): Promise<Buffer> {
  const gotenbergUrl = getGotenbergUrl()
  const formData = new FormData()
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  })
  formData.append('files', blob, filename.endsWith('.docx') ? filename : `${filename}.docx`)

  const response = await fetch(`${gotenbergUrl}/forms/libreoffice/convert`, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText)
    throw new Error(`Gotenberg conversion failed (${response.status}): ${detail}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function isGotenbergAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${getGotenbergUrl()}/health`, {
      signal: AbortSignal.timeout(3000)
    })
    return response.ok
  } catch {
    return false
  }
}
