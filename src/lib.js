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

export function readStoredValue(key, fallback = '') {
  try {
    return globalThis.localStorage?.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function writeStoredValue(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value)
    return true
  } catch {
    return false
  }
}

// ---------- time zones ----------
export const CITIES = [
  { id: 'tbilisi', label: 'Tbilisi', tz: 'Asia/Tbilisi' },
  { id: 'nyc', label: 'New York', tz: 'America/New_York' },
]

export const ZONES = CITIES.map((c) => ({ id: c.tz, label: c.label }))

export const zoneLabel = (tz) => (ZONES.find((z) => z.id === tz) || ZONES[0]).label

export const zoneOfCity = (city) => (CITIES.find((c) => c.id === city) || CITIES[0]).tz

function zonedFormatter(locale, options) {
  const byZone = new Map()
  return (timeZone) => {
    if (!byZone.has(timeZone)) {
      byZone.set(timeZone, new Intl.DateTimeFormat(locale, { ...options, timeZone }))
    }
    return byZone.get(timeZone)
  }
}

const clockFormat = zonedFormatter('en-GB', {
  hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit',
})
const dateFormat = zonedFormatter('en-CA', {
  year: 'numeric', month: '2-digit', day: '2-digit',
})
const offsetFormat = zonedFormatter('en-US', {
  hourCycle: 'h23', era: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
})
const wallTimeFormat = zonedFormatter('en-GB', {
  hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
})

export function clockIn(tz, date = new Date()) {
  return clockFormat(tz).format(date)
}

export function dateInZone(tz, date = new Date()) {
  const parts = dateFormat(tz).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type).value
  return `${get('year')}-${get('month')}-${get('day')}`
}

function tzOffset(tz, ts) {
  const p = offsetFormat(tz).formatToParts(new Date(ts))
  const get = (type) => p.find((part) => part.type === type).value
  const year = Number(get('year'))
  const utc = new Date(0)
  utc.setUTCFullYear(get('era') === 'BC' ? 1 - year : year, Number(get('month')) - 1, Number(get('day')))
  utc.setUTCHours(Number(get('hour')), Number(get('minute')), Number(get('second')))
  return utc.getTime() - ts
}

export function wallTimeInstants(date, time, tz) {
  const wallTime = `${date}T${time}`
  const ts = Date.parse(`${wallTime}:00Z`)
  if (!Number.isFinite(ts) || new Date(ts).toISOString().slice(0, 16) !== wallTime) return null

  // Check both sides of a clock change. A local time can occur twice or be skipped.
  const day = 86_400_000
  const offsets = new Set([tzOffset(tz, ts - day), tzOffset(tz, ts + day)])
  return Array.from(offsets, (offset) => ts - offset)
    .filter((instant) => instant + tzOffset(tz, instant) === ts)
    .sort((a, b) => a - b)
}

// Convert a wall-clock time on a date from one zone to another (handles daylight saving)
export function convertTime(dateStr, time, from, to) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, h, mi)
  let utc = guess - tzOffset(from, guess)
  utc = guess - tzOffset(from, utc)
  const p = wallTimeFormat(to).formatToParts(new Date(utc))
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
    origin: {
      tz: ev.tz,
      date: ev.date,
      start_time: hm(ev.start_time),
      end_time: hm(ev.end_time),
    },
  }
}

export function eventOriginLabel(ev) {
  if (!ev?.origin?.date) return null
  const dayRelation = ev.origin.date < ev.date
    ? 'previous day'
    : ev.origin.date > ev.date
      ? 'next day'
      : 'same day'
  const originalTime = timeLabel({
    start_time: ev.origin.start_time,
    end_time: ev.origin.end_time,
  })
  return `${zoneLabel(ev.origin.tz)}: ${format(parseISO(ev.origin.date), 'EEE, d MMM')} · ${originalTime} (${dayRelation})`
}

// Colors people can pick for their avatar
export const PALETTE = ['#f6a9c4', '#a9ddc2', '#cdb8f5', '#ffc9a3', '#a8d4f5', '#f7e3a1']

// Turn what was typed in "Place" into a link that opens the Maps app on a phone.
// Accepts a map link, or just an address (then it searches that address on Google Maps).
export function mapHref(place) {
  const t = (place || '').trim()
  if (!t) return null
  let candidate = ''
  if (/^https?:\/\//i.test(t)) candidate = t
  else if (/^(www\.|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google|google\.[a-z.]+\/maps|maps\.apple\.com)/i.test(t)) candidate = 'https://' + t
  if (candidate) {
    try {
      const url = new URL(candidate)
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return null
      // Map destinations should never send a user's address over plain HTTP.
      if (url.protocol === 'http:') url.protocol = 'https:'
      return url.toString()
    } catch {
      return null
    }
  }
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(t)
}
