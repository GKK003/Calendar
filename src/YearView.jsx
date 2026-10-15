import { eachDayOfInterval, endOfMonth, format, getDay, isToday, startOfMonth } from 'date-fns'
import { ymd } from './lib.js'

export default function YearView({ year, byDate, onPick }) {
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1))
  return (
    <div className="year">
      {months.map((m) => {
        const days = eachDayOfInterval({ start: startOfMonth(m), end: endOfMonth(m) })
        const lead = (getDay(m) + 6) % 7 // Monday-first
        return (
          <div className="mini" key={m.getMonth()}>
            <button className="mini-title" onClick={() => onPick(m)}>{format(m, 'MMMM')}</button>
            <div className="mini-grid">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="dow">{d}</span>)}
              {Array.from({ length: lead }).map((_, i) => <span key={'l' + i} />)}
              {days.map((d) => {
                const list = byDate[ymd(d)] || []
                const n = list.length
                const special = list.some((e) => e.type === 'special')
                return (
                  <button key={d} className={'md' + (n ? ' has' : '') + (n > 2 ? ' busy' : '') + (special ? ' special' : '') + (isToday(d) ? ' today' : '')} onClick={() => onPick(d)}>
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
