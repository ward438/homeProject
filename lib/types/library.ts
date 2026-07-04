import type { LibraryFileItem } from '@/lib/actions/files'
import type { Note } from '@/lib/db/schema'

/** Which tab is currently active in the library panel. */
export type LibraryActiveTab = 'all' | 'notes' | 'files'

/**
 * The item pending deletion in the library panel confirmation dialog.
 * Tracks both the item itself and where the delete was triggered from so
 * we can navigate back to the correct view after the deletion completes.
 */
export type LibraryDeleteConfirmationTarget =
  | { kind: 'note'; item: Note; source: 'library_list' | 'library_detail' }
  | {
      kind: 'file'
      item: LibraryFileItem
      source: 'library_list' | 'library_detail'
    }
