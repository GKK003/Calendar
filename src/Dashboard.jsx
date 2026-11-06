import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarDays, Clock3, MapPin, MessageCircle, Plus, Sparkles } from 'lucide-react'
import './dashboard.css'
import './gallery.css'
import Avatar from './Avatar.jsx'
import Lightbox from './Lightbox.jsx'
import { Composer, PostCard } from './Posts.jsx'
import { TYPES, ZONES, clockIn, dateInZone, greeting, mapHref, sortEvents, timeLabel, zoneOfCity } from './lib.js'

function ZoneClock({ zone }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="dclock">
      <div>
        <small>{zone.label}</small>
        <b>{clockIn(zone.id, now).slice(0, 5)}</b>
      </div>
    </div>
  )
}

function EventRow({ e, owner, color, showDate, onOpen }) {
  const special = e.type === 'special'
  return (
    <div className="drow-wrap">
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
      {mapHref(e.place) && (
        <a
          className="drow-map"
          href={mapHref(e.place)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open map for ${e.title}`}
        >
          <MapPin size={16} /> <span>Open map</span>
        </a>
      )}
    </div>
  )
}

export default function Dashboard({
  me,
  others,
  events,
  colorOf,
  memberById,
  api,
  onOpenEvent,
  onNewEvent,
  onOpenCalendar,
}) {
  const [zoom, setZoom] = useState(null)
  const [now, setNow] = useState(() => new Date())
  const zone = zoneOfCity(me.city)
  const today = dateInZone(zone, now)
  const nowClock = clockIn(zone, now)
  const todayLabel = new Intl.DateTimeFormat(undefined, {
    timeZone: zone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(now)

  // Keep upcoming events and the two-hour deadline list current while the page is open.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    const wake = () => document.visibilityState === 'visible' && setNow(new Date())
    document.addEventListener('visibilitychange', wake)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [])

  const todays = events.filter((e) => e.date === today && (!e.start_time || `${e.start_time.slice(0, 5)}:00` > nowClock))
  const mine = sortEvents(todays.filter((e) => e.user_id === me.user_id))
  const specialToday = todays.filter((e) => e.type === 'special')
  const nowParts = nowClock.split(':').map(Number)
  const nowSeconds = nowParts[0] * 3600 + nowParts[1] * 60 + nowParts[2]
  const deadlines = todays
    .filter((e) => e.start_time)
    .map((e) => {
      const [hours, minutes] = e.start_time.slice(0, 5).split(':').map(Number)
      return { event: e, secondsUntil: hours * 3600 + minutes * 60 - nowSeconds }
    })
    .filter((item) => item.secondsUntil > 0 && item.secondsUntil <= 2 * 60 * 60)
    .sort((a, b) => a.secondsUntil - b.secondsUntil)

  function startsIn(seconds) {
    const minutes = Math.ceil(seconds / 60)
    if (minutes < 60) return `Starts in ${minutes} min`
    const hours = Math.floor(minutes / 60)
    const remainder = minutes % 60
    return `Starts in ${hours} hr${remainder ? ` ${remainder} min` : ''}`
  }

  const todayPosts = api.posts.filter((p) => dateInZone(zone, new Date(p.created_at)) === today)
  const byPost = {}
  for (const r of api.replies) (byPost[r.post_id] ||= []).push(r)

  function newPost() {
    const box = document.getElementById('todays-posts')
    box?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    box?.querySelector('textarea')?.focus({ preventScroll: true })
  }

  return (
    <div className="dash">
      <section className="card dhero">
        <div className="dhero-text">
          <h1>
            {greeting()}, {me.display_name}
          </h1>
          <p className="muted">
            {todayLabel} · {todays.length === 0 ? 'Nothing left today' : `${todays.length} upcoming ${todays.length === 1 ? 'event' : 'events'} today`}
          </p>
          <div className="dhero-actions">
            <button className="btn primary sm" onClick={() => onNewEvent()}>
              <Plus size={16} /> Add event
            </button>
            <button className="btn ghost sm" onClick={newPost}>
              <MessageCircle size={16} /> New post
            </button>
            <button className="btn ghost sm" onClick={onOpenCalendar}>
              <CalendarDays size={16} /> Calendar
            </button>
          </div>
        </div>
        <div className="dclocks">
          {[...ZONES]
            .sort((a, z) => (z.id === zoneOfCity(me.city)) - (a.id === zoneOfCity(me.city)))
            .map((z) => (
              <ZoneClock key={z.id} zone={z} />
            ))}
        </div>
      </section>

      {specialToday.length > 0 && (
        <section className="dspecial">
          <Sparkles size={20} />
          <strong>Today is special:</strong> {specialToday.map((e) => e.title).join(', ')}
        </section>
      )}

      <section className="card ddeadlines">
        <div className="ddeadline-head">
          <span className="ddeadline-icon"><Clock3 size={18} /></span>
          <div>
            <h2>Deadlines</h2>
            <small>Events starting within the next 2 hours</small>
          </div>
          <span className="ddeadline-count">{deadlines.length}</span>
        </div>
        {deadlines.length === 0 ? (
          <p className="empty">No events starting in the next 2 hours.</p>
        ) : (
          <div className="ddeadline-list">
            {deadlines.map(({ event: e, secondsUntil }) => (
              <div className="ddeadline-row" key={e.id}>
                <EventRow e={e} owner={memberById[e.user_id]} color={colorOf(e.user_id)} onOpen={onOpenEvent} />
                <small>{startsIn(secondsUntil)}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="dpanels">
        <section className="card dpanel dme">
          <h2>Your day</h2>
          <div className="dlist">
            {mine.length === 0 && <p className="empty">Nothing planned today.</p>}
            {mine.map((e) => (
              <EventRow key={e.id} e={e} onOpen={onOpenEvent} />
            ))}
          </div>
        </section>

        {others.map((o) => {
          const theirs = sortEvents(todays.filter((e) => e.user_id === o.user_id))
          return (
            <section key={o.user_id} className="card dpanel dpartner">
              <h2>{o.display_name}'s day</h2>
              {o.about && <p className="muted small">{o.about}</p>}
              <div className="dlist">
                {theirs.length === 0 && <p className="empty">Nothing planned today.</p>}
                {theirs.map((e) => (
                  <EventRow key={e.id} e={e} onOpen={onOpenEvent} />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <section className="dposts" id="todays-posts">
        <div className="dpanel-head">
          <h2>Today's posts</h2>
          <small className="muted">Clears at midnight · photos are kept in the Gallery</small>
        </div>
        <Composer me={me} color={colorOf(me.user_id)} onPost={api.add} />
        <div className="dfeed">
          {todayPosts.length === 0 && <p className="empty">Nothing yet today. Check in or share a photo.</p>}
          {todayPosts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              owner={memberById[p.user_id]}
              color={colorOf(p.user_id)}
              replies={byPost[p.id] || []}
              urls={api.urls}
              me={me}
              memberById={memberById}
              colorOf={colorOf}
              api={api}
              onZoom={(items, index) => setZoom({ items, index })}
            />
          ))}
        </div>
      </section>

      {zoom && (
        <Lightbox
          items={zoom.items}
          index={zoom.index}
          onIndex={(index) => setZoom({ ...zoom, index })}
          onClose={() => setZoom(null)}
        />
      )}
    </div>
  )
}
