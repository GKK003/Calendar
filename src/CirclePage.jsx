import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, Copy, UsersRound } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { zoneLabel, zoneOfCity } from './lib.js'
import './circle.css'

export default function CirclePage({ space, me, members, colorOf, onEditProfile, onOpenPerson }) {
  const [copied, setCopied] = useState(false)
  const [copying, setCopying] = useState(false)
  const [copyError, setCopyError] = useState('')
  const copyTimer = useRef(null)

  useEffect(() => () => clearTimeout(copyTimer.current), [])

  async function copyCode() {
    if (copying) return
    setCopying(true)
    setCopied(false)
    setCopyError('')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable.')
      await navigator.clipboard.writeText(space.code)
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
      setCopyError('Could not copy automatically. You can select and copy the code.')
    } finally {
      setCopying(false)
    }
  }

  return (
    <div className="circle-page">
      <header className="circle-page-heading">
        <span className="circle-page-icon"><UsersRound size={21} /></span>
        <div>
          <p className="circle-eyebrow">YOUR SHARED SPACE</p>
          <h1>{space.name || 'Your circle'}</h1>
          <p className="muted">Manage your profile, members, and invite code here.</p>
        </div>
      </header>

      <section className="card circle-profile-card">
        <Avatar url={me.avatar_url} name={me.display_name} color={colorOf(me.user_id)} size="lg" />
        <div className="circle-profile-copy">
          <p className="circle-eyebrow">YOUR PROFILE</p>
          <h2>{me.display_name}</h2>
          <p className="muted">{me.about || `${zoneLabel(zoneOfCity(me.city))} time`}</p>
        </div>
        <button type="button" className="btn ghost circle-edit-profile" onClick={onEditProfile}>Edit profile</button>
      </section>

      <section className="card circle-invite-card">
        <div>
          <p className="circle-eyebrow">INVITE PEOPLE</p>
          <h2>Share your invite code</h2>
          <p className="muted">People with this code can join your calendar. A circle can have up to six members.</p>
        </div>
        <div className="circle-code-wrap">
          <code className="circle-code">{space.code}</code>
          <button type="button" className="btn primary circle-copy" onClick={copyCode} disabled={copying}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copying ? 'Copying…' : copied ? 'Copied' : 'Copy code'}
          </button>
          {copied && <small className="sr-only" role="status">Invite code copied.</small>}
          {copyError && <small className="circle-copy-error" role="alert">{copyError}</small>}
        </div>
      </section>

      <section className="card circle-members-card">
        <div className="circle-members-heading">
          <div>
            <h2>People in your circle</h2>
            <p className="muted">Open a member profile to see their shared calendar details.</p>
          </div>
          <span className="circle-member-count">{members.length} / 6</span>
        </div>
        <div className="circle-members-list">
          {members.map((person) => (
            <button
              type="button"
              className="circle-member-row"
              key={person.user_id}
              onClick={() => person.user_id === me.user_id ? onEditProfile() : onOpenPerson(person.user_id)}
            >
              <Avatar url={person.avatar_url} name={person.display_name} color={colorOf(person.user_id)} size="md" />
              <span className="circle-member-copy">
                <strong>{person.display_name}{person.user_id === me.user_id ? ' · You' : ''}</strong>
                <small>{person.about || `${zoneLabel(zoneOfCity(person.city))} time`}</small>
              </span>
              <ChevronRight size={17} />
            </button>
          ))}
          {members.length === 0 && <p className="empty">No members found.</p>}
        </div>
      </section>
    </div>
  )
}
