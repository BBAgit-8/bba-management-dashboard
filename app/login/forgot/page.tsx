'use client'

import { useState } from 'react'
import { supabaseClient } from '@/lib/supabaseClient'

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [sent,    setSent]    = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)

    // Build the absolute redirect URL from the current origin. The
    // corresponding URL must be listed under Supabase Auth →
    // "Redirect URLs" or the recovery email link will land on an
    // error page. See handoff notes for the exact allow-list entry.
    const redirectTo = `${window.location.origin}/login/reset`

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo })

    setLoading(false)
    if (error) {
      // Some Supabase configs return the same error whether the email exists
      // or not (to avoid account enumeration). We just surface it verbatim.
      setError(error.message)
      return
    }
    // Show the confirmation card whether or not an account exists — again,
    // to avoid leaking which emails are registered.
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-purple-900 to-purple-800 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-1">
            <img src="/bba-logo-purple.png" alt="BBA Bookkeeping" className="h-36 w-auto mix-blend-screen" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#b20476' }}>Reset password</h1>
          <p className="text-sm text-white/60">We&rsquo;ll email you a link to set a new one.</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-bba-action" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-slate-700">
                If an account exists for <span className="font-semibold">{email}</span>, a reset link is on its way.
              </p>
              <p className="text-xs text-slate-500">
                Check spam if it doesn&rsquo;t arrive in a minute or two.
              </p>
              <a href="/login" className="inline-block text-xs font-medium text-bba-action hover:underline">Back to sign in</a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@bbabookkeeping.com" autoComplete="email" autoFocus
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bba-action focus:border-transparent" />
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-bba-action py-2.5 text-sm font-semibold text-white hover:bg-purple-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
              <div className="text-center">
                <a href="/login" className="text-xs font-medium text-slate-500 hover:text-bba-action">Back to sign in</a>
              </div>
            </form>
          )}
        </div>
        <p className="text-center text-xs text-white/40">BBA Bookkeeping · Admin access only</p>
      </div>
    </div>
  )
}
