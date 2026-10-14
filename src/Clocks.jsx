import { useEffect, useState } from 'react'
import { ZONES, clockIn } from './lib.js'

export default function Clocks({ compact = false, tz }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className={'clocks' + (compact ? ' compact' : '')}>
      {[...ZONES].sort((a, b) => (b.id === tz) - (a.id === tz)).map((z) => (
        <div className="clock" key={z.id}>
          <span>{z.label}</span>
          <b>{clockIn(z.id, now)}</b>
        </div>
      ))}
    </div>
  )
}
