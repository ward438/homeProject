'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import {
  IconDeviceFloppy,
  IconFileExport,
  IconPlus,
  IconTrash
} from '@tabler/icons-react'

import type {
  InvoiceBilledTo,
  InvoiceLineItem,
  InvoiceRecord,
  InvoiceSellerInfo,
  InvoiceStatus
} from '@/lib/types/invoice'

// ---- types ------------------------------------------------------------------

type EditorState = {
  invoiceNumber: string
  issuedAt: string
  dueDate: string
  sellerName: string
  sellerAddress: string
  sellerEmail: string
  sellerPhone: string
  logoImageData: string
  billedName: string
  billedAddress: string
  billedEmail: string
  billedPhone: string
  lineItems: InvoiceLineItem[]
  discountAmount: number
  discountCode: string
  taxRate: number
  shippingHandling: number
  paymentMethod: string
  shippingMethod: string
  notes: string
  footerMessage: string
}

const STATUS_COLORS: Record<
  InvoiceStatus,
  'default' | 'primary' | 'success' | 'warning' | 'error'
> = {
  draft: 'default',
  sent: 'primary',
  paid: 'success',
  overdue: 'error',
  cancelled: 'default'
}

function toDateInputValue(d?: Date | string | null): string {
  if (!d) return ''
  const date = new Date(d)
  return date.toISOString().split('T')[0]
}

function computeTotals(state: EditorState) {
  const subtotal = state.lineItems.reduce((s, item) => s + item.subtotal, 0)
  const taxAmount = subtotal * (state.taxRate / 100)
  const grandTotal =
    subtotal - state.discountAmount + taxAmount + state.shippingHandling
  return { subtotal, taxAmount, grandTotal }
}

function stateToPayload(state: EditorState) {
  const { subtotal, taxAmount, grandTotal } = computeTotals(state)
  const sellerInfo: InvoiceSellerInfo = {
    name: state.sellerName,
    address: state.sellerAddress,
    email: state.sellerEmail,
    phone: state.sellerPhone,
    ...(state.logoImageData ? { logoImageData: state.logoImageData } : {})
  }
  const billedTo: InvoiceBilledTo = {
    name: state.billedName,
    address: state.billedAddress,
    email: state.billedEmail,
    phone: state.billedPhone
  }
  return {
    invoiceNumber: state.invoiceNumber || undefined,
    issuedAt: state.issuedAt ? new Date(state.issuedAt) : undefined,
    dueDate: state.dueDate ? new Date(state.dueDate) : null,
    sellerInfo,
    billedTo,
    lineItems: state.lineItems,
    subtotal,
    discountAmount: state.discountAmount,
    discountCode: state.discountCode || null,
    taxRate: state.taxRate,
    taxAmount,
    shippingHandling: state.shippingHandling,
    grandTotal,
    paymentMethod: state.paymentMethod || null,
    shippingMethod: state.shippingMethod || null,
    notes: state.notes || null,
    footerMessage: state.footerMessage || null
  }
}

function recordToState(r: InvoiceRecord): EditorState {
  const seller = r.sellerInfo as InvoiceSellerInfo
  const billed = r.billedTo as InvoiceBilledTo
  const items = (r.lineItems ?? []) as InvoiceLineItem[]
  return {
    invoiceNumber: r.invoiceNumber,
    issuedAt: toDateInputValue(r.issuedAt),
    dueDate: toDateInputValue(r.dueDate),
    sellerName: seller?.name ?? '',
    sellerAddress: seller?.address ?? '',
    sellerEmail: seller?.email ?? '',
    sellerPhone: seller?.phone ?? '',
    logoImageData: seller?.logoImageData ?? '',
    billedName: billed?.name ?? '',
    billedAddress: billed?.address ?? '',
    billedEmail: billed?.email ?? '',
    billedPhone: billed?.phone ?? '',
    lineItems: items,
    discountAmount: Number(r.discountAmount ?? 0),
    discountCode: r.discountCode ?? '',
    taxRate: Number(r.taxRate ?? 0),
    shippingHandling: Number(r.shippingHandling ?? 0),
    paymentMethod: r.paymentMethod ?? '',
    shippingMethod: r.shippingMethod ?? '',
    notes: r.notes ?? '',
    footerMessage: r.footerMessage ?? ''
  }
}

const EMPTY_STATE: EditorState = {
  invoiceNumber: '',
  issuedAt: toDateInputValue(new Date()),
  dueDate: '',
  sellerName: '',
  sellerAddress: '',
  sellerEmail: '',
  sellerPhone: '',
  logoImageData: '',
  billedName: '',
  billedAddress: '',
  billedEmail: '',
  billedPhone: '',
  lineItems: [],
  discountAmount: 0,
  discountCode: '',
  taxRate: 0,
  shippingHandling: 0,
  paymentMethod: '',
  shippingMethod: '',
  notes: '',
  footerMessage: ''
}

// ---- component --------------------------------------------------------------

type Props = {
  invoiceId: string | null
  onSaved?: (id: string) => void
}

export function InvoiceEditor({ invoiceId, onSaved }: Props) {
  const [state, setState] = useState<EditorState>(EMPTY_STATE)
  const [status, setStatus] = useState<InvoiceStatus>('draft')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(invoiceId)
  const [error, setError] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const s = <K extends keyof EditorState>(key: K, value: EditorState[K]) =>
    setState(prev => ({ ...prev, [key]: value }))

  // Load invoice when invoiceId changes
  useEffect(() => {
    if (!invoiceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(EMPTY_STATE)
      setStatus('draft')
      setSavedId(null)
      return
    }
    setSavedId(invoiceId)
    fetch(`/api/invoices/${invoiceId}`)
      .then(r => r.json())
      .then(data => {
        if (data.invoice) {
          setState(recordToState(data.invoice))
          setStatus(data.invoice.status)
        }
      })
      .catch(err => console.error('[InvoiceEditor] load failed', err))
  }, [invoiceId])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = stateToPayload(state)
      let res: Response
      if (savedId) {
        res = await fetch(`/api/invoices/${savedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        res = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Save failed')
        return
      }
      const inv = data.invoice as InvoiceRecord
      setSavedId(inv.id)
      setState(recordToState(inv))
      setStatus(inv.status as InvoiceStatus)
      onSaved?.(inv.id)
    } catch (err) {
      console.error('[InvoiceEditor] save error', err)
      setError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    if (!savedId) {
      setError('Save the invoice first before exporting.')
      return
    }
    setExporting(true)
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${savedId}/export`, {
        method: 'POST'
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Export failed')
        return
      }
      // Open the exported document PDF
      window.open(
        `/api/documents/${data.documentId}/file?variant=pdf`,
        '_blank'
      )
    } catch (err) {
      console.error('[InvoiceEditor] export error', err)
      setError('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      s('logoImageData', (ev.target?.result as string) ?? '')
    }
    reader.readAsDataURL(file)
  }

  const addLineItem = () => {
    setState(prev => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        { description: '', sku: '', qty: 1, unitPrice: 0, subtotal: 0 }
      ]
    }))
  }

  const removeLineItem = (idx: number) => {
    setState(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== idx)
    }))
  }

  const updateLineItem = useCallback(
    (idx: number, field: keyof InvoiceLineItem, value: string | number) => {
      setState(prev => {
        const items = prev.lineItems.map((item, i) => {
          if (i !== idx) return item
          const updated = { ...item, [field]: value }
          if (field === 'qty' || field === 'unitPrice') {
            updated.subtotal = Number(updated.qty) * Number(updated.unitPrice)
          }
          return updated
        })
        return { ...prev, lineItems: items }
      })
    },
    []
  )

  const { subtotal, taxAmount, grandTotal } = computeTotals(state)

  const sectionTitle = (text: string) => (
    <Typography
      variant="subtitle2"
      sx={{ fontWeight: 700, color: 'text.secondary', mb: 1, mt: 0.5 }}
    >
      {text}
    </Typography>
  )

  const tf = (
    label: string,
    value: string | number,
    onChange: (v: string) => void,
    opts?: {
      type?: string
      multiline?: boolean
      rows?: number
      required?: boolean
      size?: 'small' | 'medium'
    }
  ) => (
    <TextField
      label={label}
      value={value}
      onChange={e => onChange(e.target.value)}
      size={opts?.size ?? 'small'}
      type={opts?.type ?? 'text'}
      multiline={opts?.multiline}
      rows={opts?.rows}
      required={opts?.required}
      fullWidth
    />
  )

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Actions bar */}
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
          {savedId ? `Invoice ${state.invoiceNumber || '…'}` : 'New Invoice'}
        </Typography>

        <Chip
          label={status}
          size="small"
          color={STATUS_COLORS[status]}
          variant="outlined"
        />

        <Button
          size="small"
          variant="outlined"
          startIcon={<IconFileExport size={16} />}
          onClick={handleExport}
          disabled={exporting || !savedId}
        >
          {exporting ? 'Exporting…' : 'Export PDF'}
        </Button>

        <Button
          size="small"
          variant="contained"
          startIcon={<IconDeviceFloppy size={16} />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Stack>

      {error && (
        <Box
          sx={{
            px: 2,
            py: 1,
            bgcolor: 'error.light',
            color: 'error.contrastText'
          }}
        >
          <Typography variant="body2">{error}</Typography>
        </Box>
      )}

      {/* Scrollable form */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <Stack spacing={3}>
          {/* Invoice Header */}
          <Box>
            {sectionTitle('Invoice Header')}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {tf('Invoice Number', state.invoiceNumber, v =>
                s('invoiceNumber', v)
              )}
              {tf('Issue Date', state.issuedAt, v => s('issuedAt', v), {
                type: 'date'
              })}
              {tf('Due Date', state.dueDate, v => s('dueDate', v), {
                type: 'date'
              })}
            </Stack>
          </Box>

          <Divider />

          {/* From (Seller) */}
          <Box>
            {sectionTitle('From (Seller)')}
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                {tf('Name', state.sellerName, v => s('sellerName', v), {
                  required: true
                })}
                {tf('Email', state.sellerEmail, v => s('sellerEmail', v), {
                  type: 'email'
                })}
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                {tf('Phone', state.sellerPhone, v => s('sellerPhone', v))}
                {tf('Address', state.sellerAddress, v => s('sellerAddress', v))}
              </Stack>

              {/* Logo upload */}
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => logoInputRef.current?.click()}
                >
                  {state.logoImageData ? 'Replace Logo' : 'Upload Logo'}
                </Button>
                {state.logoImageData && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={state.logoImageData}
                      alt="Logo preview"
                      style={{
                        maxHeight: 40,
                        maxWidth: 120,
                        objectFit: 'contain'
                      }}
                    />
                    <Tooltip title="Remove logo">
                      <IconButton
                        size="small"
                        onClick={() => s('logoImageData', '')}
                      >
                        <IconTrash size={14} />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleLogoUpload}
                />
              </Stack>
            </Stack>
          </Box>

          <Divider />

          {/* Bill To */}
          <Box>
            {sectionTitle('Bill To')}
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                {tf('Name', state.billedName, v => s('billedName', v), {
                  required: true
                })}
                {tf('Email', state.billedEmail, v => s('billedEmail', v), {
                  type: 'email'
                })}
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                {tf('Phone', state.billedPhone, v => s('billedPhone', v))}
                {tf('Address', state.billedAddress, v => s('billedAddress', v))}
              </Stack>
            </Stack>
          </Box>

          <Divider />

          {/* Line Items */}
          <Box>
            {sectionTitle('Line Items')}
            <Stack spacing={1}>
              {/* Table header */}
              {state.lineItems.length > 0 && (
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    px: 0.5,
                    pb: 0.5,
                    borderBottom: 1,
                    borderColor: 'divider'
                  }}
                >
                  <Typography variant="caption" sx={{ flex: 3 }}>
                    Description
                  </Typography>
                  <Typography variant="caption" sx={{ flex: 1.5 }}>
                    SKU
                  </Typography>
                  <Typography variant="caption" sx={{ flex: 1 }}>
                    Qty
                  </Typography>
                  <Typography variant="caption" sx={{ flex: 1.5 }}>
                    Unit Price
                  </Typography>
                  <Typography variant="caption" sx={{ flex: 1.5 }}>
                    Subtotal
                  </Typography>
                  <Box sx={{ width: 36 }} />
                </Stack>
              )}

              {state.lineItems.map((item, idx) => (
                <Stack
                  key={idx}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'center' }}
                >
                  <Box sx={{ flex: 3 }}>
                    <TextField
                      size="small"
                      placeholder="Description"
                      value={item.description}
                      onChange={e =>
                        updateLineItem(idx, 'description', e.target.value)
                      }
                      fullWidth
                    />
                  </Box>
                  <Box sx={{ flex: 1.5 }}>
                    <TextField
                      size="small"
                      placeholder="SKU"
                      value={item.sku ?? ''}
                      onChange={e => updateLineItem(idx, 'sku', e.target.value)}
                      fullWidth
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      size="small"
                      type="number"
                      placeholder="1"
                      value={item.qty}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                      onChange={e =>
                        updateLineItem(idx, 'qty', Number(e.target.value))
                      }
                      fullWidth
                    />
                  </Box>
                  <Box sx={{ flex: 1.5 }}>
                    <TextField
                      size="small"
                      type="number"
                      placeholder="0.00"
                      value={item.unitPrice}
                      slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                      onChange={e =>
                        updateLineItem(idx, 'unitPrice', Number(e.target.value))
                      }
                      fullWidth
                    />
                  </Box>
                  <Box sx={{ flex: 1.5 }}>
                    <TextField
                      size="small"
                      value={item.subtotal.toFixed(2)}
                      slotProps={{ htmlInput: { readOnly: true } }}
                      fullWidth
                    />
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => removeLineItem(idx)}
                    sx={{ color: 'error.main', flexShrink: 0 }}
                  >
                    <IconTrash size={16} />
                  </IconButton>
                </Stack>
              ))}

              <Button
                size="small"
                startIcon={<IconPlus size={16} />}
                onClick={addLineItem}
                sx={{ alignSelf: 'flex-start' }}
              >
                Add Line Item
              </Button>
            </Stack>
          </Box>

          <Divider />

          {/* Summary */}
          <Box>
            {sectionTitle('Summary')}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              <Stack spacing={1.5} sx={{ flex: 1 }}>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Discount Amount"
                    size="small"
                    type="number"
                    value={state.discountAmount}
                    slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                    onChange={e => s('discountAmount', Number(e.target.value))}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Discount Code"
                    size="small"
                    value={state.discountCode}
                    onChange={e => s('discountCode', e.target.value)}
                    sx={{ flex: 1 }}
                  />
                </Stack>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Tax Rate (%)"
                    size="small"
                    type="number"
                    value={state.taxRate}
                    slotProps={{ htmlInput: { min: 0, max: 100, step: 0.1 } }}
                    onChange={e => s('taxRate', Number(e.target.value))}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Shipping & Handling"
                    size="small"
                    type="number"
                    value={state.shippingHandling}
                    slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                    onChange={e =>
                      s('shippingHandling', Number(e.target.value))
                    }
                    sx={{ flex: 1 }}
                  />
                </Stack>
              </Stack>

              {/* Computed totals */}
              <Box
                sx={{
                  minWidth: 220,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1.5
                }}
              >
                <Stack spacing={0.5}>
                  <Stack
                    direction="row"
                    sx={{ justifyContent: 'space-between' }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Subtotal
                    </Typography>
                    <Typography variant="body2">
                      ${subtotal.toFixed(2)}
                    </Typography>
                  </Stack>
                  {state.discountAmount > 0 && (
                    <Stack
                      direction="row"
                      sx={{ justifyContent: 'space-between' }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Discount
                      </Typography>
                      <Typography variant="body2" color="error.main">
                        -${state.discountAmount.toFixed(2)}
                      </Typography>
                    </Stack>
                  )}
                  {state.taxRate > 0 && (
                    <Stack
                      direction="row"
                      sx={{ justifyContent: 'space-between' }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Tax ({state.taxRate}%)
                      </Typography>
                      <Typography variant="body2">
                        ${taxAmount.toFixed(2)}
                      </Typography>
                    </Stack>
                  )}
                  {state.shippingHandling > 0 && (
                    <Stack
                      direction="row"
                      sx={{ justifyContent: 'space-between' }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Shipping
                      </Typography>
                      <Typography variant="body2">
                        ${state.shippingHandling.toFixed(2)}
                      </Typography>
                    </Stack>
                  )}
                  <Divider sx={{ my: 0.5 }} />
                  <Stack
                    direction="row"
                    sx={{ justifyContent: 'space-between' }}
                  >
                    <Typography variant="subtitle2">Grand Total</Typography>
                    <Typography variant="subtitle2">
                      ${grandTotal.toFixed(2)}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            </Stack>
          </Box>

          <Divider />

          {/* Details */}
          <Box>
            {sectionTitle('Details')}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {tf('Payment Method', state.paymentMethod, v =>
                s('paymentMethod', v)
              )}
              {tf('Shipping Method', state.shippingMethod, v =>
                s('shippingMethod', v)
              )}
            </Stack>
          </Box>

          <Divider />

          {/* Notes & Footer */}
          <Box>
            {sectionTitle('Notes & Footer')}
            <Stack spacing={1.5}>
              {tf('Notes', state.notes, v => s('notes', v), {
                multiline: true,
                rows: 3
              })}
              {tf('Footer Message', state.footerMessage, v =>
                s('footerMessage', v)
              )}
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}
