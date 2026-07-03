'use client'

import { useEffect, useRef, useState } from 'react'

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material'

import type { JsonSummary, JsonValue } from '@/lib/documents/types'

import { JsonEditor } from './json-editor'
import { JsonInferredPreview } from './json-inferred-preview'
import { JsonTree } from './json-tree'

type JsonWorkspaceProps = {
  documentId: string | null
  onSaved: () => void
}

type View = 'tree' | 'raw' | 'preview'

export function JsonWorkspace({ documentId, onSaved }: JsonWorkspaceProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [json, setJson] = useState<JsonValue | null>(null)
  const [summary, setSummary] = useState<JsonSummary | null>(null)
  const [view, setView] = useState<View>('tree')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadJson() {
    if (!documentId) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/documents/${documentId}/json`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load JSON')
      setJson(data.json ?? null)
      setSummary(data.summary ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load JSON')
    } finally {
      setLoading(false)
    }
  }

  async function saveJsonText(jsonText: string) {
    if (!documentId) return

    const res = await fetch(`/api/documents/${documentId}/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonText })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to save JSON')
    setJson(data.json)
    setSummary(data.summary)
    onSaved()
  }

  async function uploadJsonFile(file: File) {
    const text = await file.text()
    await saveJsonText(text)
  }

  useEffect(() => {
    setJson(null)
    setSummary(null)
    setError(null)
    if (documentId) loadJson()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  if (!documentId) {
    return (
      <Typography variant="body2" color="text.secondary">
        Select a document to attach or render JSON.
      </Typography>
    )
  }

  return (
    <Stack sx={{ gap: 2 }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) uploadJsonFile(file).catch(err => setError(err.message))
            e.target.value = ''
          }}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={() => inputRef.current?.click()}
        >
          Upload JSON
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={loadJson}
          disabled={loading}
        >
          Refresh
        </Button>
        {summary && (
          <Chip
            variant="outlined"
            size="small"
            label={`${summary.objects} objects, ${summary.arrays} arrays, ${summary.scalars} values`}
          />
        )}
      </Stack>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={view}
        onChange={(_, next: View | null) => {
          if (next) setView(next)
        }}
      >
        <ToggleButton value="tree">Tree</ToggleButton>
        <ToggleButton value="raw">Raw editor</ToggleButton>
        <ToggleButton value="preview">Preview</ToggleButton>
      </ToggleButtonGroup>

      {error && <Alert severity="error">{error}</Alert>}
      {loading && (
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        </Stack>
      )}

      {view === 'raw' ? (
        <JsonEditor value={json} onSave={saveJsonText} />
      ) : !json ? (
        <Typography variant="body2" color="text.secondary">
          No JSON attached yet. Upload a JSON file or paste JSON in the raw
          editor.
        </Typography>
      ) : (
        <Box
          sx={{
            maxHeight: '60vh',
            overflow: 'auto',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: 1.5
          }}
        >
          {view === 'tree' ? (
            <JsonTree value={json} />
          ) : (
            <JsonInferredPreview value={json} />
          )}
        </Box>
      )}
    </Stack>
  )
}
