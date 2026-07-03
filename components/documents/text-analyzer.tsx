'use client'

import { useEffect, useState } from 'react'

import {
  Alert,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography
} from '@mui/material'

type TextAnalyzerProps = {
  documentId: string | null
}

export function TextAnalyzer({ documentId }: TextAnalyzerProps) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!documentId) {
      setText(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/documents/${documentId}/analyze`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
        if (!cancelled) setText(data.text ?? '')
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Analysis failed')
          setText(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [documentId])

  if (!documentId) {
    return (
      <Typography variant="body2" color="text.secondary">
        Select a document to analyze extracted text.
      </Typography>
    )
  }

  if (loading) {
    return (
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Analyzing…
        </Typography>
      </Stack>
    )
  }

  if (error) {
    return (
      <Stack sx={{ gap: 1, alignItems: 'flex-start' }}>
        <Alert severity="error">{error}</Alert>
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            if (documentId) {
              setLoading(true)
              fetch(`/api/documents/${documentId}/analyze`)
                .then(r => r.json())
                .then(d => setText(d.text ?? ''))
                .catch(() => setError('Retry failed'))
                .finally(() => setLoading(false))
            }
          }}
        >
          Retry
        </Button>
      </Stack>
    )
  }

  return (
    <Paper
      variant="outlined"
      component="pre"
      sx={{
        m: 0,
        p: 2,
        fontSize: 14,
        fontFamily: 'inherit',
        whiteSpace: 'pre-wrap',
        maxHeight: '60vh',
        overflow: 'auto',
        bgcolor: 'action.hover'
      }}
    >
      {text?.trim() ? text : '(No extractable text found)'}
    </Paper>
  )
}
