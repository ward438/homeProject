'use client'

import { useCallback, useState } from 'react'

import { Box, Stack, Typography } from '@mui/material'

import { InvoiceEditor } from '@/components/invoices/invoice-editor'
import { InvoiceList } from '@/components/invoices/invoice-list'

export default function InvoicesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Used to trigger list refresh after saves/creates
  const [refreshKey, setRefreshKey] = useState(0)

  const handleSaved = useCallback((id: string) => {
    setSelectedId(id)
    setRefreshKey(k => k + 1)
  }, [])

  const handleNew = useCallback(() => {
    setSelectedId(null)
  }, [])

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        p: { xs: 2, md: 3 }
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" component="h1">
          Invoices
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create, manage, and export invoices
        </Typography>
      </Box>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        sx={{ flex: 1, minHeight: 0, gap: 2 }}
      >
        {/* Left panel — invoice list */}
        <Box
          component="aside"
          sx={{
            width: { md: 300 },
            flexShrink: 0,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            p: 1.5,
            minHeight: { xs: 220, md: 0 },
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <InvoiceList
            selectedId={selectedId}
            onSelect={setSelectedId}
            onNew={handleNew}
            refresh={refreshKey}
          />
        </Box>

        {/* Right panel — editor */}
        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 400,
            overflow: 'hidden'
          }}
        >
          <InvoiceEditor invoiceId={selectedId} onSaved={handleSaved} />
        </Box>
      </Stack>
    </Box>
  )
}
