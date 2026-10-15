// Receives push notifications even when the app is closed
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

const isApple = /iPhone|iPad|iPod/i.test(self.navigator.userAgent)

self.addEventListener('push', (event) => {
  let d = {}
  try {
    d = event.data ? event.data.json() : {}
  } catch {
    d = { title: 'New message', body: event.data ? event.data.text() : '' }
  }
  const call = d.kind === 'call'
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // the app is open and in front: it already shows the message or rings by itself
      // (iPhone requires every push to show a notification, so it always does)
      if (!isApple && wins.some((w) => w.visibilityState === 'visible' && w.focused)) return
      await self.registration.showNotification(d.title || 'Calendar', {
        body: d.body || '',
        tag: d.tag || (call ? 'call' : 'chat'),
        renotify: true,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: call ? [500, 250, 500, 250, 500] : [120],
        requireInteraction: call,
        data: { view: 'chat', call },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const w = wins[0]
      if (w) {
        await w.focus()
        w.postMessage({ type: 'open', view: 'chat' })
      } else {
        await self.clients.openWindow('/?open=chat')
      }
    })(),
  )
})
