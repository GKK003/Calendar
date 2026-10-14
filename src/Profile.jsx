import { useState } from 'react'
import { Check, LogOut } from 'lucide-react'
import { supabase } from './supabase.js'
import { PALETTE } from './lib.js'

export default function Profile({ session, member, partner, color, onSaved }) {
  const [name, setName] = useState(member.display_name)
  const [col, setCol] = useState(color)
  const [about, setAbout] = useState(member.about || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)

  async function saveProfile(e) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setMsg({ ok: false, text: 'Please enter a name.' })
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.from('members').update({ display_name: n, color: col }).eq('user_id', member.user_id)
    if (error) {
      setBusy(false)
      return setMsg({ ok: false, text: error.message })
    }
    const { error: aboutError } = await supabase.from('members').update({ about: about.trim() || null }).eq('user_id', member.user_id)
    await onSaved()
    setBusy(false)
    setMsg(
      aboutError
        ? { ok: false, text: 'Name and color saved. The status needs one small database update (see README, "Profile").' }
        : { ok: true, text: 'Profile saved.' },
    )
  }

  async function savePassword(e) {
    e.preventDefault()
    setPwMsg(null)
    if (pw.length < 6) return setPwMsg({ ok: false, text: 'Use at least 6 characters.' })
    if (pw !== pw2) return setPwMsg({ ok: false, text: 'The two passwords do not match.' })
    setPwBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setPwBusy(false)
    if (error) return setPwMsg({ ok: false, text: error.message })
    setPw('')
    setPw2('')
    setPwMsg({ ok: true, text: 'Password changed.' })
  }

  return (
    <div className="profile">
      <form className="card pcard" onSubmit={saveProfile}>
        <h2>Your profile</h2>
        <div className="pavatar" style={{ background: col }}>{(name.trim()[0] || '?').toUpperCase()}</div>

        <label>Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
        </label>

        <div className="swatch-wrap">
          <span className="lbl">Your color</span>
          <div className="swatches">
            {PALETTE.map((c) => (
              <button type="button" key={c} style={{ background: c }} onClick={() => setCol(c)} aria-label={'Color ' + c}>
                {col === c && <Check size={16} />}
              </button>
            ))}
          </div>
        </div>

        <label>About me or status
          <input value={about} onChange={(e) => setAbout(e.target.value)} maxLength={60} placeholder="Exam week, send snacks" />
        </label>
        <p className="muted small">{partner ? `${partner.display_name} can see your status next to their greeting.` : 'Your partner will see this once they join.'}</p>

        {msg && <p className={msg.ok ? 'ok' : 'error'}>{msg.text}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
      </form>

      <div className="pside">
        <form className="card pcard" onSubmit={savePassword}>
          <h2>Account</h2>
          <p className="muted small">Signed in as {session.user.email}</p>
          <label>New password
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={6} />
          </label>
          <label>Repeat new password
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" minLength={6} />
          </label>
          {pwMsg && <p className={pwMsg.ok ? 'ok' : 'error'}>{pwMsg.text}</p>}
          <button className="btn primary" disabled={pwBusy || !pw}>{pwBusy ? 'Saving…' : 'Change password'}</button>
        </form>

        <div className="card pcard">
          <button className="btn ghost" onClick={() => supabase.auth.signOut()}><LogOut size={16} /> Sign out</button>
        </div>
      </div>
    </div>
  )
}
