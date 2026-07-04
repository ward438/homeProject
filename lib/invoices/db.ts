import { and, desc, eq, sql } from 'drizzle-orm'

import {
  type Client,
  clients,
  type Invoice,
  invoices,
  invoiceSequences,
  type NewClient
} from '@/lib/db/schema'
import { withRLS } from '@/lib/db/with-rls'
import type {
  CreateInvoiceInput,
  InvoiceRecord,
  InvoiceStatus,
  UpdateInvoiceInput
} from '@/lib/types/invoice'

// ---- Invoice CRUD -----------------------------------------------------------

export async function createInvoice(
  userId: string,
  data: CreateInvoiceInput
): Promise<InvoiceRecord> {
  return withRLS(userId, async tx => {
    // Atomically upsert the sequence and get the new value
    const [seq] = await tx
      .insert(invoiceSequences)
      .values({ userId, lastNumber: 1 })
      .onConflictDoUpdate({
        target: invoiceSequences.userId,
        set: { lastNumber: sql`${invoiceSequences.lastNumber} + 1` }
      })
      .returning()

    const invoiceNumber =
      data.invoiceNumber ?? `INV-${String(seq.lastNumber).padStart(4, '0')}`

    const [created] = await tx
      .insert(invoices)
      .values({
        userId,
        invoiceNumber,
        status: data.status ?? 'draft',
        issuedAt: data.issuedAt ?? new Date(),
        dueDate: data.dueDate ?? null,
        sellerInfo: data.sellerInfo as Invoice['sellerInfo'],
        billedTo: data.billedTo as Invoice['billedTo'],
        lineItems: data.lineItems as Invoice['lineItems'],
        subtotal: String(data.subtotal ?? 0),
        discountAmount: String(data.discountAmount ?? 0),
        discountCode: data.discountCode ?? null,
        taxRate: String(data.taxRate ?? 0),
        taxAmount: String(data.taxAmount ?? 0),
        shippingHandling: String(data.shippingHandling ?? 0),
        grandTotal: String(data.grandTotal ?? 0),
        paymentMethod: data.paymentMethod ?? null,
        shippingMethod: data.shippingMethod ?? null,
        notes: data.notes ?? null,
        footerMessage: data.footerMessage ?? null
      })
      .returning()

    return created
  })
}

export async function listInvoices(
  userId: string,
  opts?: { status?: InvoiceStatus }
): Promise<InvoiceRecord[]> {
  return withRLS(userId, async tx => {
    const conditions = [eq(invoices.userId, userId)]
    if (opts?.status) {
      conditions.push(eq(invoices.status, opts.status))
    }
    return tx
      .select()
      .from(invoices)
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt))
  })
}

export async function getInvoice(
  userId: string,
  invoiceId: string
): Promise<InvoiceRecord | null> {
  return withRLS(userId, async tx => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
      .limit(1)
    return invoice ?? null
  })
}

export async function updateInvoice(
  userId: string,
  invoiceId: string,
  data: UpdateInvoiceInput
): Promise<InvoiceRecord | null> {
  return withRLS(userId, async tx => {
    const values: Partial<Invoice> = { updatedAt: new Date() }

    if (data.invoiceNumber !== undefined)
      values.invoiceNumber = data.invoiceNumber
    if (data.status !== undefined) values.status = data.status
    if (data.issuedAt !== undefined) values.issuedAt = data.issuedAt
    if ('dueDate' in data) values.dueDate = data.dueDate ?? null
    if (data.sellerInfo !== undefined)
      values.sellerInfo = data.sellerInfo as Invoice['sellerInfo']
    if (data.billedTo !== undefined)
      values.billedTo = data.billedTo as Invoice['billedTo']
    if (data.lineItems !== undefined)
      values.lineItems = data.lineItems as Invoice['lineItems']
    if (data.subtotal !== undefined) values.subtotal = String(data.subtotal)
    if (data.discountAmount !== undefined)
      values.discountAmount = String(data.discountAmount)
    if ('discountCode' in data) values.discountCode = data.discountCode ?? null
    if (data.taxRate !== undefined) values.taxRate = String(data.taxRate)
    if (data.taxAmount !== undefined) values.taxAmount = String(data.taxAmount)
    if (data.shippingHandling !== undefined)
      values.shippingHandling = String(data.shippingHandling)
    if (data.grandTotal !== undefined)
      values.grandTotal = String(data.grandTotal)
    if ('paymentMethod' in data)
      values.paymentMethod = data.paymentMethod ?? null
    if ('shippingMethod' in data)
      values.shippingMethod = data.shippingMethod ?? null
    if ('notes' in data) values.notes = data.notes ?? null
    if ('footerMessage' in data)
      values.footerMessage = data.footerMessage ?? null

    const [updated] = await tx
      .update(invoices)
      .set(values)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
      .returning()

    return updated ?? null
  })
}

export async function deleteInvoice(
  userId: string,
  invoiceId: string
): Promise<{ success: boolean }> {
  return withRLS(userId, async tx => {
    const deleted = await tx
      .delete(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
      .returning({ id: invoices.id })
    return { success: deleted.length > 0 }
  })
}

export async function updateInvoiceStatus(
  userId: string,
  invoiceId: string,
  status: InvoiceStatus
): Promise<InvoiceRecord | null> {
  return withRLS(userId, async tx => {
    const [updated] = await tx
      .update(invoices)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
      .returning()
    return updated ?? null
  })
}

export async function setInvoiceExportedDocument(
  userId: string,
  invoiceId: string,
  documentId: string
): Promise<void> {
  await withRLS(userId, async tx => {
    await tx
      .update(invoices)
      .set({ exportedDocumentId: documentId, updatedAt: new Date() })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
  })
}

// ---- Client CRUD ------------------------------------------------------------

export async function createClient(
  userId: string,
  data: Omit<NewClient, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Client> {
  return withRLS(userId, async tx => {
    const [created] = await tx
      .insert(clients)
      .values({ userId, ...data })
      .returning()
    return created
  })
}

export async function listClients(userId: string): Promise<Client[]> {
  return withRLS(userId, async tx => {
    return tx
      .select()
      .from(clients)
      .where(eq(clients.userId, userId))
      .orderBy(desc(clients.createdAt))
  })
}

export async function getClient(
  userId: string,
  clientId: string
): Promise<Client | null> {
  return withRLS(userId, async tx => {
    const [client] = await tx
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
      .limit(1)
    return client ?? null
  })
}

export async function deleteClient(
  userId: string,
  clientId: string
): Promise<{ success: boolean }> {
  return withRLS(userId, async tx => {
    const deleted = await tx
      .delete(clients)
      .where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
      .returning({ id: clients.id })
    return { success: deleted.length > 0 }
  })
}
