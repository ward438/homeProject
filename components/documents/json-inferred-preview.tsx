'use client'

import { Box, Paper, Stack, Typography } from '@mui/material'

import type { JsonValue } from '@/lib/documents/types'

type JsonInferredPreviewProps = {
  value: JsonValue
}

export function JsonInferredPreview({ value }: JsonInferredPreviewProps) {
  if (Array.isArray(value)) {
    return (
      <Stack sx={{ gap: 1.5 }}>
        {value.slice(0, 20).map((item, index) => (
          <Paper key={index} variant="outlined" sx={{ p: 1.5 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', fontWeight: 500, mb: 1 }}
            >
              Item {index + 1}
            </Typography>
            <JsonInferredPreview value={item} />
          </Paper>
        ))}
      </Stack>
    )
  }

  if (value && typeof value === 'object') {
    return (
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }
        }}
      >
        {Object.entries(value).map(([key, child]) => (
          <Paper key={key} variant="outlined" sx={{ p: 1.5 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', fontWeight: 500 }}
            >
              {key}
            </Typography>
            <Box sx={{ mt: 0.5, fontSize: 14 }}>
              {isScalar(child) ? (
                String(child)
              ) : (
                <JsonInferredPreview value={child} />
              )}
            </Box>
          </Paper>
        ))}
      </Box>
    )
  }

  return <span>{String(value)}</span>
}

function isScalar(value: JsonValue) {
  return value === null || typeof value !== 'object'
}
