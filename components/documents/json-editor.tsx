'use client'

import { useEffect, useState } from 'react'

import { Alert, Button, Stack, TextField } from '@mui/material'

import type { JsonValue } from '@/lib/documents/types'

type JsonEditorProps = {
  value: JsonValue | null
  onSave: (jsonText: string) => Promise<void>
}

export function JsonEditor({ value, onSave }: JsonEditorProps) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setText(value === null ? '' : JSON.stringify(value, null, 2))
    setError(null)
  }, [value])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      JSON.parse(text)
      await onSave(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack sx={{ gap: 1.5, alignItems: 'flex-start' }}>
      <TextField
        multiline
        fullWidth
        minRows={14}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder='{"example": true}'
        slotProps={{
          input: {
            sx: { fontFamily: 'monospace', fontSize: 12 }
          }
        }}
      />
      <Button variant="contained" onClick={save} disabled={saving || !text.trim()}>
        {saving ? 'Saving…' : 'Save JSON'}
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  )
}
