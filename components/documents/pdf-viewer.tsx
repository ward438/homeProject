'use client'

import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

import { Alert, Box, Button, Stack, Typography } from '@mui/material'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const MAX_PAGE_WIDTH = 900

type PdfViewerProps = {
  documentId: string | null
}

export function PdfViewer({ documentId }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Size the rendered page to the viewer, so proportions match the real PDF.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setContainerWidth(el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [documentId])

  if (!documentId) {
    return (
      <Typography variant="body2" color="text.secondary">
        Select a document to preview its PDF.
      </Typography>
    )
  }

  const url = `/api/documents/${documentId}/file?variant=pdf`
  const pageWidth = containerWidth
    ? Math.min(containerWidth, MAX_PAGE_WIDTH)
    : undefined

  return (
    <Stack sx={{ gap: 1.5 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
        <Button
          variant="outlined"
          size="small"
          disabled={page <= 1}
          onClick={() => setPage(p => p - 1)}
        >
          Prev
        </Button>
        <Typography variant="body2" color="text.secondary">
          Page {page} of {numPages || '?'}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          disabled={numPages > 0 && page >= numPages}
          onClick={() => setPage(p => p + 1)}
        >
          Next
        </Button>
      </Stack>

      <Box ref={containerRef} sx={{ width: '100%' }}>
        {pageWidth && (
          <Box
            sx={{
              overflow: 'auto',
              maxHeight: '70vh',
              width: pageWidth,
              mx: 'auto',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'common.white'
            }}
          >
            <Document
              file={url}
              onLoadSuccess={({ numPages: n }) => {
                setNumPages(n)
                setPage(1)
              }}
              loading={
                <Typography variant="body2" sx={{ p: 2 }}>
                  Loading PDF…
                </Typography>
              }
              error={
                <Alert severity="error" sx={{ m: 2 }}>
                  Could not load PDF. Try converting the document first.
                </Alert>
              }
            >
              <Page pageNumber={page} width={pageWidth} />
            </Document>
          </Box>
        )}
      </Box>
    </Stack>
  )
}
