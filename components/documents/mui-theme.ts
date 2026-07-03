'use client'

import { createTheme } from '@mui/material/styles'

// Scoped MUI theme for the Documents feature. Dark mode follows the app-wide
// next-themes class ("dark") applied to <html>.
export const documentsTheme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: { light: true, dark: true },
  typography: {
    fontFamily: 'inherit'
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true }
    }
  }
})
