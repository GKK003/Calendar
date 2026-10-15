import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

// items: [{ url, caption }]   index: which one is open
export default function Lightbox({ items, index, onIndex, onClose }) {
  const item = items[index]
  const many = items.length > 1
  const step = (d) => onIndex((index + d + items.length) % items.length)

  useEffect(() => {
    function key(e) {
      if (e.key === 'Escape') onClose()
      else if (many && e.key === 'ArrowLeft') step(-1)
      else if (many && e.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  if (!item) return null
  return (
    <div className="lb" onClick={onClose}>
      <button className="lb-btn lb-close" onClick={onClose} aria-label="Close">
        <X size={22} />
      </button>
      {many && (
        <button
          className="lb-btn lb-prev"
          onClick={(e) => {
            e.stopPropagation()
            step(-1)
          }}
          aria-label="Previous photo"
        >
          <ChevronLeft size={26} />
        </button>
      )}
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={item.url} alt="" />
        {(item.caption || many) && (
          <figcaption>
            {item.caption}
            {many && <span> · {index + 1} / {items.length}</span>}
          </figcaption>
        )}
      </figure>
      {many && (
        <button
          className="lb-btn lb-next"
          onClick={(e) => {
            e.stopPropagation()
            step(1)
          }}
          aria-label="Next photo"
        >
          <ChevronRight size={26} />
        </button>
      )}
    </div>
  )
}
