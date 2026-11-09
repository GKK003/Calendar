import { useState } from 'react'
import { AlarmClock, Copy } from 'lucide-react'

function AndroidAlarmRequest({ localTime, occurrence }) {
  const [status, setStatus] = useState('')
  const request = `Set a one-time alarm for ${localTime}.`

  async function copyRequest() {
    try {
      await navigator.clipboard.writeText(request)
      setStatus('Alarm request copied.')
    } catch {
      setStatus('Select the request above to copy it manually.')
    }
  }

  return (
    <div className="world-time-alarm-request">
      <p>
        {occurrence && <span className="muted small">{occurrence} · </span>}
        {request}
      </p>
      <button
        type="button"
        className="btn ghost sm"
        onClick={copyRequest}
        aria-label={occurrence ? `Copy alarm request for ${occurrence.toLowerCase()}` : undefined}
      >
        <Copy size={16} aria-hidden="true" />
        Copy alarm request
      </button>
      <span className="muted small" role="status">{status}</span>
    </div>
  )
}

export default function WorldTimeAlarm({ times }) {
  const [showAndroid, setShowAndroid] = useState(false)
  const deviceTime = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
  })

  return (
    <section className="world-time-alarm" aria-label="Set a Clock alarm">
      <p className="muted small">Alarm time on this device</p>
      {times.map(({ instant, occurrence }) => (
        <p key={instant}>
          {occurrence && <span className="muted small">{occurrence} · </span>}
          <strong><time dateTime={new Date(instant).toISOString()}>{deviceTime.format(instant)}</time></strong>
        </p>
      ))}
      <div className="world-time-alarm-actions">
        <a className="btn ghost sm" href="clock-alarm://">
          <AlarmClock size={16} aria-hidden="true" />
          Set alarm on iOS
        </a>
        <button
          type="button"
          className="btn ghost sm"
          aria-expanded={showAndroid}
          aria-controls="world-time-android-setup"
          onClick={() => setShowAndroid((open) => !open)}
        >
          <AlarmClock size={16} aria-hidden="true" />
          Set alarm on Android
        </button>
      </div>
      <div id="world-time-android-setup" hidden={!showAndroid}>
        {showAndroid && (
          <div className="world-time-android">
            <p>Open Clock, tap Alarm, then tap Add. You can also paste the request below into the Gemini app on Android. Check the date and time in Clock.</p>
            {times.map(({ instant, occurrence }) => (
              <AndroidAlarmRequest key={instant} localTime={deviceTime.format(instant)} occurrence={occurrence} />
            ))}
          </div>
        )}
      </div>
      <p className="muted small">If the iOS link doesn’t open Clock, launch it from your home screen and enter the time above.</p>
    </section>
  )
}
