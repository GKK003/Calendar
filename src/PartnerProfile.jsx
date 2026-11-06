import { useEffect, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { supabase } from './supabase.js'
import { TYPES, dateInZone, localizeEvent, timeLabel, ymd } from './lib.js'
import Avatar from './Avatar.jsx'
import Lightbox from './Lightbox.jsx'

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

export default function PartnerProfile({ partner, color, tz }) {
  const [zoom, setZoom] = useState(false)
  const [list, setList] = useState(null)
  const [listError, setListError] = useState('')
  const [reload, setReload] = useState(0)
  const [now, setNow] = useState(() => new Date())
  const today = dateInZone(tz, now)
  const from = ymd(addDays(parseISO(today), -1))
  const through = ymd(addDays(parseISO(today), 32))

  useEffect(() => {
    const update = () => setNow(new Date())
    const timer = setInterval(update, 30_000)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  useEffect(() => {
    let live = true
    setList(null)
    setListError('')
    supabase.from('events').select('*')
      .eq('user_id', partner.user_id).gte('date', from).lte('date', through)
      .order('date').order('start_time').limit(200)
      .then(({ data, error }) => {
        if (!live) return
        if (error) {
          setListError(error.message)
          setList([])
          return
        }
        setList((data || []).map((e) => localizeEvent(e, tz)))
      })
      .catch((error) => {
        if (!live) return
        setListError(error.message || 'Could not load events.')
        setList([])
      })
    return () => { live = false }
  }, [partner.user_id, from, through, tz, reload])

  const todays = (list || []).filter((e) => e.date === today)
  const next = (list || []).filter((e) => e.date > today).slice(0, 6)

  return (
    <div className="profile">
      <div className="card pcard pcenter">
        {partner.avatar_url ? (
          <button type="button" className="zoom-btn" onClick={() => setZoom(true)} aria-label="View photo">
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
          <p className="muted small" role="status">Loading events…</p>
        ) : listError ? (
          <div className="data-alert" role="alert">
            <span>Could not load events: {listError}</span>
            <button type="button" className="btn ghost sm" onClick={() => setReload((n) => n + 1)}>Retry</button>
          </div>
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
        <Lightbox
          items={[{ url: partner.avatar_url, caption: `${partner.display_name}'s photo` }]}
          index={0}
          onIndex={() => {}}
          onClose={() => setZoom(false)}
        />
      )}
    </div>
  )
}
