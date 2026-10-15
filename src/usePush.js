import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase.js'

const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

const toBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const isIos = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)
const standalone =
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)

// state: 'unavailable' | 'install' | 'off' | 'on' | 'denied'
function initial() {
  if (!KEY || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'unavailable'
  if (isIos && !standalone) return 'install'
  if (typeof Notification === 'undefined' || !('PushManager' in window)) return 'unavailable'
  if (Notification.permission === 'denied') return 'denied'
  return 'off'
}

export default function usePush(space, userId) {
  const [state, setState] = useState(initial)
  const [err, setErr] = useState('')

  const save = useCallback(
    async (sub) => {
      const j = sub.toJSON()
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          { user_id: userId, space_id: space.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth },
          { onConflict: 'endpoint' },
        )
      if (error) throw error
    },
    [space.id, userId],
  )

  // register the service worker; if notifications were already allowed, keep this phone subscribed
  useEffect(() => {
    if (initial() === 'unavailable') return
    ;(async () => {
      try {
        await navigator.serviceWorker.register('/sw.js')
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
        const reg = await navigator.serviceWorker.ready
        let sub = await reg.pushManager.getSubscription()
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(KEY) })
        await save(sub)
        setState('on')
      } catch (e) {
        console.warn('push setup', e)
      }
    })()
  }, [save])

  async function enable() {
    setErr('')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return setState(perm === 'denied' ? 'denied' : 'off')
      await navigator.serviceWorker.register('/sw.js')
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(KEY) })
      await save(sub)
      setState('on')
    } catch (e) {
      setErr(e.message || 'Could not turn on notifications.')
    }
  }

  async function disable() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
    } catch {
      /* ignore */
    }
    setState(Notification.permission === 'denied' ? 'denied' : 'off')
  }

  return { state, err, enable, disable }
}
