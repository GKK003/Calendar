import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarDays, MessageCircle, Plus, Sparkles } from 'lucide-react'
import './dashboard.css'
import './gallery.css'
import Avatar from './Avatar.jsx'
import Lightbox from './Lightbox.jsx'
import { Composer, PostCard } from './Posts.jsx'
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
  const [, tick] = useState(0)
  const today = ymd(new Date())

  // A new day starts at 00:00: re-render then (and when the phone wakes up) so yesterday's posts disappear
  useEffect(() => {
    const n = new Date()
    const next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 1)
    const t = setTimeout(() => tick((x) => x + 1), next - n)
    const wake = () => document.visibilityState === 'visible' && tick((x) => x + 1)
    document.addEventListener('visibilitychange', wake)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [today])

  const todays = events.filter((e) => e.date === today)
  const mine = sortEvents(todays.filter((e) => e.user_id === me.user_id))
  const specialToday = todays.filter((e) => e.type === 'special')

  const todayPosts = api.posts.filter((p) => ymd(new Date(p.created_at)) === today)
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
            {format(new Date(), 'EEEE, d MMMM yyyy')} · {todays.length === 0 ? 'Nothing planned today' : `${todays.length} ${todays.length === 1 ? 'event' : 'events'} today`}
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
          <PersonClock person={me} color={colorOf(me.user_id)} isMe />
          {others.map((o) => (
            <PersonClock key={o.user_id} person={o} color={colorOf(o.user_id)} />
          ))}
        </div>
      </section>

      {specialToday.length > 0 && (
        <section className="dspecial">
          <Sparkles size={20} />
          <strong>Today is special:</strong> {specialToday.map((e) => e.title).join(', ')}
        </section>
      )}

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
