import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

// GET  /api/clients/[id]/attachments — list attachments for a client
// POST /api/clients/[id]/attachments — upload a file (multipart/form-data, field: file)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('clientAttachments')
      .select('id, fileName, fileSize, mimeType, uploadedAt, uploadedBy')
      .eq('clientId', id)
      .order('uploadedAt', { ascending: false })
    if (error) {
      console.error('[GET attachments]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ attachments: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: clientId } = await params
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof Blob) || !('name' in file)) {
      return NextResponse.json({ error: 'no file provided' }, { status: 400 })
    }
    const f = file as File

    if (f.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'file exceeds 25 MB' }, { status: 400 })
    }

    // Storage path: {clientId}/{uuid}-{safeName}
    const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storageId = crypto.randomUUID()
    const storagePath = `${clientId}/${storageId}-${safeName}`

    // Upload to storage bucket
    const buffer = Buffer.from(await f.arrayBuffer())
    const { error: upErr } = await supabase.storage
      .from('client-attachments')
      .upload(storagePath, buffer, {
        contentType: f.type || 'application/octet-stream',
        upsert: false,
      })
    if (upErr) {
      console.error('[POST attachment storage]', upErr)
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    // Insert row
    const attachmentId = crypto.randomUUID()
    const { data, error: insErr } = await supabase
      .from('clientAttachments')
      .insert({
        id: attachmentId,
        clientId,
        fileName: f.name,
        fileSize: f.size,
        mimeType: f.type || null,
        storagePath,
      })
      .select('id, fileName, fileSize, mimeType, uploadedAt, uploadedBy')
      .single()

    if (insErr) {
      // Clean up storage if DB insert failed
      await supabase.storage.from('client-attachments').remove([storagePath])
      console.error('[POST attachment db]', insErr)
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({ attachment: data })
  } catch (err: any) {
    console.error('[POST attachment]', err)
    return NextResponse.json({ error: err?.message ?? 'server error' }, { status: 500 })
  }
}
