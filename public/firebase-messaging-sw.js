/* eslint-disable no-undef */

const parsePushPayload = (event) => {
  if (!event.data) return null

  try {
    return event.data.json()
  } catch {
    try {
      return JSON.parse(event.data.text())
    } catch {
      return null
    }
  }
}

// Push listener is registered at initial worker evaluation to satisfy browser requirements.
self.addEventListener('push', (event) => {
  const payload = parsePushPayload(event)
  const title = payload?.notification?.title || payload?.data?.title || 'Shenyol Travel'
  const body = payload?.notification?.body || payload?.data?.body || 'Yeni bildirişiniz var'
  const icon = payload?.notification?.icon || payload?.data?.icon || '/favicon.ico'
  const link = payload?.fcmOptions?.link || payload?.data?.linkUrl || payload?.data?.link || '/'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      data: { link },
    }),
  )
})

self.addEventListener('message', () => {
  // No-op: reserved for future service worker commands.
})

// Listener must exist at initial evaluation to avoid browser warnings.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(Promise.resolve())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification?.data?.link || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }

      return undefined
    }),
  )
})
