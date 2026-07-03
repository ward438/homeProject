import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getDocumentById, setDocumentJson } from '@/lib/documents/db'
import {
  normalizeJsonForStorage,
  safeParseJson,
  summarizeJson
} from '@/lib/documents/json'
import type { JsonValue } from '@/lib/documents/types'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const document = await getDocumentById(userId, id)
    if (!document) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const json = (document.jsonData ?? null) as JsonValue | null
    return NextResponse.json({
      json,
      summary: json ? summarizeJson(json) : null
    })
  } catch (error) {
    console.error('[documents json GET]', error)
    return NextResponse.json(
      { error: 'Failed to read JSON' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const document = await getDocumentById(userId, id)
    if (!document) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = (await req.json()) as unknown
    let json: JsonValue

    if (
      body &&
      typeof body === 'object' &&
      'jsonText' in body &&
      typeof (body as { jsonText?: unknown }).jsonText === 'string'
    ) {
      const parsed = safeParseJson((body as { jsonText: string }).jsonText)
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 })
      }
      json = parsed.value
    } else {
      json = normalizeJsonForStorage(body)
    }

    const updated = await setDocumentJson(userId, id, json)

    return NextResponse.json({
      document: updated,
      json,
      summary: summarizeJson(json)
    })
  } catch (error) {
    console.error('[documents json POST]', error)
    const message = error instanceof Error ? error.message : 'Failed to save JSON'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
