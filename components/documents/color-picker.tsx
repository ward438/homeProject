'use client'

import Box from '@mui/material/Box'
import InputBase from '@mui/material/InputBase'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useRef, useState } from 'react'

interface ColorPickerProps {
  label: string
  value?: string
  onChange: (hex: string) => void
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [local, setLocal] = useState(value || '#ffffff')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep local in sync when the prop changes externally
  useEffect(() => {
    setLocal(value || '#ffffff')
  }, [value])

  const handleChange = useCallback(
    (raw: string) => {
      const clean = raw.startsWith('#') ? raw : `#${raw}`
      setLocal(clean)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => onChange(clean), 80)
    },
    [onChange]
  )

  return (
    <Box>
      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 24,
            height: 24,
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.18)',
            bgcolor: local,
            cursor: 'pointer',
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden'
          }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="color"
            value={local}
            onChange={e => handleChange(e.target.value)}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0,
              width: '100%',
              height: '100%',
              cursor: 'pointer',
              border: 'none',
              padding: 0
            }}
          />
        </Box>
        <InputBase
          value={local}
          onChange={e => handleChange(e.target.value)}
          inputProps={{ maxLength: 7, spellCheck: false }}
          sx={{
            flex: 1,
            bgcolor: 'rgba(255,255,255,0.06)',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.12)',
            px: 1,
            py: 0.25,
            fontSize: 12,
            fontFamily: 'monospace',
            color: 'rgba(255,255,255,0.85)',
            '& input': { py: 0 }
          }}
        />
      </Box>
    </Box>
  )
}
