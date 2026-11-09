import { useState } from 'react'
import { AlarmClock } from 'lucide-react'
import { uuid } from './lib.js'

export const lastReminderInstant = Date.parse('9999-12-31T23:58:59Z')
const title = 'World Time reminder'

function calendarTimestamp(instant) {
  return new Date(instant).toISOString().replace(/[-:]|\.\d{3}/g, '')
}

export default function WorldTimeAlarm({ instant, occurrence }) {
  const [id] = useState(uuid)
  const [expired, setExpired] = useState(false)
  const start = calendarTimestamp(instant)
  const end = calendarTimestamp(instant + 60_000)
  const deviceTime = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
  }).format(instant)
  const reminder = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Our Calendar//World Time//EN',
    'BEGIN:VEVENT',
    `UID:${id}`,
    `DTSTAMP:${calendarTimestamp(Date.now())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${title}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT0S',
    `DESCRIPTION:${title}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
  const googleParams = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${start}/${end}` })

  function checkTime(event) {
    if (instant <= Date.now()) {
      event.preventDefault()
      setExpired(true)
    }
  }

  return (
    <details className="world-time-alarm">
      <summary className="btn ghost sm">
        <AlarmClock size={17} aria-hidden="true" />
        {occurrence ? `Set alarm for ${occurrence.toLowerCase()}` : 'Set alarm'}
      </summary>
      {expired ? (
        <p role="status">This time has passed. Choose a future time.</p>
      ) : (
        <div className="world-time-alarm-options">
          <p>Use <strong>{deviceTime}</strong> in your phone’s Clock app and check the date before saving.</p>
          <p className="muted small">For a calendar alert, add the reminder and check that the alert is set to the event time.</p>
          <a
            className="btn primary sm"
            href={`data:text/calendar;charset=utf-8,${encodeURIComponent(reminder)}`}
            download="world-time-reminder.ics"
            onClick={checkTime}
          >
            Download calendar reminder
          </a>
          <a
            className="btn ghost sm"
            href={`https://calendar.google.com/calendar/render?${googleParams}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={checkTime}
          >
            Open Google Calendar
          </a>
        </div>
      )}
    </details>
  )
}
