import { lazy, Suspense, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { Activity, CalendarDays, Clock3, MapPin, MessageCircle, Plus, Sparkles } from 'lucide-react'
import './dashboard.css'
import Avatar from './Avatar.jsx'
import { Composer, PostCard } from './Posts.jsx'
import { TYPES, clockIn, dateInZone, eventOriginLabel, mapHref, sortEvents, timeLabel, zoneLabel, zoneOfCity } from './lib.js'

const Lightbox = lazy(() => import('./Lightbox.jsx'))

function EventRow({ e, owner, color, showDate, zone, onOpen }) {
  const special = e.type === 'special'
  const originLabel = eventOriginLabel(e)
  const map = mapHref(e.place)
  return (
    <div className={'drow-wrap' + (map ? ' ev-card' : '') + (map && special ? ' special' : '')}>
      <button type="button" className={'drow' + (!map && special ? ' special' : '')} onClick={() => onOpen(e)}>
        <i style={{ background: TYPES[e.type].color }} />
        <span className="drow-main">
          <strong>
            {special && <Sparkles size={14} className="sd-inline" />}
            {e.title}
          </strong>
          <small>
            {showDate ? `${format(parseISO(e.date), 'EEE d MMM')} · ` : ''}
            {timeLabel(e)}{e.start_time && zone ? ` · ${zoneLabel(zone)} time` : ''}
          </small>
          {originLabel && <small className="drow-origin">{originLabel}</small>}
        </span>
        {owner && <Avatar url={owner.avatar_url} name={owner.display_name} color={color} />}
      </button>
      {map && (
        <a
          className="map-btn"
          href={map}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open map for ${e.title}; opens in a new tab`}
          title="Opens in a new tab"
        >
          <MapPin size={16} aria-hidden="true" /> Open map
        </a>
      )}
    </div>
  )
}

function secondsAt(time) {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return hours * 3600 + minutes * 60
}

export default function Dashboard({
  me,
  others,
  events,
  eventsPending,
  now,
  today,
  colorOf,
  memberById,
  api,
  onOpenEvent,
  onNewEvent,
  onOpenCalendar,
}) {
  const [zoom, setZoom] = useState(null)
  const zone = zoneOfCity(me.city)
  const nowClock = clockIn(zone, now)
  const todayLabel = new Intl.DateTimeFormat(undefined, {
    timeZone: zone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(now)
  const nowParts = nowClock.split(':').map(Number)
  const nowSeconds = nowParts[0] * 3600 + nowParts[1] * 60 + nowParts[2]
  const yesterday = format(addDays(parseISO(today), -1), 'yyyy-MM-dd')

  const happeningNow = sortEvents(events.filter((e) => {
    if (e.date === today && !e.start_time) return true
    if (!e.start_time || !e.end_time) return false

    const start = secondsAt(e.start_time)
    const end = secondsAt(e.end_time)
    if (e.date === today) {
      return end > start
        ? nowSeconds >= start && nowSeconds < end
        : end < start && nowSeconds >= start
    }
    return e.date === yesterday && end < start && nowSeconds < end
  }))
  const happeningIds = new Set(happeningNow.map((e) => e.id))
  const todays = events.filter((e) =>
    e.date === today && !happeningIds.has(e.id) &&
    (!e.start_time || secondsAt(e.start_time) > nowSeconds),
  )
  const mine = sortEvents(todays.filter((e) => e.user_id === me.user_id))
  const specialToday = [...todays, ...happeningNow].filter((e) => e.type === 'special')
  const deadlines = todays
    .filter((e) => e.start_time)
    .map((e) => {
      const [hours, minutes] = e.start_time.slice(0, 5).split(':').map(Number)
      return { event: e, secondsUntil: hours * 3600 + minutes * 60 - nowSeconds }
    })
    .filter((item) => item.secondsUntil > 0 && item.secondsUntil <= 2 * 60 * 60)
    .sort((a, b) => a.secondsUntil - b.secondsUntil)
  const dayStatus = [
    happeningNow.length ? `${happeningNow.length} happening now` : null,
    todays.length ? `${todays.length} upcoming ${todays.length === 1 ? 'event' : 'events'} today` : null,
  ].filter(Boolean).join(' · ') || 'Nothing left today'

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
          <h1>Your day</h1>
          <p className="muted">{todayLabel}</p>
          <p className="muted" role="status">{eventsPending ? 'Loading events…' : dayStatus}</p>
          <div className="dhero-actions">
            <button type="button" className="btn primary sm" onClick={() => onNewEvent()}>
              <Plus size={16} /> Add event
            </button>
            <button type="button" className="btn ghost sm" onClick={newPost}>
              <MessageCircle size={16} /> New post
            </button>
            <button type="button" className="btn ghost sm" onClick={onOpenCalendar}>
              <CalendarDays size={16} /> Calendar
            </button>
          </div>
        </div>
      </section>

      {specialToday.length > 0 && (
        <section className="dspecial">
          <Sparkles size={20} />
          <strong>Today is special:</strong> {specialToday.map((e) => e.title).join(', ')}
        </section>
      )}

      <section className="card ddeadlines dhappening">
        <div className="ddeadline-head">
          <span className="dhappening-icon"><Activity size={18} /></span>
          <div>
            <h2>Happening now</h2>
            <small>Events underway in {zoneLabel(zone)} time</small>
          </div>
          <span className="dhappening-count">{eventsPending ? '–' : happeningNow.length}</span>
        </div>
        {happeningNow.length === 0 ? (
          <p className="empty">{eventsPending ? 'Checking current events…' : 'Nothing is happening right now.'}</p>
        ) : (
          <div className="dhappening-list">
            {happeningNow.map((e) => (
              <EventRow
                key={e.id}
                e={e}
                owner={memberById[e.user_id]}
                color={colorOf(e.user_id)}
                showDate={e.date !== today}
                zone={zone}
                onOpen={onOpenEvent}
              />
            ))}
          </div>
        )}
      </section>

      <section className="card ddeadlines">
        <div className="ddeadline-head">
          <span className="ddeadline-icon"><Clock3 size={18} /></span>
          <div>
            <h2>Deadlines</h2>
            <small>Events starting within the next 2 hours</small>
          </div>
          <span className="ddeadline-count">{eventsPending ? '–' : deadlines.length}</span>
        </div>
        {deadlines.length === 0 ? (
          <p className="empty">{eventsPending ? 'Checking upcoming events…' : 'No events starting in the next 2 hours.'}</p>
        ) : (
          <div className="ddeadline-list">
            {deadlines.map(({ event: e, secondsUntil }) => (
              <div className="ddeadline-row" key={e.id}>
                <EventRow e={e} owner={memberById[e.user_id]} color={colorOf(e.user_id)} zone={zone} onOpen={onOpenEvent} />
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
            {mine.length === 0 && <p className="empty">{eventsPending ? 'Checking your plans…' : 'Nothing planned today.'}</p>}
            {mine.map((e) => (
              <EventRow key={e.id} e={e} zone={zone} onOpen={onOpenEvent} />
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
                {theirs.length === 0 && <p className="empty">{eventsPending ? 'Checking plans…' : 'Nothing planned today.'}</p>}
                {theirs.map((e) => (
                  <EventRow key={e.id} e={e} zone={zone} onOpen={onOpenEvent} />
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
        <Suspense fallback={null}>
          <Lightbox
            items={zoom.items}
            index={zoom.index}
            onIndex={(index) => setZoom({ ...zoom, index })}
            onClose={() => setZoom(null)}
          />
        </Suspense>
      )}
    </div>
  )
}
