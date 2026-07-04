export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024 // 20MB

export const ALLOWED_MIMES = [
  'application/pdf',
  'text/plain',
  'application/json',
  'text/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
] as const
export const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword'
}

export function getStorageRoot(): string {
  const configured = process.env.DOCUMENTS_STORAGE_PATH ?? './storage'
  return configured.startsWith('/')
    ? configured
    : `${process.cwd()}/${configured.replace(/^\.\//, '')}`
}

export function getGotenbergUrl(): string {
  return process.env.GOTENBERG_URL ?? 'http://localhost:3001'
}
