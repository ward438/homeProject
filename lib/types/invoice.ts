import type { Invoice } from '@/lib/db/schema'

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export type InvoiceLineItem = {
  description: string
  sku?: string
  qty: number
  unitPrice: number
  subtotal: number
}

export type InvoiceSellerInfo = {
  name: string
  address: string
  email: string
  phone: string
  logoImageData?: string
}

export type InvoiceBilledTo = {
  name: string
  address: string
  email: string
  phone: string
}

// InvoiceRecord mirrors the DB row exactly (numeric fields come back as strings from PostgreSQL)
export type InvoiceRecord = Invoice

export type CreateInvoiceInput = {
  invoiceNumber?: string
  status?: InvoiceStatus
  issuedAt?: Date
  dueDate?: Date | null
  sellerInfo: InvoiceSellerInfo
  billedTo: InvoiceBilledTo
  lineItems: InvoiceLineItem[]
  subtotal?: number
  discountAmount?: number
  discountCode?: string | null
  taxRate?: number
  taxAmount?: number
  shippingHandling?: number
  grandTotal?: number
  paymentMethod?: string | null
  shippingMethod?: string | null
  notes?: string | null
  footerMessage?: string | null
}

export type UpdateInvoiceInput = Partial<CreateInvoiceInput>
