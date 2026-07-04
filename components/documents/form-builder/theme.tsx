'use client'

import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'

/** Dark palette tokens used throughout the form builder and rich-text editor. */
export const C = {
  bg: '#0f1115',
  panel: '#171a21',
  panel2: '#1e2230',
  stage: '#0a0c10',
  border: '#2c3140',
  input: '#10131a',
  text: '#e8eaf0',
  muted: '#9aa1b2',
  accent: '#6c9eff',
  accentText: '#0b1020',
  green: '#4cc38a',
  amber: '#e0a83a',
  red: '#e5534b',
  teal: '#2ec4b6',
  purple: '#c084fc'
} as const

/** MUI `sx` prop snippet for dark-themed outlined inputs. */
export const darkInputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: C.input,
    color: C.text,
    fontSize: 13,
    '& fieldset': { borderColor: C.border },
    '&:hover fieldset': { borderColor: C.muted },
    '&.Mui-focused fieldset': { borderColor: C.accent }
  },
  '& .MuiInputLabel-root': { color: C.muted, fontSize: 13 },
  '& .MuiInputLabel-root.Mui-focused': { color: C.accent }
} as const

/** Uppercase section heading used in the inspector panel. */
export function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
        color: C.muted,
        fontWeight: 700,
        mb: 1
      }}
    >
      {children}
    </Typography>
  )
}

/** A 1 px horizontal rule used to separate inspector sections. */
export function SectionDivider() {
  return <Box sx={{ height: '1px', bgcolor: C.border, my: 1 }} />
}

type MockButtonProps = {
  children: React.ReactNode
  primary?: boolean
  danger?: boolean
  dashed?: boolean
  disabled?: boolean
  onClick?: () => void
  sx?: object
}

/**
 * Styled action button that matches the dark form-builder theme.
 * Supports primary (accent fill), danger (red tint), and dashed border variants.
 */
export function MockButton({
  children,
  primary,
  danger,
  dashed,
  disabled,
  onClick,
  sx
}: MockButtonProps) {
  return (
    <ButtonBase
      disabled={disabled}
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        fontSize: 12.5,
        fontWeight: 600,
        px: 1.75,
        py: 0.9,
        borderRadius: '6px',
        border: '1px solid',
        borderStyle: dashed ? 'dashed' : 'solid',
        borderColor: primary
          ? C.accent
          : danger
            ? 'rgba(229,83,75,0.4)'
            : C.border,
        bgcolor: primary ? C.accent : 'transparent',
        color: primary ? C.accentText : danger ? C.red : C.text,
        opacity: disabled ? 0.45 : 1,
        '&:hover': {
          borderColor: primary ? C.accent : danger ? C.red : C.muted
        },
        ...sx
      }}
    >
      {children}
    </ButtonBase>
  )
}
