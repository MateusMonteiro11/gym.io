export const TEST_PAYLOAD = Object.freeze({ version: 1, type: 'test', title: 'Gym.io', body: 'Notificações de treino ativadas.', data: { url: '/dashboard' } })
const HOSTS = new Set(['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validatePushEndpoint(endpoint) {
  try {
    const url = new URL(endpoint)
    return endpoint.length <= 2048 && url.protocol === 'https:' && !url.port && !url.username && !url.password &&
      !url.hash && url.pathname !== '/' && HOSTS.has(url.hostname)
  } catch { return false }
}

async function smallJson(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('invalid_body')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('invalid_body')
  let size = 0
  const chunks = []
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 1024) { await reader.cancel(); throw new Error('invalid_body') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return JSON.parse(new TextDecoder().decode(bytes))
}

// Authentication, repository and transport are injected; never selected by request data.
export function createPushHandler({ authenticate, repository, sendPush, allowedOrigins = [], now = () => new Date() }) {
  return async (request) => {
    const origin = request.headers.get('origin')
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' }
    if (origin && allowedOrigins.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin
      headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info'
      headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    }
    const reply = (status, result) => new Response(JSON.stringify({ result }), { status, headers })
    if (origin && !allowedOrigins.includes(origin)) return reply(403, 'origin_not_allowed')
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return reply(405, 'method_not_allowed')
    const bearer = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1]
    if (!bearer) return reply(401, 'authentication_required')
    let user
    try { user = await authenticate(bearer) } catch { return reply(401, 'authentication_required') }
    if (!user?.id || user.is_anonymous) return reply(401, 'authentication_required')
    let body
    try { body = await smallJson(request) } catch { return reply(400, 'invalid_request') }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !UUID.test(body.subscription_id)) return reply(400, 'invalid_request')
    try {
      const current = await repository.get(user.id, body.subscription_id)
      if (!current) return reply(404, 'subscription_not_found')
      if (!validatePushEndpoint(current.endpoint)) return reply(422, 'provider_not_supported')
      const snapshot = await repository.claim(user.id, body.subscription_id, now())
      if (!snapshot) return reply(429, 'rate_limited')
      let status
      try { status = await sendPush(snapshot, TEST_PAYLOAD) } catch { return reply(503, 'temporarily_unavailable') }
      if (status >= 200 && status < 300) return reply(200, 'sent')
      if (status === 404 || status === 410) {
        const removed = await repository.removeSnapshot(user.id, snapshot)
        return reply(200, removed ? 'expired' : 'subscription_changed')
      }
      return reply(503, 'temporarily_unavailable')
    } catch { return reply(503, 'temporarily_unavailable') }
  }
}
