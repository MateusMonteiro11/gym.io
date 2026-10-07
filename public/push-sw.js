/* Push Foundation only: no cache, authentication, workout state or actions. */
const TEST_BODY = 'Notificações de treino ativadas.'
function validPayload(value) {
  return value && value.version === 1 && value.type === 'test' && value.title === 'Gym.io' &&
    value.body === TEST_BODY && value.data?.url === '/dashboard' &&
    Object.keys(value).every((key) => ['version', 'type', 'title', 'body', 'data'].includes(key)) &&
    Object.keys(value.data).length === 1
}
self.addEventListener('push', (event) => {
  let payload
  try { payload = event.data?.json() } catch { return }
  if (!validPayload(payload)) return
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body, icon: '/push-icon-192.png', badge: '/push-icon-192.png',
    tag: 'gymio-push-test', data: { url: '/dashboard' },
  }))
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action || event.notification.data?.url !== '/dashboard') return
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const current = windows.find((client) => {
      try { return new URL(client.url).origin === self.location.origin } catch { return false }
    })
    if (current) { await current.navigate('/dashboard'); await current.focus() }
    else await self.clients.openWindow('/dashboard')
  })())
})
