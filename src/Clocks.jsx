import { useEffect, useState } from 'react'
import { ZONES, clockIn } from './lib.js'

export default function Clocks({ compact = false }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className={'clocks' + (compact ? ' compact' : '')}>
      {ZONES.map((z) => (
        <div className="clock" key={z.id}>
          <span>{z.label}</span>
          <b>{clockIn(z.id, now)}</b>
        </div>
      ))}
    </div>
  )
}
