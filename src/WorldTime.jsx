import { useState } from 'react'
import { Globe } from 'lucide-react'
import { ZONES, clockIn, dateInZone, wallTimeInstants } from './lib.js'
import WorldTimeAlarm, { lastReminderInstant } from './WorldTimeAlarm.jsx'
import './world-time.css'

const dateFormats = new Map(ZONES.map(({ id }) => [
  id, new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: id }),
]))
const occurrences = ['First occurrence', 'Second occurrence']

export default function WorldTime({ tz }) {
  const [source, setSource] = useState(tz)
  const [date, setDate] = useState(() => dateInZone(tz))
  const [time, setTime] = useState('')
  const from = ZONES.find((zone) => zone.id === source)
  const to = ZONES.find((zone) => zone.id !== source)
  const instants = date && time ? wallTimeInstants(date, time, source) : null
  const repeated = instants?.length === 2
  const now = Date.now()
  const canSetAlarm = (instant) => instant > now && instant <= lastReminderInstant

  return (
    <section className="world-time" aria-labelledby="world-time-title">
      <header className="world-time-heading">
        <span className="world-time-icon"><Globe size={24} aria-hidden="true" /></span>
        <div>
          <h1 id="world-time-title">World Time</h1>
          <p className="muted">Convert a date and time between Tbilisi and New York.</p>
        </div>
      </header>

      <div className="card world-time-card">
        <div className="world-time-entry">
          <div>
            <p id="world-time-source" className="muted small">Starting city</p>
            <div className="seg world-time-cities" role="group" aria-labelledby="world-time-source">
              {ZONES.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  className={source === zone.id ? 'on' : ''}
                  aria-pressed={source === zone.id}
                  onClick={() => setSource(zone.id)}
                >
                  {zone.label}
                </button>
              ))}
            </div>
          </div>
          <div className="world-time-fields">
            <label>
              Date
              <input type="date" min="0001-01-01" max="9999-12-31" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label>
              Time
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="world-time-result">
          <div className="world-time-readout" role="status" aria-atomic="true">
            <h2>Time in {to.label}</h2>
            {instants === null && (
              <p className="muted">{date && time ? 'Enter a valid date and time.' : 'Enter a date and time to see the conversion.'}</p>
            )}
            {instants?.length === 0 && (
              <p>The clocks in {from.label} skip this time on that date. Choose another time.</p>
            )}
            {repeated && <p className="muted">This time occurs twice in {from.label} on that date.</p>}
            {instants?.map((instant, index) => (
              <div key={instant} className="world-time-match">
                {repeated && <p className="muted small">{occurrences[index]}</p>}
                <time dateTime={new Date(instant).toISOString()}>
                  <strong>{clockIn(to.id, instant).slice(0, 5)}</strong>
                  <span>{dateFormats.get(to.id).format(instant)}</span>
                </time>
              </div>
            ))}
          </div>
          {instants?.length > 0 && !instants.some(canSetAlarm) && (
            <p className="muted small">
              {instants.every((instant) => instant <= now)
                ? 'Choose a future time to set an alarm.'
                : 'Choose an earlier date to set a reminder.'}
            </p>
          )}
          {instants?.map((instant, index) => (
            canSetAlarm(instant) && (
              <WorldTimeAlarm key={instant} instant={instant} occurrence={repeated ? occurrences[index] : undefined} />
            )
          ))}
        </div>
      </div>
    </section>
  )
}
