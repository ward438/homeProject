import fs from 'fs/promises'
import mammoth from 'mammoth'

const PDF_MIME = 'application/pdf'
const TXT_MIME = 'text/plain'
const DOCX_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
])

export async function extractText(
  filePath: string,
  mimeType: string
): Promise<string> {
  if (mimeType === TXT_MIME) {
    return fs.readFile(filePath, 'utf-8')
  }

  if (DOCX_MIMES.has(mimeType)) {
    const buffer = await fs.readFile(filePath)
    const result = await mammoth.extractRawText({ buffer })
    return result.value.trim()
  }

  if (mimeType === PDF_MIME) {
    const buffer = await fs.readFile(filePath)
    const pdfParse = (await import('pdf-parse')).default
    const parsed = await pdfParse(buffer)
    return parsed.text.trim()
  }

  return ''
}
