import { AlarmClock } from 'lucide-react'

const clockLinks = [
  { label: 'Set alarm on iOS', href: 'clock-alarm://' },
  { label: 'Set alarm on Android', href: 'intent:#Intent;action=android.intent.action.SHOW_ALARMS;end' },
]

export default function WorldTimeAlarm({ times }) {
  const deviceTime = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
  })

  return (
    <section className="world-time-alarm" aria-label="Set a Clock alarm">
      <p className="muted small">Enter the time manually in your phone’s Clock app and check the date before saving.</p>
      {times.map(({ instant, occurrence }) => (
        <p key={instant}>
          {occurrence && <span className="muted small">{occurrence} · </span>}
          <strong><time dateTime={new Date(instant).toISOString()}>{deviceTime.format(instant)}</time></strong>
        </p>
      ))}
      <div className="world-time-alarm-actions">
        {clockLinks.map(({ label, href }) => (
          <a key={label} className="btn ghost sm" href={href}>
            <AlarmClock size={16} aria-hidden="true" />
            {label}
          </a>
        ))}
      </div>
      <p className="muted small">If Clock doesn’t open, launch it from your home screen.</p>
    </section>
  )
}
