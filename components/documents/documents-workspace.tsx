'use client'

import { useCallback, useEffect, useState } from 'react'

import { Box, Button, Stack, Tab, Tabs, Typography } from '@mui/material'

import type { DocumentRecord } from '@/lib/documents/types'

import { DocumentList } from './document-list'
import { DocumentUpload } from './document-upload'
import { FormBuilder } from './form-builder'
import { JsonWorkspace } from './json-workspace'
import { PdfFormFiller } from './pdf-form-filler'
import { PdfViewer } from './pdf-viewer'
import { TextAnalyzer } from './text-analyzer'

type TabId = 'view' | 'analyze' | 'edit' | 'fill' | 'json'

function fileUrl(id: string, download = false) {
  return `/api/documents/${id}/file?variant=pdf${download ? '&download=1' : ''}`
}

export function DocumentsWorkspace() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('view')
  const [loading, setLoading] = useState(true)
  const [converting, setConverting] = useState(false)

  const loadDocuments = useCallback(async (selectId?: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/documents')
      const data = await res.json()
      if (res.ok) {
        const docs = (data.documents ?? []) as DocumentRecord[]
        setDocuments(docs)
        if (selectId) {
          setSelectedId(selectId)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDocuments()
  }, [loadDocuments])

  const selected = documents.find(d => d.id === selectedId) ?? null

  function selectAndOpen(id: string, nextTab: TabId) {
    setSelectedId(id)
    setTab(nextTab)
  }

  const handleDeleted = useCallback(
    (deletedId: string) => {
      setSelectedId(current => (current === deletedId ? null : current))
      loadDocuments()
    },
    [loadDocuments]
  )

  const retryConvert = async () => {
    if (!selectedId) return
    setConverting(true)
    try {
      const res = await fetch(`/api/documents/${selectedId}/convert`, {
        method: 'POST'
      })
      if (res.ok) await loadDocuments()
    } finally {
      setConverting(false)
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        gap: 2,
        p: { xs: 2, md: 3 }
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
          alignItems: { sm: 'center' },
          justifyContent: 'space-between',
          gap: 2
        }}
      >
        <Box>
          <Typography variant="h6" component="h1">
            Documents
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload, view, download, modify, fill, and render JSON
          </Typography>
        </Box>
        <Box sx={{ width: '100%', maxWidth: { sm: 320 } }}>
          <DocumentUpload onUploaded={() => loadDocuments()} />
        </Box>
      </Stack>

      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        sx={{ flex: 1, minHeight: 0, gap: 2 }}
      >
        <Box
          component="aside"
          sx={{
            width: { lg: 288 },
            flexShrink: 0,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            p: 1.5,
            minHeight: { xs: 200, lg: 0 }
          }}
        >
          <DocumentList
            documents={documents}
            selectedId={selectedId}
            onSelect={id => selectAndOpen(id, 'view')}
            onView={id => selectAndOpen(id, 'view')}
            onEdit={id => selectAndOpen(id, 'edit')}
            onFill={id => selectAndOpen(id, 'fill')}
            onJson={id => selectAndOpen(id, 'json')}
            onDeleted={handleDeleted}
            onRefresh={() => loadDocuments()}
            loading={loading}
          />
        </Box>

        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 400
          }}
        >
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
              borderBottom: 1,
              borderColor: 'divider',
              mb: 2
            }}
          >
            <Tabs
              value={tab}
              onChange={(_, value: TabId) => setTab(value)}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{ minHeight: 40 }}
            >
              <Tab label="View PDF" value="view" sx={{ minHeight: 40 }} />
              <Tab label="Analyze" value="analyze" sx={{ minHeight: 40 }} />
              <Tab label="Edit form" value="edit" sx={{ minHeight: 40 }} />
              <Tab label="Fill form" value="fill" sx={{ minHeight: 40 }} />
              <Tab label="JSON" value="json" sx={{ minHeight: 40 }} />
            </Tabs>

            <Stack direction="row" sx={{ ml: 'auto', gap: 1, pb: 0.5 }}>
              {selected && (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    href={fileUrl(selected.id, true)}
                  >
                    Download
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    href={fileUrl(selected.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </Button>
                </>
              )}
              {selected?.status === 'uploaded' && (
                <Button
                  size="small"
                  variant="contained"
                  color="secondary"
                  disabled={converting}
                  onClick={retryConvert}
                >
                  {converting ? 'Converting…' : 'Retry conversion'}
                </Button>
              )}
            </Stack>
          </Stack>

          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {tab === 'view' && <PdfViewer documentId={selectedId} />}
            {tab === 'analyze' && <TextAnalyzer documentId={selectedId} />}
            {tab === 'edit' && (
              <FormBuilder
                sourceDocumentId={selectedId}
                onExported={newId => loadDocuments(newId)}
              />
            )}
            {tab === 'fill' && (
              <PdfFormFiller
                documentId={selectedId}
                onSaved={newId => loadDocuments(newId)}
              />
            )}
            {tab === 'json' && (
              <JsonWorkspace
                documentId={selectedId}
                onSaved={() => loadDocuments(selectedId ?? undefined)}
              />
            )}
          </Box>
        </Box>
      </Stack>
    </Box>
  )
}
