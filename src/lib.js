import { format } from 'date-fns'

export const TYPES = {
  work: { label: 'Work', color: '#2f95ff' },
  study: { label: 'Study', color: '#c4e84a' },
  important: { label: 'Important', color: '#ff7a59' },
  personal: { label: 'Personal', color: '#b48cff' },
}

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
