'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabaseClient'

export default function HubLoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [needsPassword, setNeedsPassword] = useState(false)

  useEffect(() => {
    // Safety timeout — if nothing happens in 5s, show login form
    const timeout = setTimeout(() => setChecking(false), 5000)

    // Supabase automatically processes #access_token and ?code= from the URL.
    // Just listen for the auth state change — it fires when the token is exchanged.
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
      clearTimeout(timeout)
      if (event === 'SIGNED_IN' && session) {
        router.replace('/hub/dashboard')
      } else if (event === 'USER_UPDATED' && session) {
        router.replace('/hub/dashboard')
      } else if (event === 'PASSWORD_RECOVERY') {
        setNeedsPassword(true)
        setChecking(false)
      } else if (event === 'INITIAL_SESSION') {
        if (session) {
          router.replace('/hub/dashboard')
        } else {
          const url = window.location.href
          const hasToken = url.includes('access_token') || url.includes('type=invite') || url.includes('code=')
          if (!hasToken) {
            setChecking(false)
          }
        }
      }
    })

    return () => { clearTimeout(timeout); subscription.unsubscribe() }
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Invalid email or password.')
      setLoading(false)
    } else {
      router.replace('/hub/dashboard')
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const { error } = await supabaseClient.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.replace('/hub/dashboard')
    }
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-purple-900 to-purple-800 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-1">
            <img src="/bba-logo-purple.png" alt="BBA Bookkeeping" className="h-36 w-auto mix-blend-screen" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#b20476" }}>BBA Client Hub</h1>
          <p className="text-sm text-white/60">
            {needsPassword ? 'Set a password to activate your account' : 'Sign in to access your client portal'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white p-8 shadow-2xl space-y-5">
          {needsPassword ? (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <p className="text-sm text-slate-600">Choose a password for your BBA Hub account.</p>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">New Password</label>
                <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters" autoFocus autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-purple-700 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {loading ? 'Activating…' : 'Activate Account'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Password</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-purple-700 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-xs text-white/40">BBA Bookkeeping · Employee access only</p>
      </div>
    </div>
  )
}
