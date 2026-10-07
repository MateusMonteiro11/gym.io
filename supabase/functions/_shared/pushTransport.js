import { validatePushEndpoint } from './pushHandler.js'

// No encryption implementation here. The validated library supplies request details.
export function createWebPushTransport({ generateRequestDetails, vapid, fetchImpl = fetch, timeoutMs = 10000 }) {
  return async (snapshot, payload) => {
    if (!validatePushEndpoint(snapshot.endpoint)) throw new Error('provider_not_supported')
    const details = generateRequestDetails({ endpoint: snapshot.endpoint, keys: { p256dh: snapshot.p256dh, auth: snapshot.auth } }, JSON.stringify(payload), {
      vapidDetails: vapid, TTL: 60,
    })
    if (details.method !== 'POST' || details.endpoint !== snapshot.endpoint) throw new Error('invalid_push_request')
    const controller = new AbortController()
    let timer
    try {
      const response = await Promise.race([
        fetchImpl(details.endpoint, { method: 'POST', headers: details.headers, body: details.body, redirect: 'error', signal: controller.signal }),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('push_timeout')) }, timeoutMs) }),
      ])
      // Provider bodies/headers may contain sensitive details and are not logged/returned.
      if (response.body) await response.body.cancel()
      return response.status
    } finally { clearTimeout(timer) }
  }
}
