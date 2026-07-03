import { exportFormPdf } from './form-export'
import { writeFileBuffer } from './storage'
import type { FormField } from './types'

export async function overwritePdfWithForm(
  pdfPath: string,
  name: string,
  fields: FormField[],
  titleStyle?: {
    fontSize?: number
    fontWeight?: 'bold' | 'normal'
    color?: string
    spacingBelow?: number
  }
): Promise<Buffer> {
  const pdfBuffer = await exportFormPdf(name, fields, titleStyle)
  await writeFileBuffer(pdfPath, pdfBuffer)
  return pdfBuffer
}
