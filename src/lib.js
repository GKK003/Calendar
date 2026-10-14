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
