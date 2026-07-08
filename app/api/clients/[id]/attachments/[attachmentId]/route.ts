import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// DELETE /api/clients/[id]/attachments/[attachmentId]

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
): Promise<NextResponse> {
  try {
    const { id: clientId, attachmentId } = await params

    // Look up the row so we know the storagePath
    const { data: row, error: selErr } = await supabase
      .from('clientAttachments')
      .select('storagePath')
      .eq('id', attachmentId)
      .eq('clientId', clientId)
      .single()

    if (selErr || !row) {
      return NextResponse.json({ error: 'attachment not found' }, { status: 404 })
    }

    // Remove from storage
    const { error: rmErr } = await supabase.storage
      .from('client-attachments')
      .remove([row.storagePath])
    if (rmErr) {
      // Log but don't hard-fail — DB row cleanup is more important
      console.warn('[DELETE attachment storage]', rmErr)
    }

    // Remove DB row
    const { error: delErr } = await supabase
      .from('clientAttachments')
      .delete()
      .eq('id', attachmentId)
      .eq('clientId', clientId)

    if (delErr) {
      console.error('[DELETE attachment db]', delErr)
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'server error' }, { status: 500 })
  }
}
