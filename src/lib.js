import { addDays, format, parseISO } from 'date-fns'

export const TYPES = {
  work: { label: 'Work', color: '#f48fb1' },
  study: { label: 'Study', color: '#7fcfa3' },
  important: { label: 'Important', color: '#ffb27a' },
  personal: { label: 'Personal', color: '#b9a6f2' },
  special: { label: 'Special', color: '#e8a93a' },
}

// Fallback avatar colors when someone has not picked one yet (same on every phone)
export const AVATARS = ['#f6a9c4', '#a9ddc2', '#cdb8f5', '#ffc9a3', '#a8d4f5', '#f7e3a1']

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
export const CITIES = [
  { id: 'tbilisi', label: 'Tbilisi', tz: 'Asia/Tbilisi' },
  { id: 'nyc', label: 'New York', tz: 'America/New_York' },
]

export const ZONES = CITIES.map((c) => ({ id: c.tz, label: c.label }))

export const zoneLabel = (tz) => (ZONES.find((z) => z.id === tz) || ZONES[0]).label

export const zoneOfCity = (city) => (CITIES.find((c) => c.id === city) || CITIES[0]).tz

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

export function localizeEvent(ev, tz) {
  if (!ev.tz || !ev.start_time || ev.tz === tz) return ev
  const s = convertTime(ev.date, hm(ev.start_time), ev.tz, tz)
  const e = ev.end_time ? convertTime(ev.date, hm(ev.end_time), ev.tz, tz) : null
  return {
    ...ev,
    date: ymd(addDays(parseISO(ev.date), s.dayShift)),
    start_time: s.time,
    end_time: e ? e.time : null,
    origin: { tz: ev.tz, start_time: hm(ev.start_time), end_time: hm(ev.end_time) },
  }
}

// Colors people can pick for their avatar
export const PALETTE = ['#f6a9c4', '#a9ddc2', '#cdb8f5', '#ffc9a3', '#a8d4f5', '#f7e3a1']

// Turn what was typed in "Place" into a link that opens the Maps app on a phone.
// Accepts a map link, or just an address (then it searches that address on Google Maps).
export function mapHref(place) {
  const t = (place || '').trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  if (/^(www\.|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google|google\.[a-z.]+\/maps|maps\.apple\.com)/i.test(t)) return 'https://' + t
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(t)
}
