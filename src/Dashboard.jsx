import { useEffect, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { MessageCircle, Plus, Sparkles } from 'lucide-react'
import './dashboard.css'
import Avatar from './Avatar.jsx'
import { TYPES, clockIn, greeting, sortEvents, timeLabel, ymd, zoneLabel, zoneOfCity } from './lib.js'

function PersonClock({ person, color, isMe }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const tz = zoneOfCity(person.city)
  return (
    <div className="dclock">
      <Avatar url={person.avatar_url} name={person.display_name} color={color} size="md" />
      <div>
        <small>{isMe ? 'You' : person.display_name} · {zoneLabel(tz)}</small>
        <b>{clockIn(tz, now).slice(0, 5)}</b>
      </div>
    </div>
  )
}

function EventRow({ e, owner, color, showDate, onOpen }) {
  const special = e.type === 'special'
  return (
    <button className={'drow' + (special ? ' special' : '')} onClick={() => onOpen(e)}>
      <i style={{ background: TYPES[e.type].color }} />
      <span className="drow-main">
        <strong>
          {special && <Sparkles size={14} className="sd-inline" />}
          {e.title}
        </strong>
        <small>
          {showDate ? `${format(parseISO(e.date), 'EEE d MMM')} · ` : ''}
          {timeLabel(e)}
        </small>
      </span>
      {owner && <Avatar url={owner.avatar_url} name={owner.display_name} color={color} />}
    </button>
  )
}

export default function Dashboard({
  me,
  partner,
  events,
  colorOf,
  memberById,
  posts,
  replies,
  urls,
  onOpenEvent,
  onNewEvent,
  onOpenPosts,
  onOpenCalendar,
}) {
  const today = ymd(new Date())
  const weekEnd = ymd(addDays(new Date(), 7))
  const todays = events.filter((e) => e.date === today)
  const mine = sortEvents(todays.filter((e) => e.user_id === me.user_id))
  const theirs = partner ? sortEvents(todays.filter((e) => e.user_id === partner.user_id)) : []
  const specialToday = todays.filter((e) => e.type === 'special')
  const upcoming = events
    .filter((e) => e.date > today && e.date <= weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || '').localeCompare(b.start_time || ''))
    .slice(0, 10)
  const latest = posts.slice(0, 3)

  return (
    <div className="dash">
      <section className="card dhero">
        <div className="dhero-text">
          <h1>
            {greeting()}, {me.display_name}
          </h1>
          <p className="muted">
            {format(new Date(), 'EEEE, d MMMM yyyy')} · {todays.length === 0 ? 'Nothing planned today' : `${todays.length} ${todays.length === 1 ? 'event' : 'events'} today`}
          </p>
          <div className="dhero-actions">
            <button className="btn primary sm" onClick={() => onNewEvent()}>
              <Plus size={16} /> Add event
            </button>
            <button className="btn ghost sm" onClick={onOpenPosts}>
              <MessageCircle size={16} /> New post
            </button>
          </div>
        </div>
        <div className="dclocks">
          <PersonClock person={me} color={colorOf(me.user_id)} isMe />
          {partner && <PersonClock person={partner} color={colorOf(partner.user_id)} />}
        </div>
      </section>

      {specialToday.length > 0 && (
        <section className="dspecial">
          <Sparkles size={20} />
          <strong>Today is special:</strong> {specialToday.map((e) => e.title).join(', ')}
        </section>
      )}

      <section className="card dpanel dme">
        <h2>Your day</h2>
        <div className="dlist">
          {mine.length === 0 && <p className="empty">Nothing planned today.</p>}
          {mine.map((e) => (
            <EventRow key={e.id} e={e} onOpen={onOpenEvent} />
          ))}
        </div>
      </section>

      {partner && (
        <section className="card dpanel dpartner">
          <h2>{partner.display_name}'s day</h2>
          {partner.about && <p className="muted small">{partner.about}</p>}
          <div className="dlist">
            {theirs.length === 0 && <p className="empty">Nothing planned today.</p>}
            {theirs.map((e) => (
              <EventRow key={e.id} e={e} onOpen={onOpenEvent} />
            ))}
          </div>
        </section>
      )}

      <section className="card dpanel dnext">
        <div className="dpanel-head">
          <h2>Coming up</h2>
          <button className="linklike" onClick={onOpenCalendar}>Open calendar</button>
        </div>
        <div className="dlist">
          {upcoming.length === 0 && <p className="empty">Nothing in the next 7 days.</p>}
          {upcoming.map((e) => {
            const owner = memberById[e.user_id]
            return <EventRow key={e.id} e={e} owner={owner} color={colorOf(e.user_id)} showDate onOpen={onOpenEvent} />
          })}
        </div>
      </section>

      <section className="card dpanel dposts">
        <div className="dpanel-head">
          <h2>Latest posts</h2>
          <button className="linklike" onClick={onOpenPosts}>Open posts</button>
        </div>
        <div className="dpost-list">
          {latest.length === 0 && <p className="empty">No posts yet. Check in or share a photo.</p>}
          {latest.map((p) => {
            const owner = memberById[p.user_id]
            const thumb = urls[(p.photos || [])[0]]
            const count = replies.filter((r) => r.post_id === p.id).length
            return (
              <button className="dpost" key={p.id} onClick={onOpenPosts}>
                <Avatar url={owner?.avatar_url} name={owner?.display_name || '?'} color={colorOf(p.user_id)} />
                <span className="dpost-main">
                  <strong>{owner?.display_name || 'Someone'}</strong>
                  <small className="muted">
                    {p.checkin ? `Checked in: ${p.checkin}${p.body ? ' · ' : ''}` : ''}
                    {p.body || (!p.checkin && 'Shared a photo')}
                  </small>
                </span>
                {count > 0 && <span className="dcount">{count} {count === 1 ? 'reply' : 'replies'}</span>}
                {thumb && <img src={thumb} alt="" />}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
