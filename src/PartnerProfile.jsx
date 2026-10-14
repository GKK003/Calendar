import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from './supabase.js'
import { TYPES, timeLabel, ymd } from './lib.js'
import Avatar from './Avatar.jsx'

function Row({ e, withDate }) {
  return (
    <div className="pev">
      <i style={{ background: TYPES[e.type]?.color }} />
      <div className="pev-main">
        <strong>{e.title}</strong>
        <small className="muted">{withDate ? `${format(parseISO(e.date), 'EEE d MMM')} · ` : ''}{timeLabel(e)}</small>
      </div>
    </div>
  )
}

export default function PartnerProfile({ partner, color }) {
  const [zoom, setZoom] = useState(false)
  const [list, setList] = useState(null)
  const today = ymd(new Date())

  useEffect(() => {
    let live = true
    supabase.from('events').select('*')
      .eq('user_id', partner.user_id).gte('date', today)
      .order('date').order('start_time').limit(30)
      .then(({ data }) => live && setList(data || []))
    return () => { live = false }
  }, [partner.user_id, today])

  const todays = (list || []).filter((e) => e.date === today)
  const next = (list || []).filter((e) => e.date > today).slice(0, 6)

  return (
    <div className="profile">
      <div className="card pcard pcenter">
        {partner.avatar_url ? (
          <button className="zoom-btn" onClick={() => setZoom(true)} aria-label="View photo">
            <Avatar url={partner.avatar_url} name={partner.display_name} color={color} size="xl" />
          </button>
        ) : (
          <Avatar name={partner.display_name} color={color} size="xl" />
        )}
        <h2>{partner.display_name}</h2>
        <p className={partner.about ? 'status-line' : 'muted small'}>{partner.about || 'No status yet'}</p>
      </div>

      <div className="card pcard">
        <h2>{partner.display_name}'s events</h2>
        {list === null ? (
          <p className="muted small">Loading…</p>
        ) : (
          <>
            <p className="muted small">Today</p>
            {todays.length ? todays.map((e) => <Row key={e.id} e={e} />) : <p className="muted small">Nothing added for today.</p>}
            <p className="muted small">Coming up</p>
            {next.length ? next.map((e) => <Row key={e.id} e={e} withDate />) : <p className="muted small">Nothing coming up.</p>}
          </>
        )}
      </div>

      {zoom && (
        <div className="overlay" onClick={() => setZoom(false)}>
          <img className="lightbox" src={partner.avatar_url} alt={partner.display_name} />
        </div>
      )}
    </div>
  )
}
