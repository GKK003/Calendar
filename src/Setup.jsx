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
    const { error } =
      mode === 'create'
        ? await supabase.rpc('create_space', { space_name: calName, my_name: name })
        : await supabase.rpc('join_space', { join_code: code, my_name: name })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone()
  }

  return (
    <div className="center">
      <form className="card narrow" onSubmit={submit}>
        <h1>Set up your calendar</h1>
        <div className="seg">
          <button type="button" className={mode === 'create' ? 'on' : ''} onClick={() => setMode('create')}>Start new</button>
          <button type="button" className={mode === 'join' ? 'on' : ''} onClick={() => setMode('join')}>Join with code</button>
        </div>
        <label>Your name<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" /></label>
        {mode === 'create' ? (
          <label>Calendar name<input required value={calName} onChange={(e) => setCalName(e.target.value)} /></label>
        ) : (
          <label>Invite code<input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 characters" /></label>
        )}
        {mode === 'create' && <p className="muted small">After creating it, you'll see an invite code to send to the people you want to share it with (up to 6 people).</p>}
        {err && <p className="error">{err}</p>}
        <button className="btn primary" disabled={busy}>{mode === 'create' ? 'Create calendar' : 'Join calendar'}</button>
        <button type="button" className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </form>
    </div>
  )
}
