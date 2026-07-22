// WDWShiftX service worker — Web Push only (no offline caching).
// Registered lazily from lib/push.ts when a user enables notifications.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // Non-JSON payload — show a generic notification rather than dropping it
  }

  const title = data.title || 'WDWShiftX'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/apple-icon.png',
      badge: '/apple-icon.png',
      data: { url: data.url || '/wall' },
      // Keep desktop toasts on screen until dismissed — the default ~5s
      // auto-hide is easy to miss for time-sensitive shift matches
      requireInteraction: true,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/wall'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
