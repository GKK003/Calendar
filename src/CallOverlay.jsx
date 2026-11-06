import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react'
import Avatar from './Avatar.jsx'

function useRing(on) {
  useEffect(() => {
    if (!on) return
    let ctx
    let timer
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      const beep = () => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.frequency.value = 480
        g.gain.value = 0.06
        o.connect(g)
        g.connect(ctx.destination)
        o.start()
        o.stop(ctx.currentTime + 0.4)
        navigator.vibrate?.([300, 200, 300])
      }
      beep()
      timer = setInterval(beep, 2200)
    } catch {
      /* browsers may block sound until the page was tapped once */
    }
    return () => {
      clearInterval(timer)
      ctx?.close().catch(() => {})
    }
  }, [on])
}

function Timer({ since }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const s = Math.max(0, Math.floor((Date.now() - since) / 1000))
  return <>{String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}</>
}

export default function CallOverlay({ api, partner, color, name }) {
  const { call, local, remote, muted, camOff } = api
  const rv = useRef(null)
  const lv = useRef(null)
  const dialogRef = useRef(null)
  const callActive = call.status !== 'idle'
  useRing(call.status === 'ringing')
  useEffect(() => {
    if (rv.current) rv.current.srcObject = remote
  }, [remote, call.status])
  useEffect(() => {
    if (lv.current) lv.current.srcObject = local
  }, [local, call.status])

  useEffect(() => {
    if (!callActive) return undefined
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const initialAction = dialogRef.current?.querySelector(call.status === 'ringing' ? '.call-btn.green' : '.call-btn.red')
    initialAction?.focus()

    function trapFocus(event) {
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', trapFocus)
    return () => {
      document.removeEventListener('keydown', trapFocus)
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [callActive])

  if (call.status === 'idle') return null
  const label =
    call.status === 'ringing' ? `Incoming ${call.video ? 'video' : 'voice'} call`
    : call.status === 'calling' ? 'Calling…'
    : call.status === 'connecting' ? 'Connecting…'
    : null
  const showVideo = call.video && remote && call.status === 'connected'

  return (
    <div ref={dialogRef} className="call" role="dialog" aria-modal="true" aria-label={`Call with ${name}`}>
      <video ref={rv} className={'call-remote' + (showVideo ? '' : ' hid')} autoPlay playsInline aria-label={`${name}'s camera`} />
      {!showVideo && (
        <div className="call-who">
          <Avatar url={partner?.avatar_url} name={name} color={color} size="lg" />
          <h2>{name}</h2>
          <p>{label ? <span role="status">{label}</span> : <Timer since={call.startedAt} />}</p>
        </div>
      )}
      {showVideo && (
        <div className="call-top">
          <strong>{name}</strong> · <Timer since={call.startedAt} />
        </div>
      )}
      {call.video && local && !camOff && <video ref={lv} className="call-local" autoPlay playsInline muted aria-label="Your camera preview" />}

      {call.status === 'ringing' ? (
        <div className="call-actions">
          <button type="button" className="call-btn red" onClick={api.decline} aria-label="Decline"><PhoneOff size={24} /></button>
          <button type="button" className="call-btn green" onClick={api.accept} aria-label="Accept">
            {call.video ? <Video size={24} /> : <Phone size={24} />}
          </button>
        </div>
      ) : (
        <div className="call-actions">
          <button type="button" className={'call-btn' + (muted ? ' on' : '')} onClick={api.toggleMute} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}>
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          {call.video && (
            <button type="button" className={'call-btn' + (camOff ? ' on' : '')} onClick={api.toggleCam} aria-label={camOff ? 'Turn camera on' : 'Turn camera off'}>
              {camOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
          )}
          <button type="button" className="call-btn red" onClick={api.hangup} aria-label="End call"><PhoneOff size={24} /></button>
        </div>
      )}
    </div>
  )
}
