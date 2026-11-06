export default function Avatar({ url, name = '?', color, size = 'sm' }) {
  return (
    <span className={'avatar ' + size} style={{ background: color }} title={name}>
      {url ? <img src={url} alt={name} loading="lazy" decoding="async" /> : (name.trim()[0] || '?').toUpperCase()}
    </span>
  )
}
