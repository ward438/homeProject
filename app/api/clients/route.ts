import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import {
  createClient,
  deleteClient,
  getClient,
  listClients
} from '@/lib/invoices/db'

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const list = await listClients(userId)
    return NextResponse.json({ clients: list })
  } catch (error) {
    console.error('[clients GET]', error)
    return NextResponse.json(
      { error: 'Failed to list clients' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, email, address, phone } = body as {
      name?: string
      email?: string
      address?: string
      phone?: string
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const client = await createClient(userId, {
      name: name.trim(),
      email: email ?? null,
      address: address ?? null,
      phone: phone ?? null
    })

    return NextResponse.json({ client }, { status: 201 })
  } catch (error) {
    console.error('[clients POST]', error)
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const existing = await getClient(userId, id)
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const result = await deleteClient(userId, id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[clients DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete client' },
      { status: 500 }
    )
  }
}
