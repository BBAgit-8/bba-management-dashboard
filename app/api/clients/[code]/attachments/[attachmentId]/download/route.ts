import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/require-auth'

// GET /api/clients/[code]/attachments/[attachmentId]/download
// Returns a short-lived signed URL. Bucket is private so anon links won't work.
// The outer [code] slot receives a UUID client id — slug name is shared with
// the sibling handlers under app/api/clients/[code]/.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; attachmentId: string }> }
): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  try {
    const { code: clientId, attachmentId } = await params

    const { data: row, error: selErr } = await supabase
      .from('clientAttachments')
      .select('storagePath, fileName')
      .eq('id', attachmentId)
      .eq('clientId', clientId)
      .single()

    if (selErr || !row) {
      return NextResponse.json({ error: 'attachment not found' }, { status: 404 })
    }

    const { data, error } = await supabase.storage
      .from('client-attachments')
      .createSignedUrl(row.storagePath, 300, { download: row.fileName })

    if (error || !data) {
      console.error('[GET attachment signed url]', error)
      return NextResponse.json({ error: error?.message ?? 'signed url failed' }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'server error' }, { status: 500 })
  }
}
