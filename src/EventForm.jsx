import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { TYPES } from './lib.js'

const WEEKDAYS = [['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6], ['Sun', 0]]

export default function EventForm({ initial, editing, members, onSave, onDelete, onDeleteSeries, onClose }) {
  const [f, setF] = useState({
    title: initial.title || '',
    date: initial.date,
    type: initial.type || 'work',
    allDay: !initial.start_time && !!editing,
    start: initial.start_time?.slice(0, 5) || '09:00',
    end: initial.end_time?.slice(0, 5) || '10:00',
    note: initial.note || '',
    repeatDays: [],
    repeatWeeks: 12,
  })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const toggleDay = (n) => setF((p) => ({ ...p, repeatDays: p.repeatDays.includes(n) ? p.repeatDays.filter((x) => x !== n) : [...p.repeatDays, n] }))
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
          <div className="repeat">
            <span className="lbl">Repeat every week on</span>
            <div className="wd">
              {WEEKDAYS.map(([label, n]) => (
                <button type="button" key={n} className={f.repeatDays.includes(n) ? 'on' : ''} onClick={() => toggleDay(n)}>{label}</button>
              ))}
            </div>
            {f.repeatDays.length > 0 ? (
              <label>For how long
                <select value={f.repeatWeeks} onChange={(e) => set('repeatWeeks', Number(e.target.value))}>
                  {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? 'week' : 'weeks'}</option>)}
                </select>
              </label>
            ) : (
              <p className="muted small">Pick days to repeat. Leave empty for a one-time event.</p>
            )}
          </div>
        )}

        {editing && initial.series_id && <p className="muted small">Part of a repeating series. Edits here change only this day.</p>}
        {owner && <p className="muted small">Added by {owner.display_name}</p>}

        <div className="actions">
          {editing && <button type="button" className="btn danger" onClick={onDelete}><Trash2 size={16} /> {initial.series_id ? 'Delete this day' : 'Delete'}</button>}
          {editing && initial.series_id && <button type="button" className="btn danger solid" onClick={onDeleteSeries}><Trash2 size={16} /> Delete all</button>}
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  )
}
