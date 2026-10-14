import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { TYPES } from './lib.js'

export default function EventForm({ initial, editing, members, onSave, onDelete, onClose }) {
  const [f, setF] = useState({
    title: initial.title || '',
    date: initial.date,
    type: initial.type || 'work',
    allDay: !initial.start_time && !!editing,
    start: initial.start_time?.slice(0, 5) || '09:00',
    end: initial.end_time?.slice(0, 5) || '10:00',
    note: initial.note || '',
    repeat: 1,
  })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const owner = editing && members.find((m) => m.user_id === initial.user_id)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    await onSave(f)
    setBusy(false)
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={submit}>
        <div className="sheet-head">
          <h2>{editing ? 'Edit event' : 'New event'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <label>Title
          <input autoFocus required value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Lecture, shift, exam…" />
        </label>

        <div className="chips">
          {Object.entries(TYPES).map(([k, t]) => (
            <button type="button" key={k} className={'chip' + (f.type === k ? ' on' : '')} style={{ '--c': t.color }} onClick={() => set('type', k)}>
              <i /> {t.label}
            </button>
          ))}
        </div>

        <div className="row">
          <label>Date<input type="date" required value={f.date} onChange={(e) => set('date', e.target.value)} /></label>
          <label className="check"><input type="checkbox" checked={f.allDay} onChange={(e) => set('allDay', e.target.checked)} /> All day</label>
        </div>

        {!f.allDay && (
          <div className="row">
            <label>From<input type="time" value={f.start} onChange={(e) => set('start', e.target.value)} /></label>
            <label>To<input type="time" value={f.end} onChange={(e) => set('end', e.target.value)} /></label>
          </div>
        )}

        <label>Note<textarea rows={2} value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="Add note" /></label>

        {!editing && (
          <label>Repeat weekly
            <select value={f.repeat} onChange={(e) => set('repeat', Number(e.target.value))}>
              <option value={1}>Does not repeat</option>
              {[2, 4, 8, 12, 16, 26, 52].map((n) => <option key={n} value={n}>For {n} weeks</option>)}
            </select>
          </label>
        )}

        {owner && <p className="muted small">Added by {owner.display_name}</p>}

        <div className="actions">
          {editing && <button type="button" className="btn danger" onClick={onDelete}><Trash2 size={16} /> Delete</button>}
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  )
}
