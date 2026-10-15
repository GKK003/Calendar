import { useRef, useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Camera, MapPin, Send, Trash2, X } from 'lucide-react'
import './posts.css'
import Avatar from './Avatar.jsx'
import { mapHref } from './lib.js'

const CHECKINS = ['Home', 'Work', 'Class', 'Out', 'On my way', 'Arrived', 'Good night']
const MAX_PHOTOS = 4

const ago = (iso) => formatDistanceToNow(parseISO(iso), { addSuffix: true })

export function Composer({ me, color, onPost }) {
  const [body, setBody] = useState('')
  const [checkin, setCheckin] = useState(null)
  const [place, setPlace] = useState('')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)

  function pick(e) {
    const chosen = [...(e.target.files || [])]
    e.target.value = ''
    const room = MAX_PHOTOS - files.length
    const added = chosen.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }))
    setFiles((p) => [...p, ...added])
  }

  function dropFile(i) {
    URL.revokeObjectURL(files[i].preview)
    setFiles((p) => p.filter((_, j) => j !== i))
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    if (!body.trim() && !checkin && !files.length) return setErr('Write something, check in or add a photo.')
    setBusy(true)
    setErr('')
    const problem = await onPost({ body, checkin, place, files: files.map((f) => f.file) })
    setBusy(false)
    if (problem) return setErr(problem)
    files.forEach((f) => URL.revokeObjectURL(f.preview))
    setBody('')
    setCheckin(null)
    setPlace('')
    setFiles([])
  }

  return (
    <form className="card composer" onSubmit={submit}>
      <div className="composer-head">
        <Avatar url={me.avatar_url} name={me.display_name} color={color} size="md" />
        <strong>New post</strong>
      </div>

      <textarea
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What is happening?"
        maxLength={1000}
      />

      <div className="ck-row">
        <span className="lbl">Check in</span>
        <div className="ck-chips">
          {CHECKINS.map((c) => (
            <button
              type="button"
              key={c}
              className={'ck-chip' + (checkin === c ? ' on' : '')}
              onClick={() => setCheckin(checkin === c ? null : c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {checkin && (
        <input
          className="ck-place"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="Where? A place or a map link (optional)"
          maxLength={120}
        />
      )}

      {files.length > 0 && (
        <div className="previews">
          {files.map((f, i) => (
            <div className="preview" key={f.preview}>
              <img src={f.preview} alt="" />
              <button type="button" onClick={() => dropFile(i)} aria-label="Remove photo">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {err && <p className="error">{err}</p>}

      <div className="composer-actions">
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pick} />
        <button
          type="button"
          className="btn ghost"
          disabled={files.length >= MAX_PHOTOS}
          onClick={() => fileRef.current?.click()}
        >
          <Camera size={16} /> Photos {files.length > 0 && `(${files.length}/${MAX_PHOTOS})`}
        </button>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>
    </form>
  )
}

export function PostCard({ post, owner, color, replies, urls, me, memberById, colorOf, api, onZoom }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const mine = post.user_id === me.user_id
  const photos = (post.photos || []).map((p) => urls[p]).filter(Boolean)
  const href = mapHref(post.place)

  async function remove() {
    if (!confirm('Delete this post?')) return
    const problem = await api.remove(post)
    if (problem) alert('Could not delete: ' + problem)
  }

  async function removeReply(id) {
    if (!confirm('Delete this reply?')) return
    const problem = await api.removeReply(id)
    if (problem) alert('Could not delete: ' + problem)
  }

  async function send(e) {
    e.preventDefault()
    if (busy || !text.trim()) return
    setBusy(true)
    const problem = await api.reply(post.id, text)
    setBusy(false)
    if (problem) return alert('Could not reply: ' + problem)
    setText('')
  }

  return (
    <article className="card post">
      <header className="post-head">
        <Avatar url={owner?.avatar_url} name={owner?.display_name || '?'} color={color} size="md" />
        <div className="post-who">
          <strong>{owner?.display_name || 'Someone'}</strong>
          <small className="muted" title={new Date(post.created_at).toLocaleString()}>{ago(post.created_at)}</small>
        </div>
        {mine && (
          <button className="icon-btn" onClick={remove} aria-label="Delete post">
            <Trash2 size={16} />
          </button>
        )}
      </header>

      {post.checkin && (
        <div className="ck-pill">
          <MapPin size={14} /> {post.checkin}
          {post.place && (
            <>
              {' · '}
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer">{post.place}</a>
              ) : (
                post.place
              )}
            </>
          )}
        </div>
      )}

      {post.body && <p className="post-body">{post.body}</p>}

      {photos.length > 0 && (
        <div className={'pgrid n' + photos.length}>
          {photos.map((u, i) => (
            <button
              key={u}
              onClick={() =>
                onZoom(
                  photos.map((x) => ({ url: x, caption: `${owner?.display_name || 'Someone'} · ${ago(post.created_at)}` })),
                  i,
                )
              }
              aria-label="View photo"
            >
              <img src={u} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <div className="replies">
        {replies.map((r) => {
          const who = memberById[r.user_id]
          return (
            <div className="reply" key={r.id}>
              <Avatar url={who?.avatar_url} name={who?.display_name || '?'} color={colorOf(r.user_id)} />
              <div className="reply-main">
                <div className="reply-top">
                  <strong>{who?.display_name || 'Someone'}</strong>
                  <small className="muted">{ago(r.created_at)}</small>
                  {r.user_id === me.user_id && (
                    <button className="reply-del" onClick={() => removeReply(r.id)} aria-label="Delete reply">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <p>{r.body}</p>
              </div>
            </div>
          )
        })}
        <form className="reply-form" onSubmit={send}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a reply"
            maxLength={500}
          />
          <button className="icon-btn send" disabled={busy || !text.trim()} aria-label="Send reply">
            <Send size={16} />
          </button>
        </form>
      </div>
    </article>
  )
}
