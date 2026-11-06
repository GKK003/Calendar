import { useRef, useState } from 'react'
import { Camera, Check, LogOut, Trash2 } from 'lucide-react'
import { supabase } from './supabase.js'
import { CITIES, PALETTE } from './lib.js'
import { validateImageFile } from './photo.js'
import Avatar from './Avatar.jsx'

// Crop to a centered square and shrink, so phone photos stay small
function toSquareBlob(file, size = 256) {
  const problem = validateImageFile(file)
  if (problem) return Promise.reject(new Error(problem))
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    const release = () => URL.revokeObjectURL(url)
    img.onload = () => {
      try {
        if (!img.width || !img.height || img.width > 12000 || img.height > 12000 || img.width * img.height > 50_000_000) {
          throw new Error('This image is too large to process. Choose a smaller image.')
        }
        const side = Math.min(img.width, img.height)
        const c = document.createElement('canvas')
        c.width = c.height = size
        const context = c.getContext('2d')
        if (!context) throw new Error('Image processing is unavailable in this browser.')
        context.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
        c.toBlob((blob) => {
          release()
          blob ? resolve(blob) : reject(new Error('Could not process this image.'))
        }, 'image/jpeg', 0.85)
      } catch (error) {
        release()
        reject(error)
      }
    }
    img.onerror = () => {
      release()
      reject(new Error('Could not read this image. Try a JPG or PNG.'))
    }
    img.src = url
  })
}

export default function Profile({ session, member, others = [], color, onSaved }) {
  const [name, setName] = useState(member.display_name)
  const [col, setCol] = useState(color)
  const [about, setAbout] = useState(member.about || '')
  const [city, setCity] = useState(member.city || CITIES[0].id)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const fileRef = useRef(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoMsg, setPhotoMsg] = useState(null)

  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)

  async function saveProfile(e) {
    e.preventDefault()
    if (busy) return
    const n = name.trim()
    if (!n || n.length > 30) return setMsg({ ok: false, text: 'Enter a name between 1 and 30 characters.' })
    setBusy(true)
    setMsg(null)
    try {
      const { error } = await supabase.from('members').update({
        display_name: n,
        color: col,
        city,
        about: about.trim() || null,
      }).eq('user_id', member.user_id)
      if (error) throw error
      await onSaved()
      setMsg({ ok: true, text: 'Profile saved.' })
    } catch (error) {
      setMsg({ ok: false, text: error.message || 'Could not save your profile.' })
    } finally {
      setBusy(false)
    }
  }

  async function uploadPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    setPhotoMsg(null)
    try {
      const blob = await toSquareBlob(file)
      const path = `${member.user_id}/avatar.jpg`
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: dbError } = await supabase.from('members').update({ avatar_url: `${data.publicUrl}?v=${Date.now()}` }).eq('user_id', member.user_id)
      if (dbError) throw dbError
      await onSaved()
      setPhotoMsg({ ok: true, text: 'Photo updated.' })
    } catch (err) {
      const missing = /bucket|not found|avatar_url/i.test(err.message || '')
      setPhotoMsg({ ok: false, text: missing ? 'Photos need the database setup in supabase/social.sql.' : err.message })
    } finally {
      setPhotoBusy(false)
    }
  }

  async function removePhoto() {
    setPhotoBusy(true)
    setPhotoMsg(null)
    try {
      const { error: storageError } = await supabase.storage.from('avatars').remove([`${member.user_id}/avatar.jpg`])
      if (storageError) throw storageError
      const { error } = await supabase.from('members').update({ avatar_url: null }).eq('user_id', member.user_id)
      if (error) throw error
      await onSaved()
      setPhotoMsg({ ok: true, text: 'Photo removed.' })
    } catch (error) {
      setPhotoMsg({ ok: false, text: error.message || 'Could not remove the photo.' })
    } finally {
      setPhotoBusy(false)
    }
  }

  async function savePassword(e) {
    e.preventDefault()
    setPwMsg(null)
    if (pw.length < 6) return setPwMsg({ ok: false, text: 'Use at least 6 characters.' })
    if (pw !== pw2) return setPwMsg({ ok: false, text: 'The two passwords do not match.' })
    setPwBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pw })
      if (error) throw error
      setPw('')
      setPw2('')
      setPwMsg({ ok: true, text: 'Password changed.' })
    } catch (error) {
      setPwMsg({ ok: false, text: error.message || 'Could not change your password.' })
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div className="profile">
      <form className="card pcard" onSubmit={saveProfile}>
        <h2>Your profile</h2>
        <div className="photo-row">
          <Avatar url={member.avatar_url} name={name || '?'} color={col} size="lg" />
          <div className="photo-actions">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadPhoto} />
            <button type="button" className="btn ghost" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
              <Camera size={16} /> {photoBusy ? 'Uploading…' : member.avatar_url ? 'Change photo' : 'Upload photo'}
            </button>
            {member.avatar_url && (
              <button type="button" className="btn ghost" disabled={photoBusy} onClick={removePhoto}><Trash2 size={16} /> Remove</button>
            )}
            <p className="muted small">The photo saves right away.</p>
          </div>
        </div>
        {photoMsg && <p className={photoMsg.ok ? 'ok' : 'error'} role={photoMsg.ok ? 'status' : 'alert'} aria-live={photoMsg.ok ? 'polite' : 'assertive'}>{photoMsg.text}</p>}

        <label>Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required />
        </label>

        <div className="swatch-wrap">
          <span className="lbl">Your color</span>
          <div className="swatches" role="group" aria-label="Profile color">
            {PALETTE.map((c) => (
              <button type="button" key={c} style={{ background: c }} onClick={() => setCol(c)} aria-label={'Color ' + c} aria-pressed={col === c}>
                {col === c && <Check size={16} />}
              </button>
            ))}
          </div>
        </div>

        <div className="swatch-wrap">
          <span className="lbl">Where you live</span>
          <div className="seg tiny" role="group" aria-label="Your city">
            {CITIES.map((c) => (
              <button type="button" key={c.id} className={city === c.id ? 'on' : ''} aria-pressed={city === c.id} onClick={() => setCity(c.id)}>{c.label}</button>
            ))}
          </div>
        </div>
        <p className="muted small">Event times are shown in your city's time.</p>

        <label>About me or status
          <input value={about} onChange={(e) => setAbout(e.target.value)} maxLength={60} placeholder="Exam week, send snacks" />
        </label>
        <p className="muted small">{others.length ? `${others.map((o) => o.display_name).join(', ')} can see your status.` : 'Others will see this once they join.'}</p>

        {msg && <p className={msg.ok ? 'ok' : 'error'} role={msg.ok ? 'status' : 'alert'} aria-live={msg.ok ? 'polite' : 'assertive'}>{msg.text}</p>}
        <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
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
          {pwMsg && <p className={pwMsg.ok ? 'ok' : 'error'} role={pwMsg.ok ? 'status' : 'alert'} aria-live={pwMsg.ok ? 'polite' : 'assertive'}>{pwMsg.text}</p>}
          <button type="submit" className="btn primary" disabled={pwBusy || !pw}>{pwBusy ? 'Saving…' : 'Change password'}</button>
        </form>

        <div className="card pcard">
          <button type="button" className="btn ghost" onClick={() => supabase.auth.signOut()}><LogOut size={16} /> Sign out</button>
        </div>
      </div>
    </div>
  )
}
