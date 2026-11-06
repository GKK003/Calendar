import { useState } from 'react'
import { supabase } from './supabase.js'

export default function Setup({ onDone }) {
  const [mode, setMode] = useState('create')
  const [name, setName] = useState('')
  const [calName, setCalName] = useState('Our calendar')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const { error } =
        mode === 'create'
          ? await supabase.rpc('create_space', { space_name: calName, my_name: name.trim() })
          : await supabase.rpc('join_space', { join_code: code.trim(), my_name: name.trim() })
      if (error) throw error
      await onDone()
    } catch (error) {
      setErr(error.message || 'Could not set up your calendar. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center">
      <form className="card narrow" onSubmit={submit}>
        <h1>Set up your calendar</h1>
        <div className="seg" role="group" aria-label="Calendar setup type">
          <button type="button" className={mode === 'create' ? 'on' : ''} aria-pressed={mode === 'create'} onClick={() => setMode('create')}>Start new</button>
          <button type="button" className={mode === 'join' ? 'on' : ''} aria-pressed={mode === 'join'} onClick={() => setMode('join')}>Join with code</button>
        </div>
        <label>Your name<input required maxLength={30} value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" /></label>
        {mode === 'create' ? (
          <label>Calendar name<input required maxLength={80} value={calName} onChange={(e) => setCalName(e.target.value)} /></label>
        ) : (
          <label>Invite code<input required maxLength={16} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter invite code" autoCapitalize="none" spellCheck={false} /></label>
        )}
        {mode === 'create' && <p className="muted small">After creating it, you'll see an invite code to send to the people you want to share it with (up to 6 people).</p>}
        {err && <p className="error" role="alert">{err}</p>}
        <button type="submit" className="btn primary" disabled={busy}>{mode === 'create' ? 'Create calendar' : 'Join calendar'}</button>
        <button type="button" className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </form>
    </div>
  )
}
