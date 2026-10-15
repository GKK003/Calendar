import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import {
  ArrowDown, Bell, Camera, ChevronLeft, Check, CheckCheck, Copy, CornerUpLeft, Mic, Pencil, Phone, PhoneMissed,
  Play, Pause, Search, Send, Settings, Smile, Trash2, Users, Video, X,
} from 'lucide-react'
import './chat.css'
import Avatar from './Avatar.jsx'
import Lightbox from './Lightbox.jsx'
import { EMOJI, QUICK } from './emoji.js'
import { GROUP, preview } from './useChat.js'

const COLORS = ['#f6a9c4', '#e0679a', '#a9ddc2', '#3d9970', '#cdb8f5', '#7c5cd6', '#a8d4f5', '#2f7fd1', '#ffc9a3', '#f2994a', '#f7e3a1', '#2d2832']
const MAX_PHOTOS = 6

function textOn(hex) {
  const n = parseInt(hex.slice(1), 16)
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return l > 0.62 ? '#2d2832' : '#fff'
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const dayTitle = (d) => (isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEEE, d MMMM yyyy'))

function Linked({ text }) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{part}</a>
    ) : (
      part
    ),
  )
}

function EmojiPanel({ onPick }) {
  const tabs = Object.keys(EMOJI)
  const [tab, setTab] = useState(tabs[0])
  return (
    <div className="emoji-panel">
      <div className="emoji-tabs">
        {tabs.map((t) => (
          <button type="button" key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div className="emoji-grid">
        {EMOJI[tab].map((e) => (
          <button type="button" key={e} onClick={() => onPick(e)}>{e}</button>
        ))}
      </div>
    </div>
  )
}

function Voice({ url, seconds }) {
  const a = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const total = seconds || 0
  function toggle() {
    if (!a.current) return
    if (playing) a.current.pause()
    else a.current.play().catch(() => {})
  }
  return (
    <div className="voice">
      <button type="button" onClick={toggle} disabled={!url} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <div className="voice-bar"><i style={{ width: total ? Math.min(100, (pos / total) * 100) + '%' : '0%' }} /></div>
      <small>{mmss(playing || pos ? pos : total)}</small>
      {url && (
        <audio
          ref={a}
          src={url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setPos(0) }}
          onTimeUpdate={(e) => setPos(e.target.currentTime)}
        />
      )}
    </div>
  )
}

function GroupAvatar({ size = 'md' }) {
  return (
    <span className={'avatar gav ' + size}>
      <Users size={size === 'md' ? 22 : 16} />
    </span>
  )
}

function CallRow({ m, mine, onCall }) {
  const video = !!m.meta?.video
  const s = m.meta?.status
  const stale = s === 'ringing' && Date.now() - parseISO(m.created_at) > 60000
  let text
  if (s === 'ringing' && !stale) text = mine ? 'Calling…' : `Incoming ${video ? 'video' : 'voice'} call`
  else if (s === 'ringing' || s === 'missed') text = mine ? 'No answer' : `Missed ${video ? 'video' : 'voice'} call`
  else if (s === 'declined') text = mine ? 'Call declined' : 'You declined'
  else text = `${video ? 'Video' : 'Voice'} call · ${mmss(m.meta?.seconds || 0)}`
  const bad = (s === 'missed' || stale) && !mine
  return (
    <div className="call-row">
      <span className={bad ? 'bad' : ''}>
        {bad ? <PhoneMissed size={15} /> : video ? <Video size={15} /> : <Phone size={15} />} {text}
        <small> · {format(parseISO(m.created_at), 'HH:mm')}</small>
      </span>
      <button type="button" onClick={() => onCall(video)}>Call back</button>
    </div>
  )
}

function Conversation({ chat, call, push, me, members, chatKey, groupName, onBack, memberById, colorOf }) {
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [editing, setEditing] = useState(null)
  const [files, setFiles] = useState([])
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [active, setActive] = useState(null)
  const [pickFor, setPickFor] = useState(null)
  const [query, setQuery] = useState(null) // null = search closed
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [zoom, setZoom] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [rec, setRec] = useState(null) // { seconds }
  const [atBottom, setAtBottom] = useState(true)

  const listRef = useRef(null)
  const taRef = useRef(null)
  const fileRef = useRef(null)
  const stick = useRef(true)
  const keep = useRef(null)
  const first = useRef(true)
  const recorder = useRef(null)
  const chunks = useRef([])
  const recTimer = useRef(null)
  const recCancel = useRef(false)

  const { messages, reactions, urls, settings } = chat
  const typingIds = chat.typing
  const typing = typingIds.length > 0
  const isGroup = chatKey === GROUP
  const peer = isGroup ? null : memberById[chatKey]
  const meId = me.user_id
  const bubbleColor = settings.color || '#f6a9c4'
  const nameOf = (id) => settings.nicknames?.[id] || memberById[id]?.display_name || 'Someone'
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
  const quick = settings.quick_emoji || '👍'

  const byId = useMemo(() => Object.fromEntries(messages.map((m) => [m.id, m])), [messages])
  const reactBy = useMemo(() => {
    const o = {}
    for (const r of reactions) (o[r.message_id] ||= []).push(r)
    return o
  }, [reactions])

  const shown = useMemo(() => {
    const q = (query || '').trim().toLowerCase()
    if (!q) return messages
    return messages.filter((m) => !m.deleted_at && (m.body || '').toLowerCase().includes(q))
  }, [messages, query])

  const lastMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].user_id === meId && messages[i].kind !== 'call') return messages[i].id
    return null
  }, [messages, meId])

  // keep the view at the newest message, but do not jump while reading old ones
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    if (keep.current != null) {
      el.scrollTop = el.scrollHeight - keep.current
      keep.current = null
    } else if (stick.current || first.current) {
      el.scrollTop = el.scrollHeight
      if (messages.length) first.current = false
    }
  }, [messages, typing])

  function onScroll() {
    const el = listRef.current
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    stick.current = near
    setAtBottom(near)
  }
  function toBottom() {
    const el = listRef.current
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }
  function older() {
    keep.current = listRef.current.scrollHeight
    chat.loadMore()
  }

  // mark as read while the chat is open and visible
  const { markRead } = chat
  useEffect(() => {
    if (!document.hidden) markRead()
    const vis = () => !document.hidden && markRead()
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [markRead])

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.preview)), []) // eslint-disable-line

  function grow() {
    const t = taRef.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = Math.min(t.scrollHeight, 120) + 'px'
  }

  function reset() {
    setText('')
    setReplyTo(null)
    setEditing(null)
    files.forEach((f) => URL.revokeObjectURL(f.preview))
    setFiles([])
    setEmojiOpen(false)
    requestAnimationFrame(grow)
  }

  async function submit(e) {
    e?.preventDefault()
    if (busy) return
    const body = text.trim()
    if (editing) {
      if (!body) return
      setBusy(true)
      const problem = editing.body === body ? null : await chat.edit(editing.id, body)
      setBusy(false)
      if (problem) return setErr(problem)
      return reset()
    }
    if (!body && !files.length) return
    setBusy(true)
    setErr('')
    stick.current = true
    const problem = await chat.send({ body, files: files.map((f) => f.file), replyTo: replyTo?.id || null })
    setBusy(false)
    if (problem) return setErr(problem)
    reset()
  }

  async function sendQuick() {
    stick.current = true
    const problem = await chat.send({ body: quick, replyTo: replyTo?.id || null })
    if (problem) setErr(problem)
    else reset()
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey && !coarse) {
      e.preventDefault()
      submit()
    }
    if (e.key === 'Escape') reset()
  }

  function pickFiles(e) {
    const chosen = [...(e.target.files || [])]
    e.target.value = ''
    const room = MAX_PHOTOS - files.length
    setFiles((p) => [...p, ...chosen.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }))])
  }

  // ---- voice notes ----
  async function startRec() {
    setErr('')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(s)
      chunks.current = []
      recCancel.current = false
      mr.ondataavailable = (ev) => ev.data.size && chunks.current.push(ev.data)
      const t0 = Date.now()
      mr.onstop = async () => {
        s.getTracks().forEach((t) => t.stop())
        clearInterval(recTimer.current)
        setRec(null)
        if (recCancel.current) return
        const seconds = (Date.now() - t0) / 1000
        if (seconds < 1) return
        setBusy(true)
        stick.current = true
        const problem = await chat.send({ voice: { blob: new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' }), seconds }, replyTo: replyTo?.id || null })
        setBusy(false)
        if (problem) setErr(problem)
        else setReplyTo(null)
      }
      mr.start()
      recorder.current = mr
      setRec({ seconds: 0 })
      recTimer.current = setInterval(() => setRec({ seconds: (Date.now() - t0) / 1000 }), 250)
    } catch {
      setErr('Could not use the microphone. Check the browser permission.')
    }
  }
  function stopRec(cancel) {
    recCancel.current = cancel
    recorder.current?.stop()
  }
  useEffect(() => () => { recCancel.current = true; recorder.current?.state === 'recording' && recorder.current.stop() }, [])

  // ---- message actions ----
  async function doReact(m, emoji) {
    setActive(null)
    setPickFor(null)
    const p = await chat.react(m.id, emoji)
    if (p) setErr(p)
  }
  async function unsend(m) {
    setActive(null)
    if (!confirm('Unsend this message for everyone?')) return
    const p = await chat.unsend(m)
    if (p) setErr(p)
  }
  function startEdit(m) {
    setActive(null)
    setReplyTo(null)
    setEditing(m)
    setText(m.body || '')
    setTimeout(() => { taRef.current?.focus(); grow() }, 0)
  }
  function startReply(m) {
    setActive(null)
    setEditing(null)
    setReplyTo(m)
    taRef.current?.focus()
  }
  function jumpTo(id) {
    const el = listRef.current?.querySelector(`[data-mid="${id}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('flash')
    setTimeout(() => el.classList.remove('flash'), 1400)
  }

  const title = isGroup ? groupName : peer ? nameOf(peer.user_id) : 'Chat'
  const onlineNow = isGroup ? members.filter((m) => m.user_id !== meId && chat.onlineIds.includes(m.user_id)) : []
  const online = !isGroup && chat.onlineIds.includes(chatKey)
  const status = typing
    ? isGroup ? `${typingIds.slice(0, 2).map(nameOf).join(', ')} typing…` : 'typing…'
    : isGroup
      ? onlineNow.length ? `${onlineNow.length} active now` : `${members.length} people`
      : online ? 'Active now' : 'Not online'
  const statusOn = typing || online || onlineNow.length > 0

  // build rows (day separators + grouping)
  const rows = []
  let prev = null
  shown.forEach((m, i) => {
    const d = parseISO(m.created_at)
    if (!prev || format(parseISO(prev.created_at), 'yyyy-MM-dd') !== format(d, 'yyyy-MM-dd')) {
      rows.push(<div className="day-sep" key={'d' + m.id}><span>{dayTitle(d)}</span></div>)
    }
    const next = shown[i + 1]
    const near = (a, b) => a && b && a.user_id === b.user_id && a.kind !== 'call' && b.kind !== 'call' && Math.abs(parseISO(b.created_at) - parseISO(a.created_at)) < 5 * 60000 && format(parseISO(a.created_at), 'yyyy-MM-dd') === format(parseISO(b.created_at), 'yyyy-MM-dd')
    const lastInGroup = !near(m, next)
    const firstInGroup = !near(shown[i - 1], m)
    prev = m

    const mine = m.user_id === meId
    if (m.kind === 'call') {
      rows.push(<CallRow key={m.id} m={m} mine={mine} onCall={(v) => call.start(v, chatKey)} />)
      return
    }
    if (m.deleted_at) {
      rows.push(
        <div key={m.id} className={'msg ' + (mine ? 'mine' : 'theirs')}>
          <div className="msg-col"><div className="bubble gone">{mine ? 'You' : nameOf(m.user_id)} unsent a message</div></div>
        </div>,
      )
      return
    }
    const photos = (m.media || []).map((p) => urls[p]).filter(Boolean)
    const imgOnly = m.kind === 'image' && !m.body
    const rx = reactBy[m.id] || []
    const counts = {}
    for (const r of rx) counts[r.emoji] = (counts[r.emoji] || 0) + 1
    const replied = m.reply_to ? byId[m.reply_to] : null
    const open = active === m.id
    rows.push(
      <div key={m.id} data-mid={m.id} className={'msg ' + (mine ? 'mine' : 'theirs') + (open ? ' open' : '')}>
        {!mine && (
          <span className="msg-av">
            {lastInGroup && <Avatar url={memberById[m.user_id]?.avatar_url} name={nameOf(m.user_id)} color={colorOf(m.user_id)} />}
          </span>
        )}
        <div className="msg-col">
          {!mine && isGroup && firstInGroup && <small className="who">{nameOf(m.user_id)}</small>}
          {m.reply_to && (
            <button type="button" className="quote" onClick={() => replied && jumpTo(replied.id)}>
              <CornerUpLeft size={12} /> {replied ? (replied.user_id === meId ? 'You' : nameOf(replied.user_id)) : 'Message'}
              <span>{replied ? preview(replied) : 'Earlier message'}</span>
            </button>
          )}
          <div
            className={'bubble' + (imgOnly ? ' bare' : '') + (rx.length ? ' has-rx' : '')}
            style={mine && !imgOnly ? { background: bubbleColor, color: textOn(bubbleColor), borderColor: bubbleColor } : undefined}
            onClick={() => { setActive(open ? null : m.id); setPickFor(null) }}
          >
            {photos.length > 0 && (
              <div className={'cgrid n' + Math.min(photos.length, 4)}>
                {photos.map((u, k) => (
                  <button
                    type="button"
                    key={u}
                    onClick={(e) => {
                      e.stopPropagation()
                      setZoom({ items: photos.map((x) => ({ url: x, caption: `${nameOf(m.user_id)} · ${format(parseISO(m.created_at), 'd MMM, HH:mm')}` })), index: k })
                    }}
                  >
                    <img src={u} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
            {m.kind === 'voice' && <Voice url={urls[(m.media || [])[0]]} seconds={m.meta?.seconds} />}
            {m.body && <p><Linked text={m.body} />{m.edited_at && <small className="edited"> (edited)</small>}</p>}
            {rx.length > 0 && (
              <span className="rx">
                {Object.entries(counts).map(([e, n]) => <i key={e}>{e}{n > 1 ? n : ''}</i>)}
              </span>
            )}
          </div>

          {open && (
            <div className="actions" onClick={(e) => e.stopPropagation()}>
              <div className="quick">
                {QUICK.map((e) => <button type="button" key={e} onClick={() => doReact(m, e)}>{e}</button>)}
                <button type="button" onClick={() => setPickFor(pickFor === m.id ? null : m.id)} aria-label="More reactions">+</button>
              </div>
              {pickFor === m.id && <EmojiPanel onPick={(e) => doReact(m, e)} />}
              <div className="acts">
                <button type="button" onClick={() => startReply(m)}><CornerUpLeft size={15} /> Reply</button>
                {m.body && <button type="button" onClick={() => { navigator.clipboard?.writeText(m.body); setActive(null) }}><Copy size={15} /> Copy</button>}
                {mine && m.kind === 'text' && <button type="button" onClick={() => startEdit(m)}><Pencil size={15} /> Edit</button>}
                {mine && <button type="button" className="warn" onClick={() => unsend(m)}><Trash2 size={15} /> Unsend</button>}
              </div>
            </div>
          )}

          {(lastInGroup || open) && (
            <small className="time">
              {format(parseISO(m.created_at), 'HH:mm')}
              {mine && m.id === lastMineId && (() => {
                if (!isGroup) {
                  return chat.partnerRead >= m.created_at
                    ? <span className="seen"><CheckCheck size={14} /> Seen</span>
                    : <span><Check size={14} /> Sent</span>
                }
                const seenBy = chat.groupReads.filter((r) => r.read_at >= m.created_at).map((r) => r.user_id)
                if (!seenBy.length) return <span><Check size={14} /> Sent</span>
                const everyone = seenBy.length >= members.length - 1
                return <span className="seen"><CheckCheck size={14} /> Seen by {everyone ? 'everyone' : seenBy.map(nameOf).join(', ')}</span>
              })()}
            </small>
          )}
        </div>
      </div>,
    )
  })

  return (
    <div className="chat card">
      <header className="chat-head">
        <button className="icon-btn back" onClick={onBack} aria-label="Back to chats"><ChevronLeft size={20} /></button>
        {isGroup
          ? <GroupAvatar size="md" />
          : <Avatar url={peer?.avatar_url} name={title} color={peer ? colorOf(peer.user_id) : undefined} size="md" />}
        <div className="chat-title">
          <strong>{title}</strong>
          <small className={statusOn ? 'on' : ''}>{status}</small>
        </div>
        {!isGroup && (
          <>
            <button className="icon-btn" disabled={!peer} onClick={() => call.start(false, chatKey)} aria-label="Voice call"><Phone size={17} /></button>
            <button className="icon-btn" disabled={!peer} onClick={() => call.start(true, chatKey)} aria-label="Video call"><Video size={17} /></button>
          </>
        )}
        <button className={'icon-btn' + (query !== null ? ' lit' : '')} onClick={() => setQuery(query === null ? '' : null)} aria-label="Search in chat"><Search size={17} /></button>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Chat settings"><Settings size={17} /></button>
      </header>

      {query !== null && (
        <div className="chat-search">
          <Search size={15} />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search in this chat" />
          <button type="button" onClick={() => setQuery(null)} aria-label="Close search"><X size={16} /></button>
        </div>
      )}

      {call.error && (
        <div className="chat-note" onClick={call.clearError}>{call.error} <X size={14} /></div>
      )}

      <div className="chat-list" ref={listRef} onScroll={onScroll} onClick={() => { setActive(null); setPickFor(null) }}>
        {chat.hasMore && query === null && (
          <button type="button" className="older" onClick={older}>Load earlier messages</button>
        )}
        {messages.length === 0 && <p className="empty">{isGroup ? 'No messages in the group yet. Say hi 👋' : `No messages yet. Say hi to ${title} 👋`}</p>}
        {query !== null && query.trim() && shown.length === 0 && <p className="empty">No messages found.</p>}
        {rows}
        {typing && (
          <div className="msg theirs">
            <span className="msg-av"><Avatar url={memberById[typingIds[0]]?.avatar_url} name={nameOf(typingIds[0])} color={colorOf(typingIds[0])} /></span>
            <div className="msg-col"><div className="bubble typing"><i /><i /><i /></div></div>
          </div>
        )}
      </div>

      {!atBottom && (
        <button className="to-bottom" onClick={toBottom} aria-label="Jump to latest">
          <ArrowDown size={18} />{chat.unreadActive > 0 && <b>{chat.unreadActive}</b>}
        </button>
      )}

      <form className="composer-bar" onSubmit={submit}>
        {(replyTo || editing) && (
          <div className="ctx">
            {editing ? <Pencil size={14} /> : <CornerUpLeft size={14} />}
            <span>
              {editing ? 'Editing message' : `Replying to ${replyTo.user_id === meId ? 'yourself' : nameOf(replyTo.user_id)}`}
              <em>{preview(editing || replyTo)}</em>
            </span>
            <button type="button" onClick={reset} aria-label="Cancel"><X size={16} /></button>
          </div>
        )}
        {files.length > 0 && (
          <div className="previews">
            {files.map((f, i) => (
              <div className="preview" key={f.preview}>
                <img src={f.preview} alt="" />
                <button type="button" onClick={() => { URL.revokeObjectURL(f.preview); setFiles((p) => p.filter((_, j) => j !== i)) }} aria-label="Remove photo"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
        {emojiOpen && <EmojiPanel onPick={(e) => { setText((t) => t + e); taRef.current?.focus() }} />}
        {err && <p className="error" onClick={() => setErr('')}>{err}</p>}

        {rec ? (
          <div className="bar rec">
            <button type="button" className="icon-btn" onClick={() => stopRec(true)} aria-label="Cancel recording"><Trash2 size={17} /></button>
            <span className="rec-dot" /> <b>{mmss(rec.seconds)}</b> <span className="muted">Recording…</span>
            <button type="button" className="send-btn" style={{ background: bubbleColor, color: textOn(bubbleColor) }} onClick={() => stopRec(false)} aria-label="Send voice message"><Send size={18} /></button>
          </div>
        ) : (
          <div className="bar">
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pickFiles} />
            {!editing && (
              <>
                <button type="button" className="tool" disabled={files.length >= MAX_PHOTOS} onClick={() => fileRef.current?.click()} aria-label="Add photos"><Camera size={21} /></button>
                <button type="button" className="tool" onClick={startRec} aria-label="Record voice message"><Mic size={21} /></button>
              </>
            )}
            <div className="field">
              <textarea
                ref={taRef}
                rows={1}
                value={text}
                maxLength={4000}
                placeholder="Message"
                onChange={(e) => { setText(e.target.value); grow(); if (e.target.value) chat.notifyTyping(true) }}
                onKeyDown={onKey}
                onFocus={() => setEmojiOpen(false)}
              />
              <button type="button" className={'tool in' + (emojiOpen ? ' lit' : '')} onClick={() => setEmojiOpen((v) => !v)} aria-label="Emoji"><Smile size={20} /></button>
            </div>
            {text.trim() || files.length || editing ? (
              <button className="send-btn" style={{ background: bubbleColor, color: textOn(bubbleColor) }} disabled={busy} aria-label="Send">
                {editing ? <Check size={18} /> : <Send size={18} />}
              </button>
            ) : (
              <button type="button" className="quick-btn" onClick={sendQuick} aria-label="Send quick reaction">{quick}</button>
            )}
          </div>
        )}
      </form>

      {zoom && <Lightbox items={zoom.items} index={zoom.index} onIndex={(index) => setZoom({ ...zoom, index })} onClose={() => setZoom(null)} />}

      {settingsOpen && (
        <Settings_
          chat={chat}
          me={me}
          members={members}
          push={push}
          nameOf={nameOf}
          memberById={memberById}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

function Settings_({ chat, push, me, members, memberById, onClose }) {
  const { settings } = chat
  const ids = members.map((m) => m.user_id)
  const [nick, setNick] = useState(() => Object.fromEntries(ids.map((id) => [id, settings.nicknames?.[id] || ''])))
  const [err, setErr] = useState('')
  async function save(patch) {
    const p = await chat.saveSettings(patch)
    if (p) setErr(p)
  }
  async function done() {
    const nicknames = {}
    for (const id of ids) if (nick[id]?.trim()) nicknames[id] = nick[id].trim()
    await save({ nicknames })
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><h2>Chat settings</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button></div>

        <div className="set-block">
          <strong>Nicknames</strong>
          <p className="muted small">Shown in every chat. Settings here apply to all your chats.</p>
          {ids.map((id) => (
            <label key={id} className="nick">
              <span>{id === me.user_id ? 'You' : memberById[id]?.display_name}</span>
              <input value={nick[id]} onChange={(e) => setNick({ ...nick, [id]: e.target.value })} maxLength={30} placeholder={memberById[id]?.display_name} />
            </label>
          ))}
        </div>

        <div className="set-block">
          <strong>Chat colour</strong>
          <div className="swatches">
            {COLORS.map((c) => (
              <button key={c} type="button" style={{ background: c }} className={(settings.color || '#f6a9c4') === c ? 'on' : ''} onClick={() => save({ color: c })} aria-label={c}>
                {(settings.color || '#f6a9c4') === c && <Check size={16} color={textOn(c)} />}
              </button>
            ))}
          </div>
        </div>

        <div className="set-block">
          <strong>Quick reaction</strong>
          <p className="muted small">Sent with one tap when the message box is empty.</p>
          <div className="quick-pick">
            {['👍', '❤️', '😂', '🔥', '😘', '🥰', '😍', '🙏'].map((e) => (
              <button key={e} type="button" className={(settings.quick_emoji || '👍') === e ? 'on' : ''} onClick={() => save({ quick_emoji: e })}>{e}</button>
            ))}
          </div>
        </div>

        {push && push.state !== 'unavailable' && (
          <div className="set-block">
            <strong>Notifications</strong>
            {push.state === 'on' && (
              <>
                <p className="muted small"><Bell size={13} /> On for this phone. You get messages and ringing calls even when the app is closed.</p>
                <button type="button" className="btn ghost" onClick={push.disable}>Turn off</button>
              </>
            )}
            {push.state === 'off' && (
              <button type="button" className="btn ghost" onClick={push.enable}>Turn on notifications</button>
            )}
            {push.state === 'install' && <p className="muted small">On iPhone, first add the site to your Home Screen and open it from there.</p>}
            {push.state === 'denied' && <p className="muted small">Notifications are blocked. Allow them for this app in your phone settings.</p>}
            {push.err && <p className="error">{push.err}</p>}
          </div>
        )}

        {err && <p className="error">{err}</p>}
        <button className="btn primary" onClick={done}>Done</button>
      </div>
    </div>
  )
}

const when = (iso) => {
  const d = parseISO(iso)
  if (isToday(d)) return format(d, 'HH:mm')
  if (isYesterday(d)) return 'Yesterday'
  if (Date.now() - d.getTime() < 6 * 86400000) return format(d, 'EEE')
  return format(d, 'd MMM')
}

// The Messenger-style list: the group chat and one private chat with every other person
function ChatList({ chat, push, me, members, memberById, colorOf, groupName }) {
  const [q, setQ] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const nick = chat.settings.nicknames
  const meId = me.user_id

  const items = useMemo(() => {
    const nameOf = (id) => nick?.[id] || memberById[id]?.display_name || 'Someone'
    const needle = q.trim().toLowerCase()
    return chat.chats
      .map((c) => {
        const isGroup = c.key === GROUP
        const name = isGroup ? groupName : nameOf(c.key)
        let line
        if (!c.last) line = isGroup ? `Group · ${members.length} ${members.length === 1 ? 'person' : 'people'}` : 'Say hi 👋'
        else {
          const mine = c.last.user_id === meId
          const who = mine ? 'You: ' : isGroup ? nameOf(c.last.user_id) + ': ' : ''
          line = who + preview(c.last)
        }
        return { ...c, isGroup, name, line, person: isGroup ? null : memberById[c.key] }
      })
      .filter((c) => !needle || c.name.toLowerCase().includes(needle))
      .sort((a, b) => {
        if (a.last && b.last) return b.last.created_at.localeCompare(a.last.created_at)
        if (a.last) return -1
        if (b.last) return 1
        if (a.isGroup !== b.isGroup) return a.isGroup ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }, [chat.chats, nick, memberById, groupName, members.length, meId, q])

  return (
    <div className="chat card chat-hub">
      <header className="hub-head">
        <h2>Chats</h2>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Chat settings"><Settings size={17} /></button>
      </header>
      <label className="hub-search">
        <Search size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" />
      </label>
      <div className="hub-list">
        {items.map((c) => (
          <button key={c.key} className={'crow' + (c.unread ? ' unread' : '')} onClick={() => chat.openChat(c.key)}>
            <span className="crow-av">
              {c.isGroup
                ? <GroupAvatar size="md" />
                : <Avatar url={c.person?.avatar_url} name={c.name} color={c.person ? colorOf(c.key) : undefined} size="md" />}
              {!c.isGroup && chat.onlineIds.includes(c.key) && <i className="on-dot" />}
            </span>
            <span className="crow-main">
              <strong>{c.name}</strong>
              <small>{c.line}</small>
            </span>
            <span className="crow-side">
              {c.last && <time>{when(c.last.created_at)}</time>}
              {c.unread > 0 && <b className="badge">{c.unread > 99 ? '99+' : c.unread}</b>}
            </span>
          </button>
        ))}
        {items.length === 0 && <p className="empty">No chats found.</p>}
        {members.length < 2 && !q.trim() && (
          <p className="empty">When others join with your invite code, you can also chat privately with each of them here.</p>
        )}
      </div>
      {settingsOpen && (
        <Settings_ chat={chat} me={me} members={members} push={push} memberById={memberById} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}

export default function Chat({ chat, call, push, me, members, memberById, colorOf, groupName }) {
  const key = chat.activeKey
  if (key) {
    return (
      <Conversation
        key={key}
        chat={chat}
        call={call}
        push={push}
        me={me}
        members={members}
        chatKey={key}
        groupName={groupName}
        onBack={chat.closeChat}
        memberById={memberById}
        colorOf={colorOf}
      />
    )
  }
  return <ChatList chat={chat} push={push} me={me} members={members} memberById={memberById} colorOf={colorOf} groupName={groupName} />
}
