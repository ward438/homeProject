'use client'

import { useEffect, useState } from 'react'

import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material'

import type { PdfFillValues } from '@/lib/documents/form-fill'
import type { PdfFormFieldInfo } from '@/lib/documents/types'

type PdfFormFillerProps = {
  documentId: string | null
  onSaved: (documentId?: string) => void
}

export function PdfFormFiller({ documentId, onSaved }: PdfFormFillerProps) {
  const [fields, setFields] = useState<PdfFormFieldInfo[]>([])
  const [values, setValues] = useState<PdfFillValues>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!documentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFields([])
      setValues({})
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setSuccess(null)

    fetch(`/api/documents/${documentId}/form-fields`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to read fields')
        if (cancelled) return

        const nextFields = (data.fields ?? []) as PdfFormFieldInfo[]
        setFields(nextFields)
        setValues(
          Object.fromEntries(
            nextFields.map(field => [field.name, field.value ?? ''])
          )
        )
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to read fields')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [documentId])

  async function saveFilledCopy() {
    if (!documentId) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/documents/${documentId}/fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values, saveAs: 'copy' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save filled PDF')

      setSuccess('Saved filled PDF copy')
      onSaved(data.document?.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save filled PDF')
    } finally {
      setSaving(false)
    }
  }

  if (!documentId) {
    return (
      <Typography variant="body2" color="text.secondary">
        Select a PDF to fill its interactive form fields.
      </Typography>
    )
  }

  if (loading) {
    return (
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Reading fields…
        </Typography>
      </Stack>
    )
  }

  if (fields.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No fillable PDF fields found.
      </Typography>
    )
  }

  return (
    <Stack sx={{ gap: 2, alignItems: 'flex-start' }}>
      <Stack sx={{ gap: 1.5, width: '100%' }}>
        {fields.map(field => (
          <Paper key={field.name} variant="outlined" sx={{ p: 1.5 }}>
            {field.type === 'checkbox' ? (
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={Boolean(values[field.name])}
                    onChange={e =>
                      setValues(current => ({
                        ...current,
                        [field.name]: e.target.checked
                      }))
                    }
                  />
                }
                label={field.name}
              />
            ) : field.type === 'dropdown' || field.type === 'radio' ? (
              <FormControl fullWidth size="small">
                <InputLabel>{field.name}</InputLabel>
                <Select
                  label={field.name}
                  value={String(values[field.name] ?? '')}
                  onChange={e =>
                    setValues(current => ({
                      ...current,
                      [field.name]: e.target.value
                    }))
                  }
                >
                  <MenuItem value="">
                    <em>Select…</em>
                  </MenuItem>
                  {(field.options ?? []).map(option => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <TextField
                fullWidth
                size="small"
                label={field.name}
                value={String(values[field.name] ?? '')}
                onChange={e =>
                  setValues(current => ({
                    ...current,
                    [field.name]: e.target.value
                  }))
                }
              />
            )}
          </Paper>
        ))}
      </Stack>

      <Button variant="contained" onClick={saveFilledCopy} disabled={saving}>
        {saving ? 'Saving…' : 'Save filled PDF copy'}
      </Button>

      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
    </Stack>
  )
}
