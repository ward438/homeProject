'use client'

import { useCallback, useRef, useState } from 'react'

import UploadFileIcon from '@mui/icons-material/UploadFile'
import { Alert, Box, Button, Typography } from '@mui/material'

type DocumentUploadProps = {
  onUploaded: () => void
  disabled?: boolean
}

export function DocumentUpload({ onUploaded, disabled }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true)
      setError(null)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error ?? 'Upload failed')
        }
        onUploaded()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [onUploaded]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) uploadFile(file)
    },
    [uploadFile]
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box
        onDragOver={e => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        sx={{
          border: '1px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          bgcolor: dragOver ? 'action.hover' : 'transparent',
          borderRadius: 2,
          p: 3,
          textAlign: 'center',
          transition: theme =>
            theme.transitions.create(['border-color', 'background-color'])
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Drop PDF, TXT, DOCX, or JSON here
        </Typography>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.docx,.doc,.json,application/json"
          style={{ display: 'none' }}
          disabled={disabled || uploading}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) uploadFile(file)
            e.target.value = ''
          }}
        />
        <Button
          variant="outlined"
          size="small"
          startIcon={<UploadFileIcon />}
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? 'Uploading…' : 'Choose files'}
        </Button>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
    </Box>
  )
}
