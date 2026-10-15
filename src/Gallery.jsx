import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import './gallery.css'
import Lightbox from './Lightbox.jsx'

export default function Gallery({ shots, urls, me, others, memberById }) {
  const [who, setWho] = useState('all')
  const [open, setOpen] = useState(null)

  const list = useMemo(
    () => shots.filter((s) => urls[s.path] && (who === 'all' || s.user_id === who)),
    [shots, urls, who],
  )

  const months = []
  for (const s of list) {
    const key = format(parseISO(s.created_at), 'yyyy-MM')
    const last = months[months.length - 1]
    if (last && last.key === key) last.items.push(s)
    else months.push({ key, title: format(parseISO(s.created_at), 'MMMM yyyy'), items: [s] })
  }

  const caption = (s) => `${memberById[s.user_id]?.display_name || 'Someone'} · ${format(parseISO(s.created_at), 'd MMM yyyy, HH:mm')}`
  const items = list.map((s) => ({ url: urls[s.path], caption: caption(s) }))
  const indexOf = new Map(list.map((s, i) => [s.path, i]))

  return (
    <div className="gallery">
      <div className="gallery-head">
        <div>
          <h2>Gallery</h2>
          <p className="muted small">
            {list.length} {list.length === 1 ? 'photo' : 'photos'} from your posts, saved here automatically
          </p>
        </div>
        {others.length > 0 && (
          <div className="seg tiny">
            <button className={who === 'all' ? 'on' : ''} onClick={() => setWho('all')}>Everyone</button>
            <button className={who === me.user_id ? 'on' : ''} onClick={() => setWho(me.user_id)}>Me</button>
            {others.map((o) => (
              <button key={o.user_id} className={who === o.user_id ? 'on' : ''} onClick={() => setWho(o.user_id)}>
                {o.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {list.length === 0 && <p className="empty">No photos yet. Photos you add to a post appear here.</p>}

      {months.map((m) => (
        <section key={m.key} className="gmonth">
          <h3 className="day-title">{m.title}</h3>
          <div className="ggrid">
            {m.items.map((s) => (
              <button
                key={s.path}
                className="gthumb"
                onClick={() => setOpen(indexOf.get(s.path))}
                aria-label="Open photo"
              >
                <img src={urls[s.path]} alt="" loading="lazy" />
                <span>{format(parseISO(s.created_at), 'd MMM')}</span>
              </button>
            ))}
          </div>
        </section>
      ))}

      {open != null && items[open] && (
        <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}
