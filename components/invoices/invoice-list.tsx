'use client'

import { useCallback, useEffect, useState } from 'react'

import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography
} from '@mui/material'
import { IconEdit, IconFileExport, IconTrash } from '@tabler/icons-react'

import type { InvoiceRecord, InvoiceStatus } from '@/lib/types/invoice'

// ---- Status config ----------------------------------------------------------

type ChipColor = 'default' | 'primary' | 'success' | 'warning' | 'error'

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; color: ChipColor }
> = {
  draft: { label: 'Draft', color: 'default' },
  sent: { label: 'Sent', color: 'primary' },
  paid: { label: 'Paid', color: 'success' },
  overdue: { label: 'Overdue', color: 'error' },
  cancelled: { label: 'Cancelled', color: 'default' }
}

const TABS: { value: InvoiceStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' }
]

function fmt(value: string | number) {
  return `$${Number(value).toFixed(2)}`
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// ---- component --------------------------------------------------------------

type Props = {
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  refresh?: number
}

export function InvoiceList({ selectedId, onSelect, onNew, refresh }: Props) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<InvoiceStatus | 'all'>('all')
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url =
        tab === 'all' ? '/api/invoices' : `/api/invoices?status=${tab}`
      const res = await fetch(url)
      const data = await res.json()
      if (res.ok) setInvoices(data.invoices ?? [])
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load, refresh])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Delete this invoice?')) return
    await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    load()
  }

  const handleExport = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setExporting(id)
    try {
      const res = await fetch(`/api/invoices/${id}/export`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        window.open(
          `/api/documents/${data.documentId}/file?variant=pdf`,
          '_blank'
        )
      }
    } finally {
      setExporting(null)
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1,
          pb: 1,
          flexShrink: 0
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Invoices
        </Typography>
        <Button size="small" variant="contained" onClick={onNew}>
          + New
        </Button>
      </Stack>

      {/* Filter tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{
          minHeight: 36,
          flexShrink: 0,
          borderBottom: 1,
          borderColor: 'divider'
        }}
        slotProps={{ indicator: { style: { height: 2 } } }}
      >
        {TABS.map(t => (
          <Tab
            key={t.value}
            value={t.value}
            label={t.label}
            sx={{ minHeight: 36, fontSize: 12 }}
          />
        ))}
      </Tabs>

      {/* List */}
      <Box sx={{ flex: 1, overflowY: 'auto', mt: 0.5 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : invoices.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ p: 2, textAlign: 'center' }}
          >
            No invoices
          </Typography>
        ) : (
          invoices.map(inv => {
            const cfg =
              STATUS_CONFIG[inv.status as InvoiceStatus] ?? STATUS_CONFIG.draft
            const isSelected = inv.id === selectedId
            const isHovered = inv.id === hoverId

            return (
              <Box
                key={inv.id}
                onClick={() => onSelect(inv.id)}
                onMouseEnter={() => setHoverId(inv.id)}
                onMouseLeave={() => setHoverId(null)}
                sx={{
                  px: 1.5,
                  py: 1,
                  cursor: 'pointer',
                  borderRadius: 1,
                  mb: 0.25,
                  bgcolor: isSelected
                    ? 'action.selected'
                    : isHovered
                      ? 'action.hover'
                      : 'transparent',
                  transition: 'background-color 0.1s'
                }}
              >
                <Stack
                  direction="row"
                  sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, lineHeight: 1.3 }}
                      noWrap
                    >
                      {inv.invoiceNumber}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ display: 'block' }}
                    >
                      {(inv.billedTo as { name?: string })?.name ?? '—'}
                    </Typography>
                  </Box>

                  <Stack
                    direction="row"
                    sx={{ alignItems: 'center', gap: 0.5, flexShrink: 0 }}
                  >
                    <Chip
                      label={cfg.label}
                      size="small"
                      color={cfg.color}
                      variant="outlined"
                      sx={{ fontSize: 10, height: 18 }}
                    />
                  </Stack>
                </Stack>

                <Stack
                  direction="row"
                  sx={{
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mt: 0.25
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {fmtDate(inv.issuedAt)}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {fmt(inv.grandTotal)}
                  </Typography>
                </Stack>

                {/* Quick actions (visible on hover) */}
                {(isHovered || isSelected) && (
                  <Stack
                    direction="row"
                    sx={{ justifyContent: 'flex-end', mt: 0.5, gap: 0.5 }}
                  >
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={e => {
                          e.stopPropagation()
                          onSelect(inv.id)
                        }}
                      >
                        <IconEdit size={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Export PDF">
                      <span>
                        <IconButton
                          size="small"
                          disabled={exporting === inv.id}
                          onClick={e => handleExport(e, inv.id)}
                        >
                          {exporting === inv.id ? (
                            <CircularProgress size={14} />
                          ) : (
                            <IconFileExport size={14} />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        sx={{ color: 'error.main' }}
                        onClick={e => handleDelete(e, inv.id)}
                      >
                        <IconTrash size={14} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                )}
              </Box>
            )
          })
        )}
      </Box>
    </Box>
  )
}
