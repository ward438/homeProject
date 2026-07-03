import { PDFCheckBox, PDFDocument, PDFDropdown, PDFRadioGroup, PDFTextField } from 'pdf-lib'

export type PdfFillValues = Record<string, string | boolean>

export async function fillPdfForm(
  pdfBuffer: Buffer,
  values: PdfFillValues
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  const form = pdfDoc.getForm()

  for (const field of form.getFields()) {
    const name = field.getName()
    const value = values[name]

    if (typeof value === 'undefined') continue

    if (field instanceof PDFTextField) {
      field.setText(String(value))
      continue
    }

    if (field instanceof PDFCheckBox) {
      if (Boolean(value)) {
        field.check()
      } else {
        field.uncheck()
      }
      continue
    }

    if (field instanceof PDFDropdown) {
      field.select(String(value))
      continue
    }

    if (field instanceof PDFRadioGroup) {
      field.select(String(value))
    }
  }

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
