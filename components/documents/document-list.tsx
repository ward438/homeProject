'use client'

import { useState } from 'react'

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import DownloadIcon from '@mui/icons-material/Download'
import EditIcon from '@mui/icons-material/Edit'
import DataObjectIcon from '@mui/icons-material/DataObject'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import VisibilityIcon from '@mui/icons-material/Visibility'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography
} from '@mui/material'

import type { DocumentRecord } from '@/lib/documents/types'

type DocumentListProps = {
  documents: DocumentRecord[]
  selectedId: string | null
  onSelect: (id: string) => void
  onView: (id: string) => void
  onEdit: (id: string) => void
  onFill: (id: string) => void
  onJson: (id: string) => void
  onDeleted: (id: string) => void
  onRefresh: () => void
  loading?: boolean
}

function downloadUrl(id: string) {
  return `/api/documents/${id}/file?variant=pdf&download=1`
}

function statusLabel(status: DocumentRecord['status']) {
  if (status === 'ready') return 'Ready'
  if (status === 'converted') return 'Converted'
  return 'Needs conversion'
}

export function DocumentList({
  documents,
  selectedId,
  onSelect,
  onView,
  onEdit,
  onFill,
  onJson,
  onDeleted,
  onRefresh,
  loading
}: DocumentListProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [menuDocId, setMenuDocId] = useState<string | null>(null)
  const [confirmDoc, setConfirmDoc] = useState<DocumentRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const menuDoc = documents.find(d => d.id === menuDocId) ?? null

  function openMenu(e: React.MouseEvent<HTMLElement>, docId: string) {
    e.stopPropagation()
    setMenuAnchor(e.currentTarget)
    setMenuDocId(docId)
  }

  function closeMenu() {
    setMenuAnchor(null)
    setMenuDocId(null)
  }

  function menuAction(action: (id: string) => void) {
    if (menuDocId) action(menuDocId)
    closeMenu()
  }

  async function handleDelete() {
    if (!confirmDoc) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/documents/${confirmDoc.id}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Delete failed')
      }
      const deletedId = confirmDoc.id
      setConfirmDoc(null)
      onDeleted(deletedId)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
      >
        <Typography variant="subtitle2" component="h2">
          Files
        </Typography>
        <Button size="small" onClick={onRefresh} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading && documents.length === 0 && (
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, p: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Loading…
            </Typography>
          </Stack>
        )}
        {!loading && documents.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
            No documents yet.
          </Typography>
        )}

        <List dense disablePadding>
          {documents.map(doc => (
            <ListItemButton
              key={doc.id}
              selected={selectedId === doc.id}
              onClick={() => onSelect(doc.id)}
              sx={{ borderRadius: 1, mb: 0.5, alignItems: 'flex-start' }}
            >
              <ListItemText
                primary={doc.originalFilename}
                slotProps={{
                  primary: {
                    noWrap: true,
                    sx: { fontWeight: 500, fontSize: 14 }
                  },
                  secondary: { component: 'span' }
                }}
                secondary={
                  <Stack
                    direction="row"
                    component="span"
                    sx={{ alignItems: 'center', gap: 1, mt: 0.25 }}
                  >
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                    >
                      {statusLabel(doc.status)}
                    </Typography>
                    {doc.jsonData ? (
                      <Chip
                        label="JSON"
                        size="small"
                        variant="outlined"
                        sx={{ height: 18, fontSize: 10 }}
                      />
                    ) : null}
                  </Stack>
                }
              />
              <IconButton
                size="small"
                edge="end"
                aria-label="Document actions"
                onClick={e => openMenu(e, doc.id)}
                sx={{ ml: 0.5, mt: 0.25 }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </ListItemButton>
          ))}
        </List>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => menuAction(onView)}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          View
        </MenuItem>
        <MenuItem
          component="a"
          href={menuDocId ? downloadUrl(menuDocId) : '#'}
          onClick={closeMenu}
        >
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          Download
        </MenuItem>
        <MenuItem onClick={() => menuAction(onEdit)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          Edit form
        </MenuItem>
        <MenuItem onClick={() => menuAction(onFill)}>
          <ListItemIcon>
            <DriveFileRenameOutlineIcon fontSize="small" />
          </ListItemIcon>
          Fill form
        </MenuItem>
        <MenuItem onClick={() => menuAction(onJson)}>
          <ListItemIcon>
            <DataObjectIcon fontSize="small" />
          </ListItemIcon>
          JSON
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuDoc) {
              setDeleteError(null)
              setConfirmDoc(menuDoc)
            }
            closeMenu()
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'error.main' }}>
            <DeleteOutlineIcon fontSize="small" />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>

      <Dialog
        open={Boolean(confirmDoc)}
        onClose={() => (deleting ? null : setConfirmDoc(null))}
      >
        <DialogTitle>Delete document?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete “{confirmDoc?.originalFilename}”? This cannot be undone.
          </DialogContentText>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDoc(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
