import { supabase } from './supabase.js'

const BASE_URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Upload with a real progress bar (supabase-js upload() has none)
export async function uploadWithProgress({ path, file, onProgress, onXhr }) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest()
    onXhr?.(x)
    x.open('POST', BASE_URL + '/storage/v1/object/movies/' + path)
    x.setRequestHeader('Authorization', 'Bearer ' + token)
    x.setRequestHeader('apikey', KEY)
    x.setRequestHeader('x-upsert', 'false')
    x.setRequestHeader('cache-control', 'max-age=3600')
    x.setRequestHeader('Content-Type', file.type || 'video/mp4')
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) return resolve()
      let msg = 'Upload failed (' + x.status + ')'
      try {
        const j = JSON.parse(x.responseText)
        msg = j.message || j.error || msg
        if (x.status === 413 || /maximum allowed size|too large/i.test(msg))
          msg = 'This file is larger than your Supabase plan allows (free plan: 50 MB per file).'
      } catch {}
      reject(new Error(msg))
    }
    x.onerror = () => reject(new Error('Network error during upload'))
    x.onabort = () => reject(new Error('cancelled'))
    x.send(file)
  })
}

// Grab a frame from the video as the poster (best effort, never blocks the upload)
export function makePoster(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    const url = window.URL.createObjectURL(file)
    const done = (b) => {
      window.URL.revokeObjectURL(url)
      resolve(b)
    }
    const timer = setTimeout(() => done(null), 8000)
    v.muted = true
    v.preload = 'metadata'
    v.playsInline = true
    v.onerror = () => {
      clearTimeout(timer)
      done(null)
    }
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(Math.max(v.duration * 0.1 || 1, 1), 30)
    }
    v.onseeked = () => {
      try {
        const w = 360
        const h = Math.round((w * 3) / 2)
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const g = c.getContext('2d')
        g.fillStyle = '#000'
        g.fillRect(0, 0, w, h)
        const r = Math.max(w / v.videoWidth, h / v.videoHeight)
        const dw = v.videoWidth * r
        const dh = v.videoHeight * r
        g.drawImage(v, (w - dw) / 2, (h - dh) / 2, dw, dh)
        c.toBlob((b) => {
          clearTimeout(timer)
          done(b)
        }, 'image/jpeg', 0.8)
      } catch {
        clearTimeout(timer)
        done(null)
      }
    }
    v.src = url
  })
}

