'use client'

import { Box, Typography } from '@mui/material'

import type { JsonValue } from '@/lib/documents/types'

type JsonTreeProps = {
  value: JsonValue
  name?: string
}

export function JsonTree({ value, name = 'root' }: JsonTreeProps) {
  return (
    <Box sx={{ fontFamily: 'monospace', fontSize: 12 }}>
      <JsonNode name={name} value={value} />
    </Box>
  )
}

function JsonNode({ name, value }: { name: string; value: JsonValue }) {
  if (Array.isArray(value)) {
    return (
      <Box component="details" open sx={{ ml: 1.5 }}>
        <summary>
          {name}: Array({value.length})
        </summary>
        {value.map((child, index) => (
          <JsonNode key={index} name={String(index)} value={child} />
        ))}
      </Box>
    )
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    return (
      <Box component="details" open sx={{ ml: 1.5 }}>
        <summary>
          {name}: Object({entries.length})
        </summary>
        {entries.map(([key, child]) => (
          <JsonNode key={key} name={key} value={child} />
        ))}
      </Box>
    )
  }

  return (
    <Box sx={{ ml: 3 }}>
      <Typography component="span" variant="inherit" color="text.secondary">
        {name}:{' '}
      </Typography>
      <Typography component="span" variant="inherit">
        {JSON.stringify(value)}
      </Typography>
    </Box>
  )
}
