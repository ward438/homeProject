import type { JsonSummary, JsonValue } from './types'

const MAX_JSON_BYTES = 5 * 1024 * 1024

export function safeParseJson(
  input: string
): { ok: true; value: JsonValue } | { ok: false; error: string } {
  try {
    const value = JSON.parse(input) as unknown
    const normalized = normalizeJsonForStorage(value)
    return { ok: true, value: normalized }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid JSON'
    }
  }
}

export function normalizeJsonForStorage(value: unknown): JsonValue {
  const seen = new WeakSet<object>()

  function normalize(item: unknown): JsonValue {
    if (item === null) return null

    if (
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean'
    ) {
      if (typeof item === 'number' && !Number.isFinite(item)) {
        throw new Error('JSON numbers must be finite')
      }
      return item
    }

    if (Array.isArray(item)) {
      return item.map(normalize)
    }

    if (typeof item === 'object') {
      if (seen.has(item)) {
        throw new Error('Circular JSON values are not supported')
      }
      seen.add(item)

      const output: Record<string, JsonValue> = {}
      for (const [key, child] of Object.entries(item)) {
        if (typeof child === 'undefined' || typeof child === 'function') {
          continue
        }
        output[key] = normalize(child)
      }
      return output
    }

    throw new Error(`Unsupported JSON value: ${typeof item}`)
  }

  const normalized = normalize(value)
  const bytes = new TextEncoder().encode(JSON.stringify(normalized)).length
  if (bytes > MAX_JSON_BYTES) {
    throw new Error('JSON payload is too large (max 5MB)')
  }

  return normalized
}

export function summarizeJson(value: JsonValue): JsonSummary {
  const summary: JsonSummary = {
    objects: 0,
    arrays: 0,
    scalars: 0,
    maxDepth: 0
  }

  function walk(item: JsonValue, depth: number) {
    summary.maxDepth = Math.max(summary.maxDepth, depth)

    if (Array.isArray(item)) {
      summary.arrays += 1
      item.forEach(child => walk(child, depth + 1))
      return
    }

    if (item && typeof item === 'object') {
      summary.objects += 1
      Object.values(item).forEach(child => walk(child, depth + 1))
      return
    }

    summary.scalars += 1
  }

  walk(value, 0)
  return summary
}
