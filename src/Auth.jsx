import { useState } from 'react'
import { supabase } from './supabase.js'

export default function Auth() {
  const [mode, setMode] = useState('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      const fn = mode === 'in' ? supabase.auth.signInWithPassword : supabase.auth.signUp
      const { data, error } = await fn.call(supabase.auth, { email: email.trim(), password })
      if (error) throw error
      if (mode === 'up' && !data.session) setMsg('Check your email to confirm your account, then sign in.')
    } catch (error) {
      setMsg(error.message || 'Could not sign in. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center">
      <form className="card narrow" onSubmit={submit}>
        <div className="logo big">V</div>
        <h1>{mode === 'in' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted">Your shared calendar for work and study.</p>
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label>Password<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></label>
        {msg && <p className="error" role="alert">{msg}</p>}
        <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Sign up'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg('') }}>
          {mode === 'in' ? 'No account yet? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
