import { createId } from '@paralleldrive/cuid2'
import fs from 'fs/promises'
import path from 'path'

import { getStorageRoot } from './constants'

export function getDocumentDir(userId: string, documentId: string): string {
  return path.join(getStorageRoot(), userId, documentId)
}

export async function ensureDocumentDir(
  userId: string,
  documentId: string
): Promise<string> {
  const dir = getDocumentDir(userId, documentId)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
}

export async function saveOriginalFile(
  userId: string,
  documentId: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const dir = await ensureDocumentDir(userId, documentId)
  const safeName = sanitizeFilename(filename)
  const filePath = path.join(dir, `original-${safeName}`)
  await fs.writeFile(filePath, buffer)
  return filePath
}

export async function savePdfFile(
  userId: string,
  documentId: string,
  buffer: Buffer,
  suffix = 'converted'
): Promise<string> {
  const dir = await ensureDocumentDir(userId, documentId)
  const filePath = path.join(dir, `${suffix}.pdf`)
  await fs.writeFile(filePath, buffer)
  return filePath
}

export async function deleteDocumentDir(
  userId: string,
  documentId: string
): Promise<void> {
  const dir = getDocumentDir(userId, documentId)
  await fs.rm(dir, { recursive: true, force: true })
}

export async function readFileBuffer(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath)
}

export async function writeFileBuffer(
  filePath: string,
  buffer: Buffer
): Promise<void> {
  await fs.writeFile(filePath, buffer)
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export function createDocumentId(): string {
  return createId()
}

export function getMimeFromFilename(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase()
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword'
  }
  return map[ext] ?? null
}

export function resolveRelativePath(absolutePath: string): string {
  const root = getStorageRoot()
  return path.relative(root, absolutePath)
}

export function resolveAbsolutePath(relativeOrAbsolute: string): string {
  if (path.isAbsolute(relativeOrAbsolute)) {
    return relativeOrAbsolute
  }
  return path.join(getStorageRoot(), relativeOrAbsolute)
}
