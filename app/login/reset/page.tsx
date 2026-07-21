'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabaseClient'

/**
 * Landing page for the password-recovery email link. Supabase v2 parses the
 * URL hash on load and, if it's a recovery link, fires a PASSWORD_RECOVERY
 * event and establishes a temporary session. We deliberately do NOT auto-
 * redirect on any-session-detected here (the way /login does) — that would
 * short-circuit the very flow this page exists to complete.
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready,    setReady]    = useState(false)
  const [status,   setStatus]   = useState<'checking' | 'ready' | 'expired'>('checking')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    // Surface URL errors (expired link, denied access, etc.) instead of
    // spinning. Supabase can put them in either the query string or the hash.
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const urlError =
        params.get('error_description') || params.get('error') ||
        hashParams.get('error_description') || hashParams.get('error')
      if (urlError) {
        setStatus('expired')
        setError(decodeURIComponent(urlError.replace(/\+/g, ' ')))
        return
      }
    }

    // Fire on either PASSWORD_RECOVERY (fresh click of the email link) or
    // INITIAL_SESSION with a session (SDK restored the recovery session from
    // hash before our listener attached — same race we fixed on /hub/confirm).
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'INITIAL_SESSION' && session)) {
        setReady(true)
        setStatus('ready')
      }
    })

    // Fallback check — if the session was established before this component
    // even mounted, no event will fire.
    supabaseClient.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true)
        setStatus('ready')
      }
    })

    // Timeout: if nothing produced a session in 8s, the link is likely stale.
    const timeout = setTimeout(() => {
      setStatus(prev => (prev === 'checking' ? 'expired' : prev))
    }, 8_000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords don\u2019t match.')
      return
    }
    setLoading(true); setError(null)

    const { error: updateError } = await supabaseClient.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }
    // Small delay so the session is fully persisted to localStorage before
    // the layout gate on `/` reads it — mirrors what /hub/confirm does.
    await new Promise(r => setTimeout(r, 500))
    router.replace('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-purple-900 to-purple-800 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-1">
            <img src="/bba-logo-purple.png" alt="BBA Bookkeeping" className="h-36 w-auto mix-blend-screen" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#b20476' }}>Set a new password</h1>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          {status === 'checking' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-bba-action border-t-transparent" />
              <p className="text-sm text-slate-600">Verifying your reset link…</p>
            </div>
          )}

          {status === 'expired' && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-slate-700 font-semibold">This reset link isn&rsquo;t valid.</p>
              <p className="text-xs text-slate-500">
                {error ?? 'It may have expired or already been used.'}
              </p>
              <a href="/login/forgot" className="inline-block rounded-lg bg-bba-action px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 transition-colors">
                Request a new link
              </a>
              <div>
                <a href="/login" className="text-xs font-medium text-slate-500 hover:text-bba-action">Back to sign in</a>
              </div>
            </div>
          )}

          {status === 'ready' && ready && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">New password</label>
                <input type="password" required minLength={8} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters" autoFocus autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bba-action" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Confirm password</label>
                <input type="password" required minLength={8} value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Type it again" autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bba-action" />
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-bba-action py-2.5 text-sm font-semibold text-white hover:bg-purple-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {loading ? 'Saving…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-xs text-white/40">BBA Bookkeeping · Admin access only</p>
      </div>
    </div>
  )
}
