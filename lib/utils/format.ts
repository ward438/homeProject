import { stripMarkdownText } from './markdown'

/**
 * Format a date value to a compact human-readable string like "Jun 12, 02:30 PM".
 */
export function formatNoteDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

/**
 * Return a plain-text excerpt (first 140 characters) from markdown content.
 */
export function getExcerpt(content: string): string {
  return stripMarkdownText(content).slice(0, 140)
}

/**
 * Format a byte count to a human-readable size string (B / KB / MB).
 */
export function formatBytes(value: number | null): string {
  if (!value) return 'Unknown size'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
