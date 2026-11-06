import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { readStoredValue, writeStoredValue } from './lib.js'

const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const SYNC_INTERVAL = 24 * 60 * 60 * 1000

const toBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const isIos = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)
const standalone =
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)

// state: 'unavailable' | 'install' | 'checking' | 'off' | 'on' | 'denied'
function initial() {
  if (!KEY || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'unavailable'
  if (isIos && !standalone) return 'install'
  if (typeof Notification === 'undefined' || !('PushManager' in window)) return 'unavailable'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.permission === 'granted' ? 'checking' : 'off'
}

async function subscriptionId({ endpoint, keys }) {
  if (!globalThis.crypto?.subtle) return ''
  const encoded = new TextEncoder().encode(JSON.stringify([endpoint, keys.p256dh, keys.auth]))
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoded))
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export default function usePush(space, userId) {
  const storageKey = `push-sync:${space.id}:${userId}`
  const [state, setState] = useState(() => {
    const status = initial()
    return status === 'checking' && readStoredValue(storageKey) === 'off' ? 'off' : status
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const save = useCallback(
    async (subscription) => {
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          { user_id: userId, space_id: space.id, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
          { onConflict: 'endpoint' },
        )
      if (error) throw error
    },
    [space.id, userId],
  )

  // Keep granted subscriptions working, and refresh the saved registration
  // when it changes or periodically to recover from server-side removal.
  useEffect(() => {
    const status = initial()
    if (status === 'unavailable') return
    let active = true
    const saved = readStoredValue(storageKey)
    const checking = status === 'checking' && saved !== 'off'
    setState(checking ? 'checking' : status === 'checking' ? 'off' : status)
    async function sync() {
      try {
        await navigator.serviceWorker.register('/sw.js')
        if (!active || !checking) return
        const reg = await navigator.serviceWorker.ready
        if (!active) return
        let sub = await reg.pushManager.getSubscription()
        if (!active) return
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(KEY) })
        if (!active) return
        const subscription = sub.toJSON()
        const id = await subscriptionId(subscription)
        if (!active) return
        const [savedId, savedAt] = saved.split(':')
        if (!id || id !== savedId || !(Date.now() - Number(savedAt) < SYNC_INTERVAL)) {
          await save(subscription)
          if (active) writeStoredValue(storageKey, `${id}:${Date.now()}`)
        }
        if (active) setState('on')
      } catch (e) {
        if (active && checking) setState('off')
        console.warn('push setup', e)
      }
    }
    const timer = setTimeout(sync, 1000)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [save, storageKey])

  async function enable() {
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return setState(perm === 'denied' ? 'denied' : 'off')
      await navigator.serviceWorker.register('/sw.js')
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(KEY) })
      const subscription = sub.toJSON()
      const id = await subscriptionId(subscription)
      await save(subscription)
      writeStoredValue(storageKey, `${id}:${Date.now()}`)
      setState('on')
    } catch (e) {
      setErr(e.message || 'Could not turn on notifications.')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        if (error) throw error
        writeStoredValue(storageKey, '')
        await sub.unsubscribe()
      }
      writeStoredValue(storageKey, 'off')
      setState(Notification.permission === 'denied' ? 'denied' : 'off')
    } catch (e) {
      setErr(e.message || 'Could not turn off notifications. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return { state, err, busy, enable, disable }
}
