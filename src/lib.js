import { format } from 'date-fns'

export const TYPES = {
  work: { label: 'Work', color: '#f48fb1' },
  study: { label: 'Study', color: '#7fcfa3' },
  important: { label: 'Important', color: '#ffb27a' },
  personal: { label: 'Personal', color: '#b9a6f2' },
}

// Avatar colors for the two people (same on both phones)
export const AVATARS = ['#f6a9c4', '#a9ddc2']

export const ymd = (d) => format(d, 'yyyy-MM-dd')
export const hm = (t) => (t ? t.slice(0, 5) : '')

export function timeLabel(ev) {
  if (!ev.start_time) return 'All day'
  return ev.end_time ? `${hm(ev.start_time)} – ${hm(ev.end_time)}` : hm(ev.start_time)
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Morning'
  if (h < 18) return 'Afternoon'
  return 'Evening'
}

export function sortEvents(list) {
  return [...list].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
}

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// ---------- time zones ----------
export const ZONES = [
  { id: 'Asia/Tbilisi', label: 'Tbilisi' },
  { id: 'America/New_York', label: 'New York' },
]

export function clockIn(tz, date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date)
}

function tzOffset(tz, ts) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ts))
  const g = (t) => Number(p.find((x) => x.type === t).value)
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - ts
}

// Convert a wall-clock time on a date from one zone to another (handles daylight saving)
export function convertTime(dateStr, time, from, to) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, h, mi)
  let utc = guess - tzOffset(from, guess)
  utc = guess - tzOffset(from, utc)
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: to, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(utc))
  const g = (t) => p.find((x) => x.type === t).value
  const dayShift = Math.round((Date.UTC(+g('year'), +g('month') - 1, +g('day')) - Date.UTC(y, m - 1, d)) / 86400000)
  return { time: `${g('hour')}:${g('minute')}`, dayShift }
}

// Colors people can pick for their avatar
export const PALETTE = ['#f6a9c4', '#a9ddc2', '#cdb8f5', '#ffc9a3', '#a8d4f5', '#f7e3a1']
