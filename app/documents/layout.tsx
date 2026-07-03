import { ThemeProvider } from '@mui/material/styles'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter'

import { documentsTheme } from '@/components/documents/mui-theme'

export default function DocumentsLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui-docs' }}>
      <ThemeProvider theme={documentsTheme}>{children}</ThemeProvider>
    </AppRouterCacheProvider>
  )
}
