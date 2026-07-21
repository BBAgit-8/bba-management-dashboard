'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabaseClient'

export default function HubConfirmPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Activating your account…')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Supabase can redirect with an error in the URL query (expired invite,
    // access denied, etc.) — surface it instead of leaving the user staring at
    // a spinner.
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const urlError =
        params.get('error_description') || params.get('error') ||
        hashParams.get('error_description') || hashParams.get('error')
      if (urlError) {
        setStatus(decodeURIComponent(urlError.replace(/\+/g, ' ')))
        return
      }
    }

    // Any of these events can be the first indication the invite link produced
    // a valid session. Historically we only handled SIGNED_IN, but Supabase JS
    // v2 fires INITIAL_SESSION when the SDK restores a session from the URL
    // hash before our listener attaches — which left new invitees stuck on a
    // spinner. Treat any event that yields a session as "we're authenticated,
    // show the password form."
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        setStatus('Account activated! Set a password to finish.')
        setNeedsPassword(true)
      } else if (event === 'USER_UPDATED' && session) {
        router.replace('/hub/dashboard')
      }
    })

    // Also check synchronously — if the SDK already established the session
    // before we attached the listener, no event will fire.
    supabaseClient.auth.getSession().then(({ data }) => {
      if (data.session) setNeedsPassword(true)
    })

    // Fallback: if nothing produces a session in 10s, tell the user instead
    // of spinning forever.
    const timeout = setTimeout(() => {
      setNeedsPassword(prev => {
        if (!prev) {
          setStatus('This invite link may have expired. Please ask your admin to resend it.')
        }
        return prev
      })
    }, 10_000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router])

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    
    // First update the password
    const { error: updateError } = await supabaseClient.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Get current user's email and sign in fresh so session is fully established
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (user?.email) {
      await supabaseClient.auth.signInWithPassword({ email: user.email, password })
    }

    // Small delay to ensure session is written to localStorage before navigation
    await new Promise(resolve => setTimeout(resolve, 500))
    router.replace('/hub/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-purple-900 to-purple-800 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-1">
            <img src="/bba-logo-purple.png" alt="BBA Bookkeeping" className="h-36 w-auto mix-blend-screen" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#b20476" }}>BBA Client Hub</h1>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          {!needsPassword ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-bba-action border-t-transparent" />
              <p className="text-sm text-slate-600">{status}</p>
            </div>
          ) : (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm font-semibold text-slate-700">Set your password</p>
                <p className="text-xs text-slate-500 mt-1">Choose a password to access your BBA Hub account</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Password</label>
                <input type="password" required minLength={8} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters" autoFocus autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bba-action" />
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-bba-action py-2.5 text-sm font-semibold text-white hover:bg-purple-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {loading ? 'Saving…' : 'Activate Account'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-xs text-white/40">BBA Bookkeeping · Employee access only</p>
      </div>
    </div>
  )
}
