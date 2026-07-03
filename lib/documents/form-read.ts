import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField
} from 'pdf-lib'

import type { PdfFormFieldInfo } from './types'

export async function readPdfFormFields(
  pdfBuffer: Buffer
): Promise<PdfFormFieldInfo[]> {
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  const form = pdfDoc.getForm()

  return form.getFields().map(field => {
    const name = field.getName()

    if (field instanceof PDFTextField) {
      return {
        name,
        type: 'text' as const,
        value: field.getText() ?? ''
      }
    }

    if (field instanceof PDFCheckBox) {
      return {
        name,
        type: 'checkbox' as const,
        value: field.isChecked()
      }
    }

    if (field instanceof PDFDropdown) {
      return {
        name,
        type: 'dropdown' as const,
        value: field.getSelected()[0] ?? '',
        options: field.getOptions()
      }
    }

    if (field instanceof PDFRadioGroup) {
      return {
        name,
        type: 'radio' as const,
        value: field.getSelected() ?? '',
        options: field.getOptions()
      }
    }

    return {
      name,
      type: 'unknown' as const
    }
  })
}
