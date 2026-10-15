import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'

// Free Google STUN works for most home/mobile networks. For strict networks add a TURN
// server in .env: VITE_TURN_URL, VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL
function iceServers() {
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
  const url = import.meta.env.VITE_TURN_URL
  if (url) {
    list.push({
      urls: url.split(',').map((u) => u.trim()),
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    })
  }
  return list
}

const IDLE = { status: 'idle', video: false, incoming: false, startedAt: 0 }

// Voice and video calls between the two of you (WebRTC; the signals go through Supabase Realtime)
export default function useCall({ space, userId, calls }) {
  const [call, setCall] = useState(IDLE)
  const [local, setLocal] = useState(null)
  const [remote, setRemote] = useState(null)
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [error, setError] = useState('')
  const st = useRef(IDLE)
  const pc = useRef(null)
  const stream = useRef(null)
  const chan = useRef(null)
  const ice = useRef([])
  const ringTimer = useRef(null)
  const rowId = useRef(null) // promise of the chat row that stands for this call
  const logRef = useRef(calls)
  logRef.current = calls

  const put = (next) => {
    st.current = { ...st.current, ...next }
    setCall(st.current)
  }

  const send = (type, data = {}) =>
    chan.current?.send({ type: 'broadcast', event: 'sig', payload: { from: userId, type, ...data } })

  const cleanup = useCallback(() => {
    clearTimeout(ringTimer.current)
    pc.current?.close()
    pc.current = null
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    ice.current = []
    setLocal(null)
    setRemote(null)
    setMuted(false)
    setCamOff(false)
    st.current = IDLE
    setCall(IDLE)
  }, [])

  // caller writes the call into the chat (once)
  function finish(status) {
    const c = st.current
    if (!c.incoming && c.status !== 'idle') {
      const seconds = c.startedAt ? (Date.now() - c.startedAt) / 1000 : 0
      const row = rowId.current
      rowId.current = null
      row?.then((id) => logRef.current?.finish(id, { video: c.video, status, seconds }))
    }
    cleanup()
  }

  async function getMedia(video) {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: video ? { facingMode: 'user' } : false,
      })
      stream.current = s
      setLocal(s)
      return true
    } catch {
      setError(video ? 'Could not use the camera or microphone. Check the browser permission.' : 'Could not use the microphone. Check the browser permission.')
      return false
    }
  }

  function makePc() {
    const p = new RTCPeerConnection({ iceServers: iceServers() })
    stream.current?.getTracks().forEach((t) => p.addTrack(t, stream.current))
    p.onicecandidate = (e) => e.candidate && send('ice', { c: e.candidate.toJSON() })
    p.ontrack = (e) => setRemote(e.streams[0] || null)
    p.onconnectionstatechange = () => {
      if (p.connectionState === 'connected' && st.current.status !== 'connected') put({ status: 'connected', startedAt: Date.now() })
      if (p.connectionState === 'failed') {
        setError('The call could not connect. A different network may be needed.')
        send('hangup')
        finish('ended')
      }
    }
    pc.current = p
    return p
  }

  async function flushIce() {
    for (const c of ice.current.splice(0)) await pc.current?.addIceCandidate(c).catch(() => {})
  }

  async function start(video) {
    if (st.current.status !== 'idle') return
    if (!window.RTCPeerConnection || !navigator.mediaDevices) {
      setError('Calls need a secure (https) page and a modern browser.')
      return
    }
    setError('')
    put({ status: 'calling', video, incoming: false, startedAt: 0 })
    if (!(await getMedia(video))) return cleanup()
    send('invite', { video })
    rowId.current = logRef.current?.begin(video) || null
    ringTimer.current = setTimeout(() => {
      send('cancel')
      finish('missed')
    }, 45000)
  }

  async function accept() {
    const c = st.current
    if (c.status !== 'ringing') return
    setError('')
    if (!(await getMedia(c.video))) {
      send('decline')
      return cleanup()
    }
    put({ status: 'connecting' })
    send('accept')
  }

  function decline() {
    send('decline')
    cleanup()
  }

  function hangup() {
    const c = st.current
    if (c.status === 'idle') return
    if (c.status === 'calling') {
      send('cancel')
      return finish('missed')
    }
    send('hangup')
    finish('ended')
  }

  useEffect(() => {
    const ch = supabase.channel('call-' + space.id, { config: { broadcast: { self: false } } })
    ch.on('broadcast', { event: 'sig' }, async ({ payload: p }) => {
      if (p.from === userId) return
      const c = st.current
      try {
        if (p.type === 'invite') {
          if (c.status === 'ringing' && c.incoming) return
          if (c.status !== 'idle') return ch.send({ type: 'broadcast', event: 'sig', payload: { from: userId, type: 'busy' } })
          put({ status: 'ringing', video: !!p.video, incoming: true, startedAt: 0 })
        } else if (p.type === 'cancel' && c.status === 'ringing') {
          cleanup()
        } else if (p.type === 'busy' && c.status === 'calling') {
          setError('Busy in another call.')
          finish('missed')
        } else if (p.type === 'decline' && c.status === 'calling') {
          finish('declined')
        } else if (p.type === 'accept' && c.status === 'calling') {
          clearTimeout(ringTimer.current)
          rowId.current?.then((id) => logRef.current?.finish(id, { video: c.video, status: 'connected', seconds: 0 }))
          put({ status: 'connecting' })
          const peer = makePc()
          const offer = await peer.createOffer()
          await peer.setLocalDescription(offer)
          send('offer', { sdp: peer.localDescription.toJSON() })
        } else if (p.type === 'offer' && c.status === 'connecting' && c.incoming) {
          const peer = makePc()
          await peer.setRemoteDescription(p.sdp)
          await flushIce()
          const answer = await peer.createAnswer()
          await peer.setLocalDescription(answer)
          send('answer', { sdp: peer.localDescription.toJSON() })
        } else if (p.type === 'answer' && pc.current && !c.incoming) {
          await pc.current.setRemoteDescription(p.sdp)
          await flushIce()
        } else if (p.type === 'ice') {
          if (pc.current?.remoteDescription) await pc.current.addIceCandidate(p.c).catch(() => {})
          else ice.current.push(p.c)
        } else if (p.type === 'hangup' && c.status !== 'idle') {
          finish('ended')
        }
      } catch {
        /* a bad signal must not break the app */
      }
    })
    ch.subscribe()
    chan.current = ch
    return () => {
      cleanup()
      supabase.removeChannel(ch)
      chan.current = null
    }
    // eslint-disable-next-line
  }, [space.id, userId])

  // opened from a "calling" notification: if she is still ringing, show the call
  useEffect(() => {
    async function checkPending() {
      if (document.hidden || st.current.status !== 'idle') return
      const since = new Date(Date.now() - 40000).toISOString()
      const { data } = await supabase
        .from('messages')
        .select('id, meta')
        .eq('kind', 'call')
        .neq('user_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
      const m = data?.[0]
      if (m && m.meta?.status === 'ringing' && st.current.status === 'idle') {
        put({ status: 'ringing', video: !!m.meta.video, incoming: true, startedAt: 0 })
      }
    }
    checkPending()
    document.addEventListener('visibilitychange', checkPending)
    return () => document.removeEventListener('visibilitychange', checkPending)
    // eslint-disable-next-line
  }, [space.id, userId])

  function toggleMute() {
    const on = !muted
    stream.current?.getAudioTracks().forEach((t) => (t.enabled = !on))
    setMuted(on)
  }
  function toggleCam() {
    const off = !camOff
    stream.current?.getVideoTracks().forEach((t) => (t.enabled = !off))
    setCamOff(off)
  }

  return { call, local, remote, muted, camOff, error, clearError: () => setError(''), start, accept, decline, hangup, toggleMute, toggleCam }
}
