import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy-initialize so a missing env var surfaces as a per-request error
// with useful context, instead of throwing at module load and 500-ing
// the entire Worker on Cloudflare.
let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (_client) return _client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      `Supabase env not populated at runtime: ` +
      `SUPABASE_URL=${url ? 'set' : 'MISSING'} ` +
      `SUPABASE_SERVICE_ROLE_KEY=${key ? 'set' : 'MISSING'} ` +
      `(process.env keys: ${Object.keys(process.env).sort().join(',') || '<empty>'})`
    )
  }
  _client = createClient(url, key)
  return _client
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient()
    const v = (c as unknown as Record<string | symbol, unknown>)[prop as string]
    return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(c) : v
  }
})
